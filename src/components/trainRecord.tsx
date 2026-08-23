import { useMemo } from 'react';
import { Ic } from './icons';
import { OpenSeats, RankBadge } from './arena';
import { relTime } from '../lib/metrics';
import type { SessionMode, SessionResult } from '../lib/types';

/**
 * Where you stand, in a mode nobody else is playing.
 *
 * The mini games put a leaderboard in the stage's right column, and the reason
 * it works is not that strangers are on it. It is rule 2 of the Arena boards:
 * a rank with no target is a scoreboard, a rank with "14 points to pass Bright
 * Kestrel" is a game (docs/arena-leaderboards.md §2).
 *
 * Practice is solo, so the rivals are your own past runs. The five best runs in
 * THIS mode are the board, the run you did last is pinned to it wherever it
 * landed, and the line at the bottom says what beating your best would take.
 * The empty places are drawn for the same reason the game boards draw them: a
 * list that stops after two entries reads as broken, and one that reads "no
 * data" reads as dead, where five numbered empty rows read as an invitation.
 *
 * Deliberately not a leaderboard: nothing here is submitted anywhere, nothing
 * is compared to another learner, and the panel never appears for a mode that
 * exists to not keep score (Zen).
 */

const TOP = 5;

export interface TrainRecordProps {
  mode: SessionMode;
  modeName: string;
  sessions: SessionResult[];
  /**
   * Rank by accuracy rather than speed. The Accuracy Lab's whole claim is that
   * a clean slow run beats a fast messy one, and a panel beside it that sorted
   * by wpm would contradict the screen it sits on.
   */
  precisionFirst?: boolean;
  /** The run that just finished, so the finish screen can point at its row. */
  highlightId?: string;
}

export function TrainRecord({ mode, modeName, sessions, precisionFirst, highlightId }: TrainRecordProps) {
  const runs = useMemo(
    () => sessions.filter((s) => s.mode === mode).sort((a, b) => b.endedAt - a.endedAt),
    [sessions, mode],
  );

  const measure = (s: SessionResult) => (precisionFirst ? s.acc : s.wpm);
  const unit = precisionFirst ? '%' : ' wpm';
  const label = precisionFirst ? 'accuracy' : 'speed';

  const ranked = useMemo(
    () => [...runs].sort((a, b) => measure(b) - measure(a) || b.wpm - a.wpm),
    [runs, precisionFirst],
  );

  const latest = highlightId
    ? runs.find((s) => s.id === highlightId) ?? runs[0]
    : runs[0];
  const latestRank = latest ? ranked.findIndex((s) => s.id === latest.id) + 1 : 0;
  const top = ranked.slice(0, TOP);
  /** Your last run, pinned below a gap when it did not make the top five. */
  const detached = latest && latestRank > TOP ? latest : null;

  const best = ranked[0];
  const gap = best && latest ? Math.round(measure(best) - measure(latest)) : 0;

  return (
    <section className="arena-board train-record" aria-labelledby={`tr-${mode}`}>
      <header className="arena-board-head">
        <h3 id={`tr-${mode}`}><Ic n="trending" size={16} /> Your {modeName} runs</h3>
        {runs.length > 0 && <span className="small muted">{runs.length} {runs.length === 1 ? 'run' : 'runs'}</span>}
      </header>

      {runs.length === 0 ? (
        <div className="arena-unclaimed">
          <OpenSeats from={1} count={TOP} />
          <p className="arena-unclaimed-note">
            <strong>No runs here yet.</strong> The first one sets the mark, and everything after it is measured against your own {label} rather than anybody else's.
          </p>
        </div>
      ) : (
        <>
          <ol className="arena-rows">
            {top.map((s, i) => (
              <RunRow key={s.id} run={s} rank={i + 1} you={s.id === latest?.id} precisionFirst={precisionFirst} />
            ))}
          </ol>
          <OpenSeats from={top.length + 1} count={TOP - top.length} />
          {detached && (
            <>
              <div className="arena-gap" aria-hidden>···</div>
              <ol className="arena-rows">
                <RunRow run={detached} rank={latestRank} you precisionFirst={precisionFirst} />
              </ol>
            </>
          )}
        </>
      )}

      {/* The one number to chase. "Your best is 54 wpm" is a fact; "3 wpm off
          your best" is a target, and the difference is the whole point of the
          line. */}
      {!best ? (
        <p className="arena-target arena-target-quiet">
          <Ic n="target" size={14} /> Finish a run to set your first mark.
        </p>
      ) : latest && latest.id === best.id ? (
        <p className="arena-target arena-target-lead">
          <Ic n="crown" size={14} /> Your last run is your best: <strong>{Math.round(measure(best))}{unit}</strong>. Now hold it.
        </p>
      ) : (
        <p className="arena-target">
          <Ic n="target" size={14} />{' '}
          <strong>{Math.max(1, gap)}{unit}</strong> off your best of {Math.round(measure(best))}{unit}.
        </p>
      )}

      <p className="arena-note small muted">
        <Ic n="shield" size={13} /> Practice is private. These runs are yours alone and never appear on a board.
      </p>
    </section>
  );
}

function RunRow({ run, rank, you, precisionFirst }: {
  run: SessionResult; rank: number; you?: boolean; precisionFirst?: boolean;
}) {
  return (
    <li className={`arena-row train-row${you ? ' arena-row-you' : ''}${rank <= 3 ? ' arena-row-podium' : ''}`}>
      <RankBadge rank={rank} size="sm" />
      <span className="arena-name">
        {relTime(run.endedAt)}
        {you && <span className="arena-you-tag"> (last run)</span>}
      </span>
      {/* Rounded here rather than trusted: a session's wpm and accuracy are
          floats, and "8.8" beside "11.6%" reads as precision the measurement
          does not have. */}
      <span className="arena-metrics small">
        <span>{precisionFirst ? `${Math.round(run.wpm)} wpm` : `${Math.round(run.acc)}%`}</span>
      </span>
      <span className="arena-score">{precisionFirst ? `${Math.round(run.acc)}%` : Math.round(run.wpm)}</span>
    </li>
  );
}
