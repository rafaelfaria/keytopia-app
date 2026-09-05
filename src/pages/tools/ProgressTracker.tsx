/**
 * `/tools/typing-progress-tracker`
 *
 * The suite's memory. Results kept from the other tools, plus anything typed in
 * by hand, charted and summarised.
 *
 * Everything lives in this browser. The app's own progress model
 * (`src/lib/store.ts`) is not reused here and could not be: it is a
 * zustand-persist store bound to a profile inside an account, a stranger on
 * /tools has neither, and importing it would drag localStorage into module
 * scope, which the prerenderer cannot survive. What a signed-in visitor gets is
 * the far richer history inside the app, which this page points at rather than
 * duplicating.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import { LineChart } from '../../components/charts';
import { toolByPath } from '../../lib/tools/registry';
import {
  clearResults, deleteResult, loadState, saveResult, summarise,
  type ToolResult, type ToolSource,
} from '../../lib/tools/storage';
import { progressSaved } from '../../lib/tools/analytics';
import { accuracyBand, speedBand } from '../../lib/tools/metrics';
import { relTime } from '../../lib/metrics';
import { buildToolPath, readNumber } from '../../lib/tools/deepLink';
import { ShareLink } from '../../components/tools/ShareLink';

const TOOL = toolByPath('/tools/typing-progress-tracker')!;

const SOURCE_LABELS: Record<ToolSource, string> = {
  'typing-speed-test': 'Speed test',
  'typing-accuracy-test': 'Accuracy test',
  'timed-typing-challenge': 'Timed challenge',
  'weak-key-analysis': 'Weak-key analysis',
  'daily-typing-exercise': 'Daily exercise',
  manual: 'Added by hand',
};

function ManualEntry({ onAdd }: { onAdd: () => void }) {
  const [wpm, setWpm] = useState('');
  const [acc, setAcc] = useState('');
  const [seconds, setSeconds] = useState('60');
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(wpm);
    const a = Number(acc);
    const s = Number(seconds);
    if (!Number.isFinite(w) || w <= 0 || w > 400) {
      setProblem('Enter a speed between 1 and 400 WPM.');
      return;
    }
    if (!Number.isFinite(a) || a < 0 || a > 100) {
      setProblem('Enter an accuracy between 0 and 100 per cent.');
      return;
    }
    if (!Number.isFinite(s) || s <= 0 || s > 86_400) {
      setProblem('Enter a duration in seconds, between 1 and 86400.');
      return;
    }
    saveResult({
      source: 'manual',
      wpm: Math.round(w * 10) / 10,
      raw: Math.round(w * 10) / 10,
      acc: Math.round(a * 10) / 10,
      seconds: Math.round(s),
      mistakes: 0,
      typed: 0,
    });
    progressSaved('typing-progress-tracker', w, a, true);
    setWpm(''); setAcc(''); setProblem(null);
    onAdd();
  }, [wpm, acc, seconds, onAdd]);

  if (!open) {
    return (
      <button type="button" className="btn btn-soft" onClick={() => setOpen(true)}>
        Add a result by hand
      </button>
    );
  }

  return (
    <form className="tool-form tool-manual" onSubmit={submit}>
      <h3>Add a result</h3>
      <p className="tool-note">
        For results from somewhere else, or from a test you took before you found this page.
      </p>
      <div className="tool-form-row">
        <label className="tool-label" htmlFor="man-wpm">
          Speed (WPM)
          <input id="man-wpm" className="tool-input" type="number" min="1" max="400" step="any"
            value={wpm} onChange={(e) => setWpm(e.target.value)} required />
        </label>
        <label className="tool-label" htmlFor="man-acc">
          Accuracy (%)
          <input id="man-acc" className="tool-input" type="number" min="0" max="100" step="any"
            value={acc} onChange={(e) => setAcc(e.target.value)} required />
        </label>
        <label className="tool-label" htmlFor="man-sec">
          Duration (seconds)
          <input id="man-sec" className="tool-input" type="number" min="1" max="86400" step="1"
            value={seconds} onChange={(e) => setSeconds(e.target.value)} required />
        </label>
      </div>
      {problem && <p className="tool-problem" role="alert">{problem}</p>}
      <div className="tt-again">
        <button type="submit" className="btn btn-primary">Add it</button>
        <button type="button" className="btn btn-soft" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function ProgressTrackerPage() {
  const [params] = useSearchParams();
  // `?goal=60`. The link to send somebody who has just been told to reach a
  // particular speed: their own history, measured against that number.
  const goal = readNumber(params, 'goal', { min: 1, max: 400 });

  const [results, setResults] = useState<ToolResult[] | null>(null);

  const reload = useCallback(() => {
    setResults(loadState().results);
  }, []);

  // Storage is a browser global, so the first read happens on mount. Until
  // then `results` is null, and the page renders its explanatory content: that
  // is what the prerendered document contains, and what a crawler indexes.
  useEffect(reload, [reload]);

  const ordered = useMemo(
    () => (results ? [...results].sort((a, b) => a.t - b.t) : []),
    [results],
  );
  const summary = useMemo(() => summarise(ordered), [ordered]);

  const points = useMemo(
    () => ordered.map((r, i) => ({ x: i, y: r.wpm, label: new Date(r.t).toLocaleDateString() })),
    [ordered],
  );

  const empty = results !== null && ordered.length === 0;

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="Typing progress tracker">
        {results === null && (
          <p className="tool-brief">
            Your saved typing results are read from this browser when the page loads. Results from
            the tests in this suite arrive here with one click, and you can add results from
            anywhere else by hand.
          </p>
        )}

        {empty && (
          <div className="tool-empty">
            <h2>No results yet</h2>
            <p>
              {goal !== null
                ? `Your target is ${goal} WPM. Take a 60-second typing test to find out where you are starting from.`
                : 'Take a 60-second typing test to create your first one.'}{' '}
              When you finish, press &ldquo;Keep this result&rdquo; and it will appear here,
              along with everything you record afterwards.
            </p>
            <div className="tt-again">
              <ToolCta tool="typing-progress-tracker" to="/tools/typing-speed-test">
                Take a typing speed test
              </ToolCta>
              <ManualEntry onAdd={reload} />
            </div>
          </div>
        )}

        {results !== null && ordered.length > 0 && summary.latest && summary.best && (
          <>
            <dl className="tt-stats tool-summary">
              <div>
                <dt>{summary.latest.wpm}</dt>
                <dd>Latest speed<span>{relTime(summary.latest.t)}, at {summary.latest.acc}%</span></dd>
              </div>
              <div>
                <dt>{summary.best.wpm}</dt>
                <dd>Best speed<span>{relTime(summary.best.t)}</span></dd>
              </div>
              <div>
                <dt>{summary.averageWpm}</dt>
                <dd>Average speed<span>across every result kept</span></dd>
              </div>
              <div>
                <dt>{summary.count}</dt>
                <dd>Sessions<span>average accuracy {summary.averageAcc}%</span></dd>
              </div>
            </dl>

            {goal !== null && summary.latest && (
              <p className="tool-goal" role="status">
                {summary.best.wpm >= goal ? (
                  <>Target of <strong>{goal} WPM</strong> reached: your best is {summary.best.wpm}.
                    Holding it consistently is the next thing, and the average below is the
                    honest measure of that.</>
                ) : (
                  <>Target of <strong>{goal} WPM</strong>.
                    You are {Math.round((goal - summary.latest.wpm) * 10) / 10} WPM away from it
                    on your latest run, and {Math.round((goal - summary.averageWpm) * 10) / 10} on
                    your average. The average is the one that counts.</>
                )}
              </p>
            )}

            <p className="tool-trend" role="status">
              {summary.trend === null ? (
                <>Keep {6 - summary.count} more {6 - summary.count === 1 ? 'result' : 'results'} and
                  a trend appears here. Below six, a comparison is two runs against two runs and
                  means nothing.</>
              ) : summary.trend > 0.5 ? (
                <>Your recent half averages <strong>{summary.trend} WPM faster</strong> than your
                  older half. That is the comparison worth trusting: a first-against-last reading
                  is dominated by whichever two runs happened to be flukes.</>
              ) : summary.trend < -0.5 ? (
                <>Your recent half averages {Math.abs(summary.trend)} WPM slower than your older
                  half. Before reading anything into it, check whether the durations match: a
                  15-second result and a 60-second result are not the same measurement.</>
              ) : (
                <>Your recent and older halves are within half a WPM of each other. A plateau is
                  normal, and the usual cause of a long one is speed practice substituted for
                  accuracy work. Check the accuracy column against the speed column.</>
              )}
            </p>

            {points.length >= 2 && (
              <figure className="tool-chart">
                <figcaption>
                  Speed over your last {points.length} kept results
                  {goal !== null && `, against a ${goal} WPM target`}
                </figcaption>
                {/* The goal joins the chart by widening its scale rather than by
                    drawing a line the chart component does not support: an
                    axis that stops below the target would show you meeting a
                    goal you have not met. */}
                <LineChart
                  points={points}
                  unit=" WPM"
                  showDots
                  height={200}
                  yMin={goal !== null ? 0 : undefined}
                />
              </figure>
            )}

            <p className="tool-reading-out">
              <strong>{speedBand(summary.latest.wpm).label}</strong> for speed,{' '}
              <strong>{accuracyBand(summary.latest.acc).label.toLowerCase()}</strong> for accuracy.{' '}
              {accuracyBand(summary.latest.acc).note}
            </p>

            <div className="tool-table-wrap">
              <table className="tool-table">
                <caption>Every result kept in this browser</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Speed</th>
                    <th scope="col">Accuracy</th>
                    <th scope="col">Length</th>
                    <th scope="col">From</th>
                    <th scope="col"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {[...ordered].reverse().map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td><strong>{r.wpm}</strong> WPM</td>
                      <td>{r.acc}%</td>
                      <td>{r.seconds < 60 ? `${Math.round(r.seconds)}s` : `${Math.round(r.seconds / 6) / 10}m`}</td>
                      <td>{SOURCE_LABELS[r.source] ?? r.source}</td>
                      <td>
                        <button
                          type="button"
                          className="tool-row-del"
                          onClick={() => { deleteResult(r.id); reload(); }}
                          aria-label={`Delete the result from ${new Date(r.t).toLocaleDateString()}, ${r.wpm} WPM`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tt-again">
              <ToolCta tool="typing-progress-tracker" to="/tools/typing-speed-test">
                Add a new result
              </ToolCta>
              <ManualEntry onAdd={reload} />
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => {
                  if (window.confirm('Delete every typing result stored in this browser? This cannot be undone.')) {
                    clearResults();
                    reload();
                  }
                }}
              >
                Clear everything
              </button>
            </div>

            <ShareLink
              path={buildToolPath(TOOL.path, { goal })}
              label={goal !== null ? 'Copy a link to this target' : 'Copy a link to this tracker'}
              hint={goal !== null
                ? `Opens the tracker measured against ${goal} WPM, on whoever's history it is opened with.`
                : 'Add ?goal=60 to this link to open the tracker with a target of 60 WPM.'}
            />

            <p className="tt-handoff">
              This history lives in this browser only, so clearing site data clears it and it will
              not appear on your phone. A free KeyTopia account syncs across devices and keeps far
              more than this page does: per-key mastery across every session,{' '}
              <Link to="/typing-analytics">rhythm analysis and session replay</Link>, records and a
              practice calendar. Nothing here requires it.
            </p>
          </>
        )}
      </section>
    </ToolPage>
  );
}

export default ProgressTrackerPage;
