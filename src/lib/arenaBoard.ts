import { supabase } from './supabase';
import { avatarIndexFor, hashStr, mulberry32, pick } from './rng';
import { kidAvatarValueFor } from '../components/avatars';
import { CLASSMATE_NAMES, RACER_NAMES } from './words';
import {
  ARENA_LIST, arenaGame, arenaPoints, globalBoardsAllowed,
  periodKey, prevPeriodKey, submitKeys,
  type ArenaGameId, type ArenaPeriod,
} from './arena';
import type { ProfileData } from './types';

/**
 * The client half of supabase/migrations/20260816120000_arena_boards.sql.
 *
 * Every read here degrades rather than fails. With no Supabase project
 * configured, no account signed in, or no network, the caller gets a simulated
 * board flagged `simulated` so the UI can say so out loud — the same rule
 * src/lib/leaderboard.ts follows, and for the same reason: a leaderboard is
 * never worth a blocked page, and a game must always be playable.
 *
 * Writes are fire-and-forget. The score is already saved locally in gameBests
 * by the time submitArena() runs, so a failure here costs a board position, not
 * data.
 */

export type ArenaScope =
  | { kind: 'global' }
  | { kind: 'board'; id: string; name: string };

export interface ArenaRow {
  rank: number;
  name: string;
  avatar: string;
  wpm: number;
  acc: number;
  value: number;
  score: number;
  you: boolean;
  /** Sits immediately above or below the caller. Drives the next-target line. */
  neighbour: boolean;
}

export interface ArenaBoardResult {
  rows: ArenaRow[];
  /** Rows are seeded rivals, not real people. The UI must disclose this. */
  simulated: boolean;
  yourRank: number | null;
  /** Every learner on this board, not just the ones fetched. */
  total: number;
  /** The rung above and what it costs, when there is one. */
  target: { rank: number; gap: number; name: string } | null;
  /** Set when a real board was wanted but could not be reached. */
  error: string | null;
}

export interface ArenaStanding {
  game: ArenaGameId;
  name: string;
  valueLabel: string | null;
  yourScore: number | null;
  yourValue: number | null;
  yourRank: number | null;
  prevRank: number | null;
  total: number;
  leaderName: string | null;
  leaderScore: number | null;
}

/** What arena_submit() hands back, per period. The rank reveal reads this. */
export interface ArenaSubmitResult {
  period: ArenaPeriod;
  score: number;
  best: number;
  improved: boolean;
  rank: number;
  prevRank: number | null;
  passed: number;
  passedName: string | null;
  total: number;
  nextRank: number | null;
  nextGap: number | null;
}

export function arenaLive(): boolean {
  return Boolean(supabase);
}

// ---------------------------------------------------------------------------
// Submitting
// ---------------------------------------------------------------------------

/**
 * Post one run. Returns the standing for the period the caller cares about, or
 * null when the board could not be reached — in which case the finish screen
 * shows the score and the personal best and simply omits the rank, rather than
 * inventing one.
 *
 * `value` is the game's own headline count: blocks, waves, gates, rounds. The
 * server decides what that is worth; nothing here computes a score.
 */
