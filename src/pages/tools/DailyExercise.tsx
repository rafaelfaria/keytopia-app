/**
 * `/tools/daily-typing-exercise`
 *
 * One exercise per calendar day, identical for everyone, with no server
 * involved: the date is the seed, so every browser that asks for the same day
 * generates the same passage character for character.
 *
 * The date is resolved after mount rather than during render. This page is
 * prerendered at build time, and a build-time date baked into the static HTML
 * would be wrong for every reader from the following morning onwards. The
 * prerendered document therefore carries the explanation, the FAQs and the
 * whole supporting article, which is what a crawler is there for, and the
 * exercise itself arrives on mount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import {
  RestartButton, ToolControls, TypingSurface,
  type FinishedRun, type SurfaceHandle,
} from '../../components/tools/TypingSurface';
import { Headline, ResultPanel, StatGrid, Findings, TooShort, readRun } from '../../components/tools/ResultCards';
import { SaveResult } from '../../components/tools/SaveResult';
import { toolByPath } from '../../lib/tools/registry';
import { dailyExercise, dayKey } from '../../lib/tools/text';
import { isMeaningful } from '../../lib/tools/metrics';
import { dailyStreak, loadState, recordDaily } from '../../lib/tools/storage';
import { toolCompleted, toolRestarted, toolStarted } from '../../lib/tools/analytics';
import { buildToolPath, readDay } from '../../lib/tools/deepLink';
import { ShareLink } from '../../components/tools/ShareLink';

const TOOL = toolByPath('/tools/daily-typing-exercise')!;

function longDate(day: string): string {
  // Parsed as local midnight rather than through `new Date(day)`, which reads a
  // bare YYYY-MM-DD as UTC and can therefore print yesterday west of Greenwich.
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function DailyExercisePage() {
  const [params] = useSearchParams();
  // `?day=2026-09-07` opens that day's exercise instead of today's. For a
  // teacher setting Monday's warm-up, and for any link that has to keep meaning
  // the same thing after it is sent. It is deliberately view-only: a run on
  // another day never touches the streak, because a streak you can backfill
  // from a URL is not a record of showing up.
  const linkedDay = readDay(params, 'day');

  const [today, setToday] = useState<string | null>(null);
  const [run, setRun] = useState<FinishedRun | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestToday, setBestToday] = useState<{ wpm: number; acc: number } | null>(null);
  const [done, setDone] = useState(0);
  const surface = useRef<SurfaceHandle | null>(null);

  // Clock and storage, both browser-only, both read once on mount.
  useEffect(() => {
    const day = dayKey();
    setToday(day);
    const state = loadState();
    setStreak(dailyStreak(state.daily));
    setBestToday(state.daily[day] ?? null);
    setDone(Object.keys(state.daily).length);
  }, []);

  // A linked day needs no clock, so it renders during the prerender too.
  const shownDay = linkedDay ?? today;
  const isToday = !linkedDay || linkedDay === today;
  const exercise = useMemo(() => (shownDay ? dailyExercise(shownDay) : null), [shownDay]);

  const onFinish = useCallback((r: FinishedRun) => {
    setRun(r);
    if (!today || !isToday || !isMeaningful(r.result.typed, r.result.seconds * 1000)) return;
    const state = recordDaily(today, r.result.wpm, r.result.acc);
    setStreak(dailyStreak(state.daily));
    setBestToday(state.daily[today] ?? null);
    setDone(Object.keys(state.daily).length);
    toolCompleted('daily-typing-exercise', r.result, { day: today });
  }, [today, isToday]);

  const restart = useCallback(() => {
    setRun(null);
    surface.current?.restart();
    toolRestarted('daily-typing-exercise');
  }, []);

  const res = run?.result ?? null;
  const usable = res ? isMeaningful(res.typed, res.seconds * 1000) : false;

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="Daily typing exercise">
        {!exercise && (
          // The prerendered state. Real content, not a spinner: this is what a
          // crawler and a reader with no JavaScript actually get.
          <div className="tool-daily-head">
            <h2>Today&apos;s exercise</h2>
            <p className="tool-brief">
              A new exercise every calendar day, the same one for everybody, generated from the
              date itself rather than fetched from anywhere. It takes three to ten minutes
              depending on how fast you type, and it mixes common words, full sentences with
              punctuation, and the combinations people habitually fumble.
            </p>
          </div>
        )}

        {exercise && (
          <>
            <div className="tool-daily-head">
              <div>
                <p className="tool-daily-date">
                  {longDate(exercise.day)}{!isToday && ' (linked day)'}
                </p>
                <h2>{exercise.title}</h2>
                <p className="tool-daily-focus">
                  Today&apos;s focus: {exercise.focus}. About {exercise.minutes[1]} to{' '}
                  {exercise.minutes[0]} minutes.
                </p>
              </div>
              <dl className="tool-streak">
                <div>
                  <dt>{streak}</dt>
                  <dd>day {streak === 1 ? 'streak' : 'streak'}</dd>
                </div>
                <div>
                  <dt>{done}</dt>
                  <dd>days done</dd>
                </div>
              </dl>
            </div>

            {!isToday && (
              <p className="tool-notice" role="note">
                You are looking at a specific day rather than today&apos;s exercise, so this run
                will not count towards a streak.{' '}
                <Link to={TOOL.path}>Open today&apos;s instead</Link>.
              </p>
            )}

            {isToday && bestToday && !run && (
              <p className="tool-saved" role="status">
                You have already done today&apos;s exercise, at {bestToday.wpm} WPM and{' '}
                {bestToday.acc}% accuracy. Doing it again is fine: only your best run of the day
                is kept, so a second attempt can never make today look worse.
              </p>
            )}

            {!run && (
              <>
                {/* No new passage: today's exercise is today's exercise. This
                    clears the attempt and starts the same text again. */}
                <ToolControls><RestartButton onClick={restart} label="Start over" /></ToolControls>
                <TypingSurface
                text={exercise.text}
                label={`Daily typing exercise, ${exercise.day}`}
                onFinish={onFinish}
                onStart={() => toolStarted('daily-typing-exercise')}
                surfaceRef={(h) => { surface.current = h; }}
                  idleHint="Click the text to begin. There is no clock. Look at accuracy before speed when you finish."
                />
              </>
            )}
          </>
        )}

        {res && !usable && <TooShort onRetry={restart} />}

        {res && usable && (
          <ResultPanel title="Done for today">
            <Headline value={res.wpm} unit="words per minute">
              {res.acc}% accuracy over {res.typed} keystrokes, in{' '}
              {Math.round(res.seconds)} seconds.{' '}
              {streak > 1
                ? `That is ${streak} days in a row.`
                : 'That is today counted. Come back tomorrow and it becomes a streak.'}
            </Headline>

            <StatGrid stats={[
              { value: res.acc, suffix: '%', label: 'Accuracy', hint: 'keystrokes right first time', meter: res.acc, tone: res.acc < 95 ? 'warn' : 'good' },
              { value: streak, label: 'Day streak', hint: 'consecutive days finished' },
              { value: res.uncorrected, label: 'Mistakes left', hint: 'errors still in the finished text' },
              { value: bestToday?.wpm ?? res.wpm, label: 'Best today', hint: 'only your best run is kept' },
            ]} />

            <Findings title="What to do tomorrow" notes={[
              ...readRun(res),
              res.acc < 95
                ? 'Tomorrow, run it about ten per cent slower rather than trying harder. Accuracy below 95% means practice is reinforcing the errors as much as correcting them.'
                : 'Tomorrow, push slightly past what feels safe. Above 95% accuracy you have room to spend on pace.',
            ]} />

            <div className="tt-again">
              <button type="button" className="btn btn-primary btn-big" onClick={restart}>
                Type it again
              </button>
              <SaveResult tool="daily-typing-exercise" source="daily-typing-exercise" result={res} />
              <ToolCta tool="daily-typing-exercise" to="/onboarding" kind="soft">
                Get a plan instead of a passage
              </ToolCta>
            </div>

            <ShareLink
              path={buildToolPath(TOOL.path, { day: exercise?.day })}
              label="Copy a link to this day"
              hint="Sends somebody this exact exercise, on any day they open it. Set it as a class warm-up, or keep it to come back to."
            />

            <p className="tt-handoff">
              Your streak and your best runs live in this browser, and nowhere else. To chart
              them, see the <Link to="/tools/typing-progress-tracker">progress tracker</Link>. To
              find out which keys are costing you the difference, the{' '}
              <Link to="/tools/weak-key-analysis">weak-key analysis</Link> is worth a few minutes
              once a week.
            </p>
          </ResultPanel>
        )}
      </section>
    </ToolPage>
  );
}

export default DailyExercisePage;
