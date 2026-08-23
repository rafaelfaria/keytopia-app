import { useCallback, useMemo, useRef, useState } from 'react';
import { useData, useStore } from '../lib/store';
import { Btn } from './ui';
import { Ic } from './icons';
import {
  clearedCount, ladder, ladderNote, nextLevel,
  type StarterGameId, type StarterLevel,
} from '../lib/starterLevels';

/**
 * The ladder, as a thing a child can see and touch.
 *
 * Two pieces: a path of eight nodes on the front door, and the same path on the
 * finish screen with the new one lit. Both are deliberately a path rather than
 * a progress bar, because a bar says "how much is left" and a path says "here
 * is where you have been", and the second is the one worth showing a five year
 * old who has been at this for a week.
 *
 * Cleared levels stay open forever and can be replayed by tapping them. There
 * is no reason to lock a child out of the level they liked.
 */

export function useStarterLadder(game: StarterGameId) {
  const data = useData();
  const patch = useStore((s) => s.patch);
  const levels = useMemo(() => ladder(game), [game]);
  const cleared = clearedCount(data?.starters, game);
  const [chosen, setChosen] = useState(() => nextLevel(data?.starters, game));

  /** Mark a level done. Only ever moves forward, and only by one. */
  const clear = useCallback((n: number) => {
    patch((d) => {
      d.starters ??= {};
      const now = d.starters[game] ?? 0;
      if (n === now + 1) d.starters[game] = n;
    });
  }, [game, patch]);

  const level: StarterLevel = levels[Math.min(levels.length, Math.max(1, chosen)) - 1];

  /**
   * The level a run is actually being played on, readable from inside the game
   * loop.
   *
   * `chosen` is state, so starting level 5 from the finish screen of level 4
   * sets it and then reads the old value for the rest of that tick — and the
   * interval a game starts in that same tick would close over level 4 for the
   * entire run. The ref is written synchronously by `begin`, so the loop always
   * has the level it is really playing.
   */
  const active = useRef({ n: chosen, level });
  active.current = { n: chosen, level };

  /** Switch to a level and hand it straight back, for the caller's own reset. */
  const begin = useCallback((n: number) => {
    // Guarded because the obvious caller is a click handler, and a button hands
    // its own event to the first argument: `onClick={start}` turns into
    // start(MouseEvent) and levels[NaN] is a crash two frames later.
    const want = Number.isFinite(n) ? n : active.current.n;
    const at = Math.min(levels.length, Math.max(1, Math.round(want)));
    const l = levels[at - 1];
    active.current = { n: at, level: l };
    setChosen(at);
    return l;
  }, [levels]);

  return { levels, level, cleared, chosen, setChosen, begin, active, clear, total: levels.length };
}

/**
 * What to do next, on the finish screen.
 *
 * "Play again" was the only button here, which is the wrong offer in a game
 * with a ladder: the thing a child wants after clearing level one is level two,
 * and being sent back to the level they have just finished reads as not having
 * finished it. So the primary button is the next level, by name, and it is only
 * a replay when there is nothing new to open.
 *
 * There is no "All games" here either. The stage already carries a way back to
 * the Arena in its top corner, on every screen of every game, and a second one
 * competing with the next level is a button spent on leaving.
 */
export function LevelActions({ game, level, unlocked, onPlay, onPick }: {
  game: StarterGameId;
  level: number;
  unlocked: boolean;
  onPlay: (n: number) => void;
  onPick: () => void;
}) {
  const levels = ladder(game);
  const next = unlocked && level < levels.length ? level + 1 : null;
  return (
    <>
      {next ? (
        <Btn big onClick={() => onPlay(next)}>Level {next}: {levels[next - 1].name} →</Btn>
      ) : (
        <Btn big onClick={() => onPlay(level)}>↻ {unlocked ? 'Play it again' : 'Try this one again'}</Btn>
      )}
      <Btn kind="soft" onClick={onPick}><Ic n="map" size={15} /> Pick a level</Btn>
    </>
  );
}

export function LevelPath({ game, cleared, chosen, onPick }: {
  game: StarterGameId;
  cleared: number;
  chosen: number;
  onPick?: (n: number) => void;
}) {
  const levels = ladder(game);
  return (
    <div className="lv-path">
      <ol className="lv-nodes">
        {levels.map((l, i) => {
          const n = i + 1;
          const done = n <= cleared;
          const open = n <= cleared + 1;
          const here = n === chosen;
          const label = `Level ${n}, ${l.name}${done ? ', done' : open ? '' : ', locked'}`;
          return (
            <li key={n} className={`lv-node ${done ? 'lv-done' : ''} ${open ? 'lv-open' : 'lv-locked'} ${here ? 'lv-here' : ''}`}>
              <button
                type="button"
                onClick={open && onPick ? () => onPick(n) : undefined}
                disabled={!open || !onPick}
                aria-current={here ? 'step' : undefined}
                aria-label={label}
                title={label}
              >
                {done ? <Ic n="tick" size={15} /> : open ? n : <Ic n="lock" size={13} />}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="lv-note">{ladderNote(cleared, levels.length)}</p>
    </div>
  );
}

/** The front door's ladder: the path, and what the chosen level actually is. */
export function LevelPicker({ game, cleared, chosen, onPick }: {
  game: StarterGameId; cleared: number; chosen: number; onPick: (n: number) => void;
}) {
  const levels = ladder(game);
  const l = levels[chosen - 1];
  return (
    <div className="lv-picker">
      <p className="arena-stage-kicker"><Ic n="map" size={15} /> Level {chosen} of {levels.length}</p>
      <h3 className="lv-title">{l.name}</h3>
      <LevelPath game={game} cleared={cleared} chosen={chosen} onPick={onPick} />
    </div>
  );
}

/**
 * The finish screen's column. Replaces the personal-best panel: a level either
 * went in or it did not, and that is a clearer thing to hand a child than a
 * points total they cannot compare to anything.
 */
export function LevelResult({ game, level, done, goal, cleared, unlocked }: {
  game: StarterGameId;
  level: number;
  done: number;
  goal: number;
  cleared: number;
  unlocked: boolean;
}) {
  const levels = ladder(game);
  const l = levels[level - 1];
  const next = levels[level];
  return (
    <div className="arena-result-board lv-result">
      <h3 className="arena-stage-kicker">
        {unlocked ? <><Ic n="trophy" size={15} /> Level {level} done</> : <><Ic n="map" size={15} /> Level {level}</>}
      </h3>
      <p className="lv-result-name">{l.name}</p>
      <div className="lv-meter" data-full={done >= goal ? 'true' : undefined}>
        <i style={{ width: `${Math.min(100, (done / goal) * 100).toFixed(0)}%` }} />
        {/* A run that overshoots by one while the last catch was in the air
            still asked for `goal`, and "9 of 8" reads as a bug. */}
        <b>{Math.min(done, goal)} of {goal}</b>
      </div>
      <LevelPath game={game} cleared={cleared} chosen={unlocked ? Math.min(levels.length, level + 1) : level} />
      <div className="arena-result-lines">
        <p className="arena-line">
          {unlocked && next ? `Level ${level + 1} is open: ${next.name}.`
            : unlocked ? 'That was the last one. The whole ladder is yours.'
            : `${goal - done} more and this level is done. Nothing is lost, have another go.`}
        </p>
      </div>
    </div>
  );
}
