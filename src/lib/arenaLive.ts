import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { periodKey, type ArenaPeriod } from './arena';
import type { AgeGroup } from './types';

/**
 * Live Arena boards.
 *
 * Broadcast, not postgres_changes. RLS on arena_scores is "own rows only", so
 * Postgres change events would deliver a learner nothing but their own writes,
 * and a firehose of every score in the product is the wrong shape regardless.
 * A trigger on the table sends a compact payload to one topic per board (see
 * arena_broadcast() in the migration), carrying only what that topic's audience
 * can already see: an alias, a score, no ids.
 *
 * The contract this module offers its callers has two halves, and both matter:
 *
 *   onScore   a rival's number landed. The caller merges it and re-ranks
 *             immediately, so the row visibly glides to its new position. This
 *             is optimistic and may be a little wrong for a moment.
 *   onSettle  two seconds after the last message, refetch authoritatively. An
 *             optimistic merge therefore cannot drift from the truth for longer
 *             than a blink, and the caller never has to reason about when.
 *
 * Presence rides the same channel and gives a board its "7 typists here now"
 * line. It is one track() call and it is the cheapest liveness signal there is.
 *
 * Degrades to silence: with no project configured, watch() returns a no-op
 * handle and the board is simply static. Same rule as src/lib/room.ts.
 */

export interface ArenaScoreEvent {
  alias: string;
  avatar: string;
  score: number;
  wpm: number;
  acc: number;
  value: number;
}

export interface ArenaWatchOptions {
  onScore?: (e: ArenaScoreEvent) => void;
  /** Debounced trailing signal: refetch the board now. */
  onSettle?: () => void;
  /** How many people have this board open, including you. */
  onWatchers?: (n: number) => void;
}

export interface ArenaWatch {
  close: () => void;
}

const SETTLE_MS = 2000;

const NOOP: ArenaWatch = { close: () => {} };

/**
 * Subscribe to one board. The caller is responsible for closing it — on
 * unmount, and also whenever a game enters its running phase, because nothing
 * should re-render behind someone who is typing.
 */
export function watchArenaBoard(
  game: string,
  period: ArenaPeriod,
  age: AgeGroup,
  me: { id: string; name: string },
  opts: ArenaWatchOptions,
): ArenaWatch {
  if (!supabase) return NOOP;

  const topic = `arena:${game}:${periodKey(period)}:${age}`;
  let settleTimer = 0;
  let closed = false;

  // supabase-js keys channels by topic and hands back the EXISTING instance if
  // one is already registered. A board that remounts on the same topic before
  // the previous instance was removed — navigating away and straight back, a
  // hot reload, StrictMode's double effect — therefore got a channel that had
  // already been subscribed, and adding a listener to it throws
  // "cannot add `presence` callbacks … after `subscribe()`", which took the
  // whole board down with it. Clearing any stale instance first makes the
  // subscription idempotent.
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) void supabase.removeChannel(stale);

  const channel: RealtimeChannel = supabase.channel(topic, {
    config: {
      // Keyed by profile so two tabs of the same learner count once, and so a
      // reconnect replaces its own entry rather than adding a phantom watcher.
      presence: { key: me.id },
      private: true,
    },
  });

  const settle = () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      if (!closed) opts.onSettle?.();
    }, SETTLE_MS);
  };

  channel.on('broadcast', { event: 'score' }, ({ payload }) => {
    if (closed) return;
    const p = payload as Partial<ArenaScoreEvent> | null;
    // The payload crosses a wire and is shaped by a database trigger, so it is
    // validated rather than trusted: one malformed message must not take a
    // board down mid-game.
    if (!p || typeof p.alias !== 'string' || typeof p.score !== 'number') return;
    opts.onScore?.({
      alias: p.alias,
      avatar: typeof p.avatar === 'string' ? p.avatar : '',
      score: p.score,
      wpm: Number(p.wpm) || 0,
      acc: Number(p.acc) || 0,
      value: Number(p.value) || 0,
    });
    settle();
  });

  channel.on('presence', { event: 'sync' }, () => {
    if (closed) return;
    opts.onWatchers?.(Object.keys(channel.presenceState()).length);
  });

  channel.subscribe((status) => {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      void channel.track({ at: Date.now() });
    }
    // A dropped channel is not worth telling anyone about: the board keeps
    // showing the last good data and the next visit refetches. Surfacing it
    // would be a status badge for something nobody can act on.
  });

  return {
    close: () => {
      closed = true;
      window.clearTimeout(settleTimer);
      // removeChannel, not unsubscribe: unsubscribe closes the socket topic but
      // leaves the instance in the client's registry, so the next board on this
      // topic is handed the dead one back.
      void supabase?.removeChannel(channel);
    },
  };
}

/**
 * Merge a live score into a board and re-rank, preserving the caller's own row.
 *
 * Two rules make this stable:
 *   - A learner already on the board is UPDATED, never duplicated. Aliases are
 *     stable per profile (keytopia_alias), so the alias is a safe identity here.
 *   - A score that would not make the visible board is dropped rather than
 *     appended, or a busy board would grow without bound between settles.
 */
export function mergeLiveScore<T extends { rank: number; name: string; score: number; you: boolean }>(
  rows: T[],
  e: ArenaScoreEvent,
  make: (e: ArenaScoreEvent) => T,
): T[] {
  const next = [...rows];
  const at = next.findIndex((r) => !r.you && r.name === e.alias);

  if (at >= 0) {
    // Scores only ever improve, so a lower number is a stale message that
    // arrived out of order.
    if (e.score <= next[at].score) return rows;
    next[at] = { ...next[at], ...make(e) };
  } else {
    const worst = next.length ? next[next.length - 1].score : 0;
    if (next.length >= 12 && e.score <= worst) return rows;
    next.push(make(e));
  }

  next.sort((a, b) => b.score - a.score);
  const ranked = next.map((r, i) => ({ ...r, rank: i + 1 }));
  const me = ranked.find((r) => r.you);
  // Keep the list bounded, but never at the cost of the caller's own row.
  return ranked.filter((r, i) => i < 12 || r.you || (me ? Math.abs(r.rank - me.rank) <= 1 : false));
}
