/**
 * `/tools/timed-typing-challenge`
 *
 * The speed test with a game's manners: a longer range of clocks including a
 * five-minute endurance run, a score that locks the instant time expires, and
 * a result you can copy and send to somebody.
 *
 * No leaderboard, and no invented one. An anonymous public board with no
 * accounts behind it ranks whoever is most willing to script a browser, and a
 * fabricated one would be worse than none. KeyTopia's real boards live inside
 * the app, where a result comes from an account.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import {
  DurationPicker, RestartButton, TypingSurface,
  type FinishedRun, type SurfaceHandle,
} from '../../components/tools/TypingSurface';
import { Headline, ResultPanel, StatGrid, Findings, TooShort, readRun } from '../../components/tools/ResultCards';
import { SaveResult } from '../../components/tools/SaveResult';
import { toolByPath } from '../../lib/tools/registry';
import { speedTestText } from '../../lib/tools/text';
import { isMeaningful, speedBand } from '../../lib/tools/metrics';
import { toolCompleted, toolRestarted, toolStarted } from '../../lib/tools/analytics';
import { SITE_NAME, absUrl } from '../../lib/seo/site';

const DURATIONS = [15, 30, 60, 120, 300] as const;
type Duration = (typeof DURATIONS)[number];

const TOOL = toolByPath('/tools/timed-typing-challenge')!;
const FIRST_SEED = 7_781_233;

/** The one-line summary the copy button puts on the clipboard. */
function shareLine(wpm: number, acc: number, seconds: number): string {
  const clock = seconds < 60 ? `${seconds}-second` : `${seconds / 60}-minute`;
  return `${wpm} WPM at ${acc}% accuracy on the ${clock} ${SITE_NAME} typing challenge. ${absUrl('/tools/timed-typing-challenge')}`;
}

export function TimedChallengePage() {
  const [duration, setDuration] = useState<Duration>(60);
  const [seed, setSeed] = useState(FIRST_SEED);
  const [run, setRun] = useState<FinishedRun | null>(null);
  const [copied, setCopied] = useState(false);
  const surface = useRef<SurfaceHandle | null>(null);

  const text = useMemo(() => speedTestText(seed, duration), [seed, duration]);

  const onFinish = useCallback((r: FinishedRun) => {
    setRun(r);
    setCopied(false);
    if (isMeaningful(r.result.typed, r.result.seconds * 1000)) {
      toolCompleted('timed-typing-challenge', r.result, { challenge_s: duration });
    }
  }, [duration]);

  const restart = useCallback(() => {
    setRun(null);
    setCopied(false);
    setSeed((s) => s + 1);
    surface.current?.restart();
    toolRestarted('timed-typing-challenge');
  }, []);

  const pick = useCallback((d: Duration) => {
    setRun(null);
    setCopied(false);
    setDuration(d);
  }, []);

  const copy = useCallback(async () => {
    if (!run) return;
    const line = shareLine(run.result.wpm, run.result.acc, run.result.seconds);
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
    } catch {
      // Clipboard access can be refused outright (an insecure origin, a
      // permissions policy). Saying so beats a button that silently does
      // nothing, so the text is shown for manual copying instead.
      setCopied(false);
      window.prompt('Copy your result:', line);
    }
  }, [run]);

  const res = run?.result ?? null;
  const usable = res ? isMeaningful(res.typed, res.seconds * 1000) : false;

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="Timed typing challenge">
        <DurationPicker options={DURATIONS} value={duration} onChange={pick} label="Challenge length">
          <RestartButton onClick={restart} />
        </DurationPicker>

        {!run && (
          <TypingSurface
            text={text}
            seconds={duration}
            label={`${duration}-second typing challenge`}
            onFinish={onFinish}
            onStart={() => toolStarted('timed-typing-challenge', duration)}
            surfaceRef={(h) => { surface.current = h; }}
            idleHint="Click the text and go. The countdown starts on your first keystroke and stops on its own."
          />
        )}

        {res && !usable && <TooShort onRetry={restart} />}

        {res && usable && (
          <ResultPanel title="Time. Here is your score.">
            <Headline value={res.wpm} unit="words per minute">
              {duration < 60 ? `${duration} seconds` : `${duration / 60} minutes`} at {res.acc}%
              accuracy. {speedBand(res.wpm).label}. The clock stopped when it stopped, so nothing
              typed after that counted either way.
            </Headline>

            <StatGrid stats={[
              { value: res.acc, suffix: '%', label: 'Accuracy', hint: 'keystrokes right first time', meter: res.acc, tone: res.acc < 95 ? 'warn' : 'good' },
              { value: res.words, label: 'Correct words', hint: 'whole words with nothing wrong in them' },
              { value: res.typed, label: 'Characters typed', hint: 'every keystroke you made' },
              { value: res.uncorrected, label: 'Mistakes left', hint: 'errors still in the finished text' },
            ]} />

            <Findings title="What that means" notes={readRun(res)} />

            <div className="tt-again">
              <button type="button" className="btn btn-primary btn-big" onClick={restart}>
                Go again
              </button>
              <button type="button" className="btn btn-soft" onClick={copy}>
                {copied ? 'Copied' : 'Copy result'}
              </button>
              <SaveResult tool="timed-typing-challenge" source="timed-typing-challenge" result={res} />
            </div>

            {copied && <p className="tool-saved" role="status">Your result is on the clipboard.</p>}

            <p className="tt-handoff">
              Want a real opponent rather than a clock? KeyTopia has{' '}
              <Link to="/typing-races">races against rivals with actual habits</Link>, ghost races
              against your own best run, and private rooms you open with a join code. Or see how
              this score sits <Link to="/tools/typing-speed-by-age">against published benchmarks</Link>.
            </p>

            <div className="pub-cta-row">
              <ToolCta tool="timed-typing-challenge" to="/onboarding">
                Practise the keys that slowed you down
              </ToolCta>
            </div>
          </ResultPanel>
        )}
      </section>
    </ToolPage>
  );
}

export default TimedChallengePage;
