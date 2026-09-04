/**
 * `/tools/typing-accuracy-test`
 *
 * The same engine as the speed test, asked a different question, and laid out
 * so the answer to that question is the thing you see.
 *
 * Three deliberate differences from the speed test. The passage is real prose
 * with capitals, commas and apostrophes, because a stream of lowercase common
 * words never asks a little finger to reach for a shifted key and therefore
 * never tests where accuracy actually fails. It is untimed, because a clock
 * manufactures the errors it is supposed to be measuring. And the live readout
 * hides WPM, because a speed counter ticking beside you is an instruction to
 * hurry.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import {
  RestartButton, ToolControls, TypingSurface,
  type FinishedRun, type SurfaceHandle,
} from '../../components/tools/TypingSurface';
import { Headline, KeyBars, ResultPanel, StatGrid, Findings, TooShort } from '../../components/tools/ResultCards';
import { SaveResult } from '../../components/tools/SaveResult';
import { toolByPath } from '../../lib/tools/registry';
import { accuracyText } from '../../lib/tools/text';
import { accuracyBand, isMeaningful } from '../../lib/tools/metrics';
import { analyseKeys } from '../../lib/tools/keys';
import { toolCompleted, toolRestarted, toolStarted } from '../../lib/tools/analytics';

const TOOL = toolByPath('/tools/typing-accuracy-test')!;
const FIRST_SEED = 3_305_118;

export function AccuracyTestPage() {
  const [seed, setSeed] = useState(FIRST_SEED);
  const [run, setRun] = useState<FinishedRun | null>(null);
  const surface = useRef<SurfaceHandle | null>(null);

  const text = useMemo(() => accuracyText(seed, 5), [seed]);

  const onFinish = useCallback((r: FinishedRun) => {
    setRun(r);
    if (isMeaningful(r.result.typed, r.result.seconds * 1000)) {
      toolCompleted('typing-accuracy-test', r.result);
    }
  }, []);

  const restart = useCallback(() => {
    setRun(null);
    setSeed((s) => s + 1);
    surface.current?.restart();
    toolRestarted('typing-accuracy-test');
  }, []);

  const res = run?.result ?? null;
  const usable = res ? isMeaningful(res.typed, res.seconds * 1000) : false;

  const analysis = useMemo(
    () => (run ? analyseKeys(run.result.keyAgg, run.strokes) : null),
    [run],
  );

  /**
   * The reading, accuracy first. Ordered so the most actionable sentence is
   * the one at the top, rather than whichever test happened to be written
   * first in the source.
   */
  const notes = useMemo(() => {
    if (!res) return [];
    const out = [accuracyBand(res.acc).note];
    if (res.acc >= 95 && res.backspaces > res.typed * 0.12) {
      out.push('You are correcting a great deal for this accuracy, which usually means second-guessing text that was already right. Trusting the first attempt is worth several WPM on its own.');
    }
    if (res.uncorrected > 0) {
      out.push(`${res.uncorrected} ${res.uncorrected === 1 ? 'mistake' : 'mistakes'} made it into the finished text. Those are the expensive ones: somebody else finds them later.`);
    }
    if (analysis && !analysis.weakest.length && analysis.sampled >= 8) {
      out.push('No individual key stood out. Your errors were spread rather than concentrated, which points at pace rather than at any particular reach.');
    }
    return out;
  }, [res, analysis]);

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="Typing accuracy test">
        {!run && (
          <>
            <ToolControls><RestartButton onClick={restart} label="New passage" /></ToolControls>
            <p className="tool-brief">
              Five sentences, with capitals and punctuation. There is no clock. Type them as
              accurately as you can, and correct anything you notice, exactly as you would in
              real work.
            </p>
            <TypingSurface
              text={text}
              label="Typing accuracy test"
              showLiveWpm={false}
              onFinish={onFinish}
              onStart={() => toolStarted('typing-accuracy-test')}
              surfaceRef={(h) => { surface.current = h; }}
              idleHint="Click the text to begin. Nothing is timing you. Accuracy is the score here."
            />
          </>
        )}

        {res && !usable && <TooShort onRetry={restart} />}

        {res && usable && analysis && (
          <ResultPanel title="Your accuracy">
            <Headline value={<>{res.acc}<i className="tt-pct">%</i></>} unit="accuracy">
              {res.correct} of {res.typed} keystrokes landed on the first attempt.{' '}
              {accuracyBand(res.acc).label}. You used {res.backspaces}{' '}
              {res.backspaces === 1 ? 'backspace' : 'backspaces'} and left {res.uncorrected}{' '}
              {res.uncorrected === 1 ? 'mistake' : 'mistakes'} in the finished text.
            </Headline>

            <StatGrid stats={[
              { value: res.correct, label: 'Correct characters', hint: 'right on the first attempt' },
              { value: res.typed - res.correct, label: 'Incorrect characters', hint: 'wrong key, whether or not you fixed it' },
              { value: res.backspaces, label: 'Corrections', hint: 'backspaces you spent putting things right' },
              { value: res.wpm, label: 'Speed', hint: 'reported second, on purpose' },
            ]} />

            <Findings title="What that means" notes={notes} />

            <div className="tt-diagnosis">
              <div className="tt-diagnosis-col">
                <KeyBars
                  title="Keys that produced the errors"
                  unit="missed"
                  rows={analysis.weakest
                    .filter((k) => k.errors > 0)
                    .map((k) => ({
                      label: k.label,
                      pct: (k.errors / k.attempts) * 100,
                      value: `${Math.round((k.errors / k.attempts) * 100)}%`,
                      sub: `${k.errors}/${k.attempts}`,
                    }))}
                />
                {analysis.weakest.filter((k) => k.errors > 0).length === 0 && (
                  <p className="tt-handoff">
                    No key was missed often enough to name. Either this run was clean, or it was
                    too short to see a pattern. The{' '}
                    <Link to="/tools/weak-key-analysis">weak-key analysis</Link> uses a passage
                    built to see every letter several times, which is what it takes to be sure.
                  </p>
                )}
              </div>

              <div className="tt-diagnosis-col">
                {analysis.confusions.length > 0 && (
                  <div className="tt-panel">
                    <h3>What you typed instead</h3>
                    <ol className="tool-confusions">
                      {analysis.confusions.map((c) => (
                        <li key={`${c.expected}${c.typed}`}>
                          <kbd>{c.expected === ' ' ? 'space' : c.expected}</kbd>
                          <i className="tt-arrow" aria-hidden>became</i>
                          <kbd>{c.typed === ' ' ? 'space' : c.typed}</kbd>
                          <span className="tt-bar-v is-soft">{c.count}×</span>
                        </li>
                      ))}
                    </ol>
                    <p className="tt-handoff">
                      A repeated swap is usually a finger sitting one key off its home-row
                      anchor, not a gap in what you know.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="tt-again">
              <button type="button" className="btn btn-primary btn-big" onClick={restart}>
                New passage
              </button>
              <SaveResult tool="typing-accuracy-test" source="typing-accuracy-test" result={res} />
              <ToolCta tool="typing-accuracy-test" to="/onboarding" kind="soft">
                Practise these keys in KeyTopia
              </ToolCta>
            </div>

            <p className="tt-handoff">
              To find out which keys are behind this properly, rather than from whichever letters
              five sentences happened to contain, run the{' '}
              <Link to="/tools/weak-key-analysis">weak-key analysis</Link>. To build the habit,
              the <Link to="/tools/daily-typing-exercise">daily exercise</Link> takes about ten
              minutes.
            </p>
          </ResultPanel>
        )}
      </section>
    </ToolPage>
  );
}

export default AccuracyTestPage;
