import { useEffect, useState } from 'react';
import { Ic } from './icons';
import { Avatar } from './avatars';
import { PixelCar } from './gamekit';

/**
 * The track: one lane per racer, drawn the same way wherever a race is running.
 *
 * Shared because a race now happens in two places — the signed-in Lightstream
 * and the guest room a link drops a friend into — and the two must be the same
 * race. A guest watching a different track from the friend who invited them is
 * the one thing a shared link cannot afford to be.
 */

export interface RaceLane {
  id: string;
  name: string;
  avatar: string;
  you?: boolean;
  ghost?: boolean;
  remote?: boolean;
  progress: number;
  wpm: number;
  finishedAt: number | null;
  /** Walked out mid-race: closed the tab, left the room, lost the connection. */
  left?: boolean;
  /**
   * Out of the race without having crossed: their screen was stopped because
   * everybody else was already across. Not a finish, so it earns no rank, and
   * the lane keeps the ground they actually covered.
   */
  stopped?: boolean;
}

const CAR_COLORS = ['#8b7cff', '#ffb454', '#f2789f', '#6fd695', '#5fc9e0'];

/**
 * Reconcile the lanes with what the room knows, and do it every frame rather
 * than only when a finish message happens to arrive.
 *
 * A rival's lane is moved by their browser, and their last word to us is one
 * unacknowledged broadcast. Drop it and their car sits mid-track for the rest
 * of the race and through the results screen, which is exactly what somebody
 * still typing sees: an opponent who has finished, apparently frozen. The room
 * also carries the fact in presence, so asking it on every tick heals a lost
 * packet by itself.
 */
/**
 * The race is over: every rival has crossed the line, so nothing anybody types
 * from here can change a single place.
 *
 * Only rooms full of real people use this. Against people, typing on alone once
 * the result is settled is a screen left running after the event it belonged to,
 * while the room waits on the host for a rematch. Against the CPU it would be
 * the opposite of a kindness: the bots finishing first is the normal case, and
 * cutting a learner off mid-word to tell them so would end a practice run they
 * were in the middle of.
 */
export function raceDecided(lanes: RaceLane[]): boolean {
  const rivals = lanes.filter((l) => !l.you && !l.ghost);
  return rivals.length > 0 && rivals.every((l) => l.finishedAt !== null || l.left || l.stopped);
}

/**
 * Mark the racers who are no longer in the room.
 *
 * The host closing the room, or anybody closing the tab, used to be invisible
 * to everyone else: their car simply stopped and the race carried on around a
 * player who was not there. Presence is what knows, and it knows within a
 * second, so the tick asks it.
 */
export function markAbsent(lanes: RaceLane[], isPresent: (id: string) => boolean): void {
  for (const l of lanes) {
    if (l.you || l.ghost || l.left || l.finishedAt !== null) continue;
    if (!isPresent(l.id)) l.left = true;
  }
}

export function reconcileFinished(lanes: RaceLane[], isFinished: (id: string) => boolean): void {
  for (const l of lanes) {
    if (l.you || l.finishedAt !== null) continue;
    if (!isFinished(l.id)) continue;
    l.progress = 1;
    l.finishedAt = performance.now();
  }
}

export function RaceLanes({ lanes, running, youAvatar }: {
  lanes: RaceLane[];
  running: boolean;
  /** The learner's own avatar, which the lane list only knows by id. */
  youAvatar: string;
}) {
  return (
    <>
      {lanes.map((l, idx) => (
        <div key={l.id} className={`race-lane ${l.you ? 'race-lane-you' : ''} ${l.left || l.stopped ? 'race-lane-left' : ''}`}>
          <span className="race-name">
            {l.ghost ? <Ic n="ghost" size={20} /> : <Avatar v={l.you ? youAvatar : l.avatar} size={20} />}
            {' '}{l.you ? 'You' : l.name}
          </span>
          <div className={`road ${running ? 'road-moving' : ''}`}>
            <span
              className="road-car"
              /* Clamped, not trusted: a lane fed by another browser must never
                 be able to place a car at `left: NaN%`, which resolves to no
                 rule at all and takes the car off the screen. */
              style={{
                left: `${Math.min(100, Math.max(1.5, (Number.isFinite(l.progress) ? l.progress : 0) * 100))}%`,
                ['--wheelspin' as string]: `${Math.max(0.12, 0.7 - (Number.isFinite(l.wpm) ? l.wpm : 0) / 220)}s`,
              }}
            >
              {l.ghost
                ? <PixelCar color="#7a8296" ghost />
                : <PixelCar color={l.you ? 'var(--accent)' : CAR_COLORS[idx % CAR_COLORS.length]} you={l.you} />}
              {l.finishedAt && <Ic n="flag" size={13} className="road-done-flag" />}
            </span>
            <span className="road-finish" aria-hidden />
          </div>
          <span className="race-wpm">{l.left ? 'left' : l.stopped ? 'stopped' : `${l.wpm} wpm`}</span>
        </div>
      ))}
    </>
  );
}

/**
 * Five, because three is not long enough to read the first line.
 *
 * A race starts against text you have never seen, and the seconds before it are
 * the only chance to look at it. Three ticks is barely time to find the first
 * word; five lets you read ahead, which is what a typist actually does.
 */
export const COUNT_FROM = 5;
export const COUNT_STEP_MS = 800;
/** How long GO! stays up. It leaves on a timer, never on a keystroke. */
export const GO_MS = 550;

/**
 * The start cue: 5-4-3-2-1, then GO! for half a second, then gone.
 *
 * It used to be a full-card veil with a blur, and GO! hung there until the first
 * correct keystroke — so the one moment when the track needs watching was the
 * one moment it was covered by a word saying the race had begun. Now the veil
 * only pools behind the numeral, and the cue clears itself whether or not
 * anybody has started typing.
 */
export function RaceCue({ count, go }: { count: number; go: boolean }) {
  if (count > 0) {
    return (
      <div className="race-cue" aria-live="assertive" aria-atomic>
        <span className="race-cue-num" key={count}>{count}</span>
      </div>
    );
  }
  if (go) return <div className="race-cue race-cue-go" aria-live="assertive">GO!</div>;
  return null;
}

/**
 * The race clock. It replaces the start cue in the same corner, so the strip
 * always answers "how long have I been going" — during the countdown that
 * answer is the count itself, and after it, the time.
 */
export function RaceClock({ startedAt, stopped }: { startedAt: number | null; stopped?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (startedAt === null || stopped) return;
    const id = window.setInterval(() => tick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [startedAt, stopped]);

  if (startedAt === null) return <span className="race-clock race-clock-idle">Ready</span>;
  const secs = Math.max(0, Math.floor((performance.now() - startedAt) / 1000));
  return (
    <span className="race-clock">
      <Ic n="timer" size={13} />
      {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
    </span>
  );
}
