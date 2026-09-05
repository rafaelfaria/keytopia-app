/**
 * `/tools/weak-key-analysis`
 *
 * The tool that justifies the suite existing. Everything else on the internet
 * gives you a number; this gives you the letters behind it, and then a drill
 * for them that you can run without leaving the page.
 *
 * Two things carry the honesty of this page. The passage is weighted so that
 * every letter, including the ones ordinary English barely uses, appears
 * several times: a report built on normal prose would have measured E
 * thoroughly and Z not at all, and would then have quietly said nothing about
 * Z. And a key needs four sightings before the tool will call it anything, with
 * the count printed beside every verdict so the reader can weigh it themselves.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import {
  RestartButton, ToolControls, TypingSurface,
  type FinishedRun, type SurfaceHandle,
} from '../../components/tools/TypingSurface';
import { Headline, KeyBars, ResultPanel, TooShort } from '../../components/tools/ResultCards';
import { SaveResult } from '../../components/tools/SaveResult';
import { toolByPath } from '../../lib/tools/registry';
import { coverageText, drillText } from '../../lib/tools/text';
import { isMeaningful } from '../../lib/tools/metrics';
import { analyseKeys, MIN_SAMPLE, practiceAdvice } from '../../lib/tools/keys';
import { toolCompleted, toolRestarted, toolStarted } from '../../lib/tools/analytics';
import { displayChar } from '../../lib/keyboard';
import { buildToolPath, readKeys } from '../../lib/tools/deepLink';
import { ShareLink } from '../../components/tools/ShareLink';

const TOOL = toolByPath('/tools/weak-key-analysis')!;
const FIRST_SEED = 9_240_661;

type Stage = 'analysis' | 'drill';

export function WeakKeysPage() {
  const [params] = useSearchParams();
  // `?keys=rtp` skips the analysis and opens a drill for those letters. This is
  // the link a lesson, an article or a coach hands somebody who already knows
  // what their problem is, and it is why the drill generator takes keys rather
  // than an analysis object.
  const linkedKeys = useMemo(() => readKeys(params, 'keys'), [params]);

  const [seed, setSeed] = useState(FIRST_SEED);
  const [run, setRun] = useState<FinishedRun | null>(null);
  const [stage, setStage] = useState<Stage>('analysis');
  const [drillRun, setDrillRun] = useState<FinishedRun | null>(null);
  const surface = useRef<SurfaceHandle | null>(null);
  const drillSurface = useRef<SurfaceHandle | null>(null);

  const text = useMemo(() => coverageText(seed, 90), [seed]);

  const analysis = useMemo(
    () => (run ? analyseKeys(run.result.keyAgg, run.strokes) : null),
    [run],
  );

  const focusKeys = analysis?.focus.length ? analysis.focus : linkedKeys;
  const drill = useMemo(
    () => (focusKeys.length ? drillText(focusKeys, seed + 1, 44) : null),
    [focusKeys, seed],
  );

  const onFinish = useCallback((r: FinishedRun) => {
    setRun(r);
    setStage('analysis');
    setDrillRun(null);
    if (isMeaningful(r.result.typed, r.result.seconds * 1000)) {
      const a = analyseKeys(r.result.keyAgg, r.strokes);
      toolCompleted('weak-key-analysis', r.result, {
        keys_sampled: a.sampled,
        weak_keys_found: a.weakest.length,
      });
    }
  }, []);

  const restart = useCallback(() => {
    setRun(null);
    setDrillRun(null);
    setStage('analysis');
    setSeed((s) => s + 2);
    surface.current?.restart();
    toolRestarted('weak-key-analysis');
  }, []);

  const res = run?.result ?? null;
  const usable = res ? isMeaningful(res.typed, res.seconds * 1000) : false;
  const advice = analysis ? practiceAdvice(analysis) : null;

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="Weak-key analysis">
        {!run && linkedKeys.length > 0 && (
          <div className="tool-drill tool-drill-linked">
            <h2>A drill for {linkedKeys.map((k) => k.toUpperCase()).join(', ')}</h2>
            <p>
              Somebody sent you straight to this, so the analysis is skipped. Real words
              containing these keys, with short repetition chunks between them. Slow down about
              ten per cent and aim for zero misses rather than for a time.
            </p>
            {drill && (
              <TypingSurface
                text={drill}
                label={`Weak-key drill: ${linkedKeys.join(', ')}`}
                showLiveWpm={false}
                onFinish={setDrillRun}
                surfaceRef={(h) => { drillSurface.current = h; }}
                idleHint="Click the drill to begin. Accuracy, not speed."
              />
            )}
            {drillRun && (
              <div className="tool-drill-result" role="status">
                <p>
                  Drill finished at <strong>{drillRun.result.acc}% accuracy</strong> over{' '}
                  {drillRun.result.typed} keystrokes.
                </p>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => { setDrillRun(null); drillSurface.current?.restart(); }}
                >
                  Run it again
                </button>
              </div>
            )}
            <p className="tt-handoff">
              Not sure these are the right keys? The{' '}
              <Link to={TOOL.path}>full analysis</Link> works them out from your own typing
              rather than taking somebody's word for it.
            </p>
          </div>
        )}

        {!run && linkedKeys.length === 0 && (
          <>
            <ToolControls><RestartButton onClick={restart} label="New passage" /></ToolControls>
            <p className="tool-brief">
              About ninety words, chosen so that every letter of the alphabet turns up several
              times, including J, Q, X and Z. There is no clock. Type at your normal pace,
              because rushing produces errors caused by hurry rather than by the keys, which is
              the opposite of what this is looking for.
            </p>
            <TypingSurface
              text={text}
              label="Weak-key analysis"
              showLiveWpm={false}
              onFinish={onFinish}
              onStart={() => toolStarted('weak-key-analysis')}
              surfaceRef={(h) => { surface.current = h; }}
              idleHint="Click the text to begin. Nothing is timing you."
            />
          </>
        )}

        {res && !usable && <TooShort onRetry={restart} />}

        {res && usable && analysis && (
          <ResultPanel title="Your keyboard, key by key">
            <Headline value={analysis.sampled} unit="keys measured">
              {analysis.sampled} keys appeared at least {MIN_SAMPLE} times, which is the minimum
              this tool will judge anything on.{' '}
              {analysis.weakest.length
                ? `${analysis.weakest.length} of them showed a real weakness.`
                : 'None of them showed a clear weakness.'}{' '}
              You typed at {res.acc}% accuracy overall.
            </Headline>

            {advice && <p className="tool-advice">{advice}</p>}

            <div className="tt-diagnosis">
              <div className="tt-diagnosis-col">
                <KeyBars
                  title="Keys needing practice"
                  unit="missed"
                  rows={analysis.weakest.map((k) => ({
                    label: k.label,
                    pct: k.errors > 0 ? (k.errors / k.attempts) * 100 : Math.min(100, (k.relative - 1) * 100),
                    value: k.errors > 0 ? `${Math.round((k.errors / k.attempts) * 100)}%` : `${Math.round((k.relative - 1) * 100)}% slow`,
                    sub: `${k.attempts} seen`,
                  }))}
                />
                {!analysis.weakest.length && (
                  <p className="tt-handoff">
                    Nothing to report, which is a genuine result rather than a failure to find
                    one. Every key the analysis saw enough of landed correctly and at a normal
                    pace for you.
                  </p>
                )}

                {analysis.confusions.length > 0 && (
                  <div className="tt-panel">
                    <h3>Most common errors</h3>
                    <ol className="tool-confusions">
                      {analysis.confusions.map((c) => (
                        <li key={`${c.expected}${c.typed}`}>
                          <kbd>{displayChar(c.expected)}</kbd>
                          <i className="tt-arrow" aria-hidden>became</i>
                          <kbd>{displayChar(c.typed)}</kbd>
                          <span className="tt-bar-v is-soft">{c.count}×</span>
                        </li>
                      ))}
                    </ol>
                    <p className="tt-handoff">
                      Repeated swaps between neighbouring keys usually mean a finger has drifted
                      off its home-row anchor, so every reach from it lands one key out. That is
                      a posture fix, not a memory one.
                    </p>
                  </div>
                )}
              </div>

              <div className="tt-diagnosis-col">
                <KeyBars
                  title="Your strongest keys"
                  unit="response"
                  rows={analysis.strongest.map((k) => ({
                    label: k.label,
                    pct: Math.max(6, 100 - Math.min(100, k.relative * 55)),
                    value: `${k.ms}ms`,
                    sub: `${k.attempts} seen`,
                  }))}
                />

                {analysis.undersampled.length > 0 && (
                  <div className="tt-panel">
                    <h3>Not seen often enough to judge</h3>
                    <p className="tt-handoff">
                      These turned up fewer than {MIN_SAMPLE} times in your run, so the analysis
                      is saying nothing about them rather than guessing:{' '}
                      {analysis.undersampled.map((k) => displayChar(k)).join(', ')}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* The drill. Generated from this reader's own weakest keys, and
                runnable here rather than being described and then withheld. */}
            {drill && (
              <div className="tool-drill">
                <h3>A drill for {analysis.focus.map((k) => k.toUpperCase()).join(', ')}</h3>
                <p>
                  Real words containing your weakest keys, with short repetition chunks between
                  them for the reps. Slow down about ten per cent and aim for zero misses rather
                  than for a time.
                </p>

                {stage === 'analysis' ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-big"
                    onClick={() => { setStage('drill'); setDrillRun(null); }}
                  >
                    Type the drill now
                  </button>
                ) : (
                  <>
                    {!drillRun && (
                      <TypingSurface
                        text={drill}
                        label={`Weak-key drill: ${analysis.focus.join(', ')}`}
                        showLiveWpm={false}
                        onFinish={setDrillRun}
                        surfaceRef={(h) => { drillSurface.current = h; }}
                        idleHint="Click the drill to begin. Accuracy, not speed."
                      />
                    )}
                    {drillRun && (
                      <div className="tool-drill-result" role="status">
                        <p>
                          Drill finished at <strong>{drillRun.result.acc}% accuracy</strong>
                          {' '}over {drillRun.result.typed} keystrokes.{' '}
                          {drillRun.result.acc >= res.acc
                            ? 'Better than your analysis run, which is what focused practice is supposed to do.'
                            : 'Lower than your analysis run, which is normal: a drill concentrates the keys you find hardest.'}
                        </p>
                        <button
                          type="button"
                          className="btn btn-soft"
                          onClick={() => { setDrillRun(null); drillSurface.current?.restart(); }}
                        >
                          Run it again
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="tt-again">
              <button type="button" className="btn btn-primary btn-big" onClick={restart}>
                New analysis
              </button>
              <SaveResult tool="weak-key-analysis" source="weak-key-analysis" result={res} />
              <ToolCta tool="weak-key-analysis" to="/onboarding" kind="soft">
                Practise these keys properly
              </ToolCta>
            </div>

            {analysis.focus.length > 0 && (
              <ShareLink
                path={buildToolPath(TOOL.path, { keys: analysis.focus.join('') })}
                label="Copy a link to this drill"
                hint={`Opens straight into the ${analysis.focus.map((k) => k.toUpperCase()).join(', ')} drill, skipping the analysis. Useful for a lesson plan, or for coming back to it yourself.`}
              />
            )}

            <p className="tt-handoff">
              This is one passage of evidence. KeyTopia keeps the same per-key map across every
              session you ever type, so the practice text is rebuilt from thousands of keystrokes
              instead of ninety words, and it updates as keys move from weak to reliable. That is{' '}
              <Link to="/adaptive-practice">how the adaptive engine works</Link>, and you can see
              the whole picture in <Link to="/typing-analytics">the analytics</Link>.
            </p>
          </ResultPanel>
        )}
      </section>
    </ToolPage>
  );
}

export default WeakKeysPage;