export async function submitArena(
  data: ProfileData,
  game: ArenaGameId,
  run: { wpm: number; acc: number; value?: number },
  want: ArenaPeriod = 'today',
): Promise<ArenaSubmitResult | null> {
  if (!supabase) return null;
  // The learner asked not to be on boards. That has to mean "not uploaded",
  // not merely "not displayed", or the setting is decoration.
  if (data.settings.hideLeaderboards) return null;

  const keys = submitKeys();
  try {
    const { data: rows, error } = await supabase.rpc('arena_submit', {
      p_game: game,
      p_profile_id: data.profile.id,
      p_age: data.profile.ageGroup,
      p_wpm: clamp(run.wpm, 0, 250),
      p_acc: clamp(run.acc, 0, 100),
      p_value: clamp(run.value ?? 0, 0, 100000),
      p_name: data.profile.name.slice(0, 40),
      p_avatar: data.profile.avatar.slice(0, 160),
      p_day: keys.day,
      p_week: keys.week,
      p_global: globalBoardsAllowed(data),
      p_board_name: (data.profile.boardName ?? '').trim().slice(0, 20),
    });
    // No rows is a legitimate answer, not a failure: the Lightstream accuracy
    // floor and the rate limit both decline silently by design.
    if (error || !rows) return null;

    const wanted = periodKey(want);
    const row = (rows as RawSubmitRow[]).find((r) => r.period === wanted);
    return row ? toSubmitResult(row, want) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reading one board
// ---------------------------------------------------------------------------

export async function fetchArenaBoard(
  game: ArenaGameId,
  period: ArenaPeriod,
  scope: ArenaScope,
  data: ProfileData,
  limit = 10,
  offset = 0,
): Promise<ArenaBoardResult> {
  if (!supabase || data.settings.hideLeaderboards) return simulatedBoard(game, period, data, null);
  if (scope.kind === 'global' && !globalBoardsAllowed(data)) {
    return simulatedBoard(game, period, data, null);
  }

  try {
    const { data: rows, error } = await supabase.rpc('arena_board', {
      p_game: game,
      p_period: periodKey(period),
      p_scope: scope.kind,
      p_board_id: scope.kind === 'board' ? scope.id : null,
      p_age: data.profile.ageGroup,
      p_profile_id: data.profile.id,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) return simulatedBoard(game, period, data, 'Board unavailable right now. Showing practice rivals instead.');
    return shapeBoard((rows ?? []) as RawBoardRow[]);
  } catch {
    return simulatedBoard(game, period, data, 'No connection. Showing practice rivals instead.');
  }
}

/**
 * Turn RPC rows into the shape the UI renders, including the next-target line.
 * Exported because the realtime layer re-derives a board from merged rows and
 * must produce exactly the same shape, or the board would change character the
 * moment a live update arrived.
 */
export function shapeBoard(raw: RawBoardRow[]): ArenaBoardResult {
  const rows: ArenaRow[] = raw.map((r) => ({
    rank: r.rank,
    name: r.name,
    avatar: r.avatar || `bk:${(r.rank * 7) % 12}`,
    wpm: Math.round(r.wpm),
    acc: Math.round(r.acc),
    value: r.value,
    score: r.score,
    you: r.you,
    neighbour: r.neighbour,
  }));
  const me = rows.find((r) => r.you) ?? null;
  const above = me ? rows.find((r) => r.rank === me.rank - 1) : null;
  return {
    rows,
    simulated: false,
    yourRank: me?.rank ?? null,
    // The size of the board, not of the page. `rows.length` was wrong the
    // moment paging existed, and it is what "12 below you" counts against.
    total: raw[0]?.total ?? rows.length,
    target: above && me ? { rank: above.rank, gap: Math.max(1, above.score - me.score + 1), name: above.name } : null,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Reading the hub
// ---------------------------------------------------------------------------

/** One row per game, in one round trip. Backs the whole Arena hub. */
export async function fetchArenaHome(
  data: ProfileData,
  period: ArenaPeriod,
): Promise<{ standings: ArenaStanding[]; simulated: boolean }> {
  const fallback = () => ({
    standings: ARENA_LIST.map((g) => ({
      game: g.id, name: g.name, valueLabel: g.valueLabel,
      // Offline, the only truth available is the learner's own local best.
      yourScore: data.gameBests[g.id]?.score ?? null,
      yourValue: data.gameBests[g.id]?.level ?? null,
      yourRank: null, prevRank: null, total: 0,
      leaderName: null, leaderScore: null,
    })),
    simulated: true,
  });

  if (!supabase || data.settings.hideLeaderboards) return fallback();

  try {
    const { data: rows, error } = await supabase.rpc('arena_home', {
      p_profile_id: data.profile.id,
      p_age: data.profile.ageGroup,
      p_period: periodKey(period),
      p_prev_period: prevPeriodKey(period),
    });
    if (error || !rows) return fallback();
    return {
      standings: (rows as RawHomeRow[])
        .filter((r) => arenaGame(r.game))
        .map((r) => ({
          game: r.game as ArenaGameId,
          name: r.name,
          valueLabel: r.value_label,
          yourScore: r.your_score,
          yourValue: r.your_value,
          yourRank: r.your_rank,
          prevRank: r.prev_rank,
          total: r.total,
          leaderName: r.leader_name,
          leaderScore: r.leader_score,
        })),
      simulated: false,
    };
  } catch {
    return fallback();
  }
}

/** The hub's headline number. See arenaPoints() for why it is shaped this way. */
export function totalArenaPoints(standings: ArenaStanding[]): number {
  return standings.reduce((a, s) => a + arenaPoints(s.yourRank), 0);
}

// ---------------------------------------------------------------------------
// The simulated board
// ---------------------------------------------------------------------------

/**
 * Deterministic practice rivals, seeded from the game and period so the same
 * board is the same board across a session and a reload. Built from the same
 * name and avatar pools as the Daily Challenge's dailyBoard(), so an offline
 * learner meets a consistent cast rather than two unrelated crowds.
 *
 * These rows are always disclosed as simulated by the UI. They exist so a child
 * with no connection still has something to aim at, not to pad a real board.
 */
function simulatedBoard(
  game: ArenaGameId,
  period: ArenaPeriod,
  data: ProfileData,
  error: string | null,
): ArenaBoardResult {
  const age = data.profile.ageGroup;
  const rng = mulberry32(hashStr(`arena-${game}-${periodKey(period)}-${age}`));
  const mine = data.gameBests[game]?.score ?? 0;
  const mineValue = data.gameBests[game]?.level ?? 0;

  // Rivals are scattered around the learner's own best so the board always has
  // somebody just ahead. A fixed ladder would either be unreachable on day one
  // or trivially cleared by week two.
  const anchor = mine > 0 ? mine : (age === 'kid' ? 260 : 520);
  const names = age === 'kid' ? CLASSMATE_NAMES : RACER_NAMES;

  const rivals = Array.from({ length: 9 }, () => {
    const nm = pick(rng, names) + (age === 'kid' ? '' : String(Math.floor(rng() * 89) + 10));
    return {
      name: nm,
      avatar: age === 'kid' ? kidAvatarValueFor(nm) : `bk:${avatarIndexFor(nm)}`,
      score: Math.max(20, Math.round(anchor * (0.55 + rng() * 1.05))),
      wpm: Math.max(6, Math.round((age === 'kid' ? 18 : 40) + (rng() - 0.4) * 30)),
      acc: Math.round(89 + rng() * 10),
      value: Math.max(1, Math.round((mineValue || 12) * (0.5 + rng()))),
      you: false,
    };
  });

  const all = mine > 0
    ? [...rivals, {
        name: data.profile.name, avatar: data.profile.avatar, score: mine,
        wpm: 0, acc: 0, value: mineValue, you: true,
      }]
    : rivals;

  all.sort((a, b) => b.score - a.score);
  const rows: ArenaRow[] = all.map((r, i) => ({ ...r, rank: i + 1, neighbour: false }));
  const me = rows.find((r) => r.you) ?? null;
  if (me) {
    rows.forEach((r) => { r.neighbour = Math.abs(r.rank - me.rank) === 1; });
  }
  const above = me ? rows.find((r) => r.rank === me.rank - 1) : null;

  return {
    rows,
    simulated: true,
    yourRank: me?.rank ?? null,
    total: rows.length,
    target: above && me ? { rank: above.rank, gap: Math.max(1, above.score - me.score + 1), name: above.name } : null,
    error,
  };
}

// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));

export interface RawBoardRow {
  rank: number; name: string; avatar: string;
  wpm: number; acc: number; value: number; score: number;
  you: boolean; neighbour: boolean;
  /** Size of the whole board, repeated on every row so paging needs no second call. */
  total: number;
}

interface RawHomeRow {
  game: string; name: string; value_label: string | null;
  your_score: number | null; your_value: number | null;
  your_rank: number | null; prev_rank: number | null;
  total: number; leader_name: string | null; leader_score: number | null;
}

interface RawSubmitRow {
  period: string; score: number; best: number; improved: boolean;
  rank: number; prev_rank: number | null; passed: number; passed_name: string | null;
  total: number; next_rank: number | null; next_gap: number | null;
}

function toSubmitResult(r: RawSubmitRow, period: ArenaPeriod): ArenaSubmitResult {
  return {
    period,
    score: r.score, best: r.best, improved: r.improved,
    rank: r.rank, prevRank: r.prev_rank,
    passed: r.passed, passedName: r.passed_name,
    total: r.total, nextRank: r.next_rank, nextGap: r.next_gap,
  };
}
