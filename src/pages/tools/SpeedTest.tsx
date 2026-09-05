/**
 * `/tools/typing-speed-test`
 *
 * The suite's front door: pick a clock, type, get a number. Everything on this
 * page after the result exists to hand you on to the tool that answers the
 * question the number raised.
 *
 * Distinct from `/typing-test`, which is the deep single-page diagnostic with
 * rhythm and consistency analysis. This one is deliberately narrower: speed,
 * accuracy, a session best, and a route into the other seven tools.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import {
  DurationPicker, RestartButton, TypingSurface,
  type FinishedRun, type SurfaceHandle,
} from '../../components/tools/TypingSurface';
import { Headline, ResultPanel, StatGrid, Findings, TooShort, readRun } from '../../components/tools/ResultCards';
import { SaveResult } from '../../components/tools/SaveResult';
import { toolByPath } from '../../lib/tools/registry';
import { speedTestText } from '../../lib/tools/text';
import { cpm, isMeaningful, speedBand } from '../../lib/tools/metrics';
import { toolCompleted, toolRestarted, toolStarted } from '../../lib/tools/analytics';
import { buildToolPath, readOneOf } from '../../lib/tools/deepLink';
import { ShareLink } from '../../components/tools/ShareLink';
import { saveAnonResult } from '../../lib/starter';
import type { SessionResult } from '../../lib/types';

const DURATIONS = [15, 30, 60, 120] as const;
type Duration = (typeof DURATIONS)[number];

const TOOL = toolByPath('/tools/typing-speed-test')!;

/**
 * A fixed starting seed so the prerendered passage is byte-identical on every
 * build. It only ever advances on a restart, in the browser.
 */
const FIRST_SEED = 4_120_907;

export function SpeedTestPage() {
  const [params] = useSearchParams();
  // `?duration=30`. Read once, as the initial value, so the URL sets the
  // starting state without fighting the reader for the buttons afterwards.
  const [duration, setDuration] = useState<Duration>(
    () => readOneOf(params, 'duration', DURATIONS) ?? 60,
  );
  const [seed, setSeed] = useState(FIRST_SEED);
  const [run, setRun] = useState<FinishedRun | null>(null);
  const [best, setBest] = useState<SessionResult | null>(null);
  const [previous, setPrevious] = useState<SessionResult | null>(null);
  const surface = useRef<SurfaceHandle | null>(null);

  const text = useMemo(() => speedTestText(seed, duration), [seed, duration]);

  const onFinish = useCallback((r: FinishedRun) => {
    setRun(r);
    const res = r.result;
    if (!isMeaningful(res.typed, res.seconds * 1000)) return;

    setPrevious(best);
    setBest((b) => (!b || res.wpm > b.wpm ? res : b));
    // Park the summary so that if this visitor makes an account later, their
    // first lesson is pitched at the speed they just demonstrated. Summary
    // only: no keystrokes, no text. See src/lib/starter.ts.
    saveAnonResult(res);
    toolCompleted('typing-speed-test', res);
  }, [best]);

  const restart = useCallback(() => {
    setRun(null);
    setSeed((s) => s + 1);
    surface.current?.restart();
    toolRestarted('typing-speed-test');
  }, []);

  const pick = useCallback((d: Duration) => {
    setRun(null);
    setDuration(d);
  }, []);

  const res = run?.result ?? null;
  const usable = res ? isMeaningful(res.typed, res.seconds * 1000) : false;

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="Typing speed test">
        <DurationPicker options={DURATIONS} value={duration} onChange={pick}>
          <RestartButton onClick={restart} />
        </DurationPicker>

        {!run && (
          <TypingSurface
            text={text}
            seconds={duration}
            label={`${duration}-second typing speed test`}
            onFinish={onFinish}
            onStart={() => toolStarted('typing-speed-test', duration)}
            surfaceRef={(h) => { surface.current = h; }}
          />
        )}

        {res && !usable && <TooShort onRetry={restart} />}

        {res && usable && (
          <ResultPanel title="Your result">
            <Headline value={res.wpm} unit="words per minute">
              {res.correct} correct characters in {res.seconds} seconds, at {res.acc}% accuracy,
              with {res.uncorrected} {res.uncorrected === 1 ? 'mistake' : 'mistakes'} left
              uncorrected. That is {speedBand(res.wpm).label.toLowerCase()}.
            </Headline>

            <StatGrid stats={[
              {
                value: res.acc, suffix: '%', label: 'Accuracy',
                hint: 'keystrokes right first time',
                meter: res.acc, tone: res.acc < 95 ? 'warn' : 'good',
              },
              { value: res.raw, label: 'Gross WPM', hint: 'every keystroke, mistakes included' },
              { value: res.typed, label: 'Characters typed', hint: `${cpm(res.typed, res.seconds * 1000)} per minute` },
              { value: res.uncorrected, label: 'Mistakes left', hint: 'errors still in the finished text' },
            ]} />

            <Findings title="What that means" notes={readRun(res)} />

            {best && (
              <p className="tool-best" role="status">
                Best this session: <strong>{best.wpm} WPM</strong> at {best.acc}%.
                {previous && previous !== best && (
                  <> Your previous run was {previous.wpm} WPM, so that is{' '}
                    {Math.abs(Math.round((res.wpm - previous.wpm) * 10) / 10)} WPM{' '}
                    {res.wpm >= previous.wpm ? 'faster' : 'slower'}. Runs swing by five to ten
                    WPM either way, so one comparison is not a trend.
                  </>
                )}
              </p>
            )}

            <div className="tt-again">
              <button type="button" className="btn btn-primary btn-big" onClick={restart}>
                New passage
              </button>
              <SaveResult tool="typing-speed-test" source="typing-speed-test" result={res} />
              <ToolCta tool="typing-speed-test" to="/onboarding" kind="soft">
                Turn this into a training plan
              </ToolCta>
            </div>

            <ShareLink
              path={buildToolPath(TOOL.path, { duration })}
              hint={`Opens this test already set to ${duration < 60 ? `${duration} seconds` : `${duration / 60} minutes`}.`}
            />

            <p className="tt-handoff">
              Two questions this number raises, and where they are answered:{' '}
              <Link to="/tools/typing-speed-by-age">how it compares for your age</Link>, and{' '}
              <Link to="/tools/weak-key-analysis">which keys produced it</Link>. For rhythm,
              consistency and hesitation analysis on top of speed, the fuller{' '}
              <Link to="/typing-test">diagnostic typing test</Link> goes deeper than this page does.
            </p>
          </ResultPanel>
        )}
      </section>
    </ToolPage>
  );
}

export default SpeedTestPage;
