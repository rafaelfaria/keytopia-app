/**
 * `/tools/wpm-calculator`
 *
 * Not a typing test: a calculator for figures somebody already has. You can
 * count words or characters, in seconds or minutes, and it shows the formula
 * next to the answer so the arithmetic is checkable rather than magic.
 *
 * The validation is the interesting part. Zero minutes is a division by zero,
 * a negative word count has no meaning, and a text field can hold "abc". Each
 * of those has to produce a sentence saying which field needs fixing, because
 * a calculator that silently prints Infinity or NaN is worse than one that
 * refuses.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import { toolByPath } from '../../lib/tools/registry';
import {
  CHARS_PER_WORD, accuracyBand, cpm, grossWpm, netWpmFromErrors, secondsFromInput, speedBand,
} from '../../lib/tools/metrics';
import { track } from '../../lib/analytics/ga4';

const TOOL = toolByPath('/tools/wpm-calculator')!;

type Basis = 'words' | 'characters';
type Unit = 'seconds' | 'minutes';

interface Outcome {
  gross: number;
  net: number;
  cpm: number;
  characters: number;
  minutes: number;
}

/**
 * Parse a form field into a number, keeping "empty" distinguishable from
 * "zero": an untouched field is not an error the reader needs telling about.
 */
function parse(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function WpmCalculatorPage() {
  const [basis, setBasis] = useState<Basis>('words');
  const [amount, setAmount] = useState('');
  const [time, setTime] = useState('');
  const [unit, setUnit] = useState<Unit>('minutes');
  const [errors, setErrors] = useState('');

  const { outcome, problem } = useMemo((): { outcome: Outcome | null; problem: string | null } => {
    const a = parse(amount);
    const t = parse(time);
    if (a === null || t === null) return { outcome: null, problem: null };
    if (Number.isNaN(a)) return { outcome: null, problem: `Enter a number of ${basis}.` };
    if (Number.isNaN(t)) return { outcome: null, problem: `Enter a time in ${unit}.` };
    if (a <= 0) return { outcome: null, problem: `The number of ${basis} has to be more than zero.` };

    const seconds = secondsFromInput(t, unit);
    if (seconds === null) {
      return {
        outcome: null,
        problem: t <= 0
          ? 'The time has to be more than zero. Dividing by zero minutes has no answer.'
          : 'That time is longer than a day. Check the units.',
      };
    }

    const e = parse(errors);
    if (e !== null && (Number.isNaN(e) || e < 0)) {
      return { outcome: null, problem: 'The error count has to be zero or more, or left empty.' };
    }

    const characters = basis === 'words' ? a * CHARS_PER_WORD : a;
    const ms = seconds * 1000;
    const minutes = seconds / 60;
    const gross = grossWpm(characters, ms);
    return {
      outcome: {
        gross,
        net: netWpmFromErrors(gross, e ?? 0, minutes),
        cpm: cpm(characters, ms),
        characters,
        minutes: Math.round(minutes * 1000) / 1000,
      },
      problem: null,
    };
  }, [amount, time, unit, basis, errors]);

  // One event the first time a calculation becomes valid, not one per
  // keystroke: this recomputes on every character typed into every field.
  const reported = useRef(false);
  useEffect(() => {
    if (outcome && !reported.current) {
      reported.current = true;
      track('free_tool_completed', { tool: 'wpm-calculator', basis, unit });
    } else if (!outcome) {
      reported.current = false;
    }
  }, [outcome, basis, unit]);

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="WPM calculator">
        <form className="tool-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="tool-field">
            <legend>What did you count?</legend>
            <div className="tt-controls" role="group" aria-label="Counting basis">
              {(['words', 'characters'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`tt-dur${b === basis ? ' is-on' : ''}`}
                  aria-pressed={b === basis}
                  onClick={() => setBasis(b)}
                >
                  {b === 'words' ? 'Words' : 'Characters'}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="tool-form-row">
            <label className="tool-label" htmlFor="calc-amount">
              {basis === 'words' ? 'Words typed' : 'Characters typed'}
              <input
                id="calc-amount"
                className="tool-input"
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={basis === 'words' ? 'e.g. 60' : 'e.g. 300'}
              />
            </label>

            <label className="tool-label" htmlFor="calc-time">
              Time taken
              <input
                id="calc-time"
                className="tool-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder={unit === 'minutes' ? 'e.g. 1' : 'e.g. 60'}
              />
            </label>

            <label className="tool-label" htmlFor="calc-unit">
              Unit
              <select
                id="calc-unit"
                className="tool-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
              >
                <option value="minutes">Minutes</option>
                <option value="seconds">Seconds</option>
              </select>
            </label>

            <label className="tool-label" htmlFor="calc-errors">
              Uncorrected errors <em>(optional)</em>
              <input
                id="calc-errors"
                className="tool-input"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={errors}
                onChange={(e) => setErrors(e.target.value)}
                placeholder="e.g. 4"
              />
            </label>
          </div>
        </form>

        {/* One live region for both the answer and the refusal, so a screen
            reader is told either way rather than only on success. */}
        <div className="tool-answer" role="status" aria-live="polite">
          {problem && <p className="tool-problem">{problem}</p>}

          {!problem && !outcome && (
            <p className="tool-brief">
              Fill in an amount and a time. The answer appears here as you type, with the
              working shown.
            </p>
          )}

          {outcome && (
            <>
              <div className="tool-answer-grid">
                <div className="tool-answer-main">
                  <b>{outcome.gross}</b>
                  <span>gross WPM</span>
                </div>
                <div className="tool-answer-side">
                  <div><b>{outcome.net}</b><span>net WPM</span></div>
                  <div><b>{outcome.cpm}</b><span>characters per minute</span></div>
                </div>
              </div>

              <div className="tool-working">
                <h3>The working</h3>
                <p className="tool-formula">
                  {basis === 'words' && (
                    <>{amount} words × {CHARS_PER_WORD} = {outcome.characters} characters<br /></>
                  )}
                  {outcome.characters} ÷ {CHARS_PER_WORD} ÷ {outcome.minutes} minutes ={' '}
                  <strong>{outcome.gross} gross WPM</strong>
                </p>
                <p className="tool-formula">
                  {parse(errors) ? (
                    <>
                      {outcome.gross} − ({errors} errors ÷ {outcome.minutes} minutes) ={' '}
                      <strong>{outcome.net} net WPM</strong>
                    </>
                  ) : (
                    <>
                      With no errors entered, net WPM equals gross WPM. Add an error count to
                      apply the standard penalty of one word per uncorrected error per minute.
                    </>
                  )}
                </p>
                <p className="tool-note">
                  A &ldquo;word&rdquo; in WPM is five characters, spaces included. That is the
                  convention every typing test uses, so long words do not unfairly lower a score.
                  This page&apos;s net WPM applies the classic examination penalty; the typing
                  tests elsewhere in this suite score whole words off the finished text instead.
                  Both are stated wherever they appear, and neither is quietly substituted for
                  the other.
                </p>
              </div>

              <div className="tool-reading-out">
                <p>
                  <strong>{speedBand(outcome.gross).label}.</strong>{' '}
                  {speedBand(outcome.gross).note}
                </p>
              </div>

              <div className="tt-again">
                <ToolCta tool="wpm-calculator" to="/tools/typing-speed-test">
                  Measure it properly instead
                </ToolCta>
                <ToolCta tool="wpm-calculator" to="/tools/typing-speed-by-age" kind="soft">
                  Compare it against benchmarks
                </ToolCta>
              </div>
            </>
          )}
        </div>

        <p className="tt-handoff">
          A number you worked out from a stopwatch and a word count is only as good as those two
          inputs. For anything you want to compare or track, the{' '}
          <Link to="/tools/typing-speed-test">typing speed test</Link> counts characters exactly,
          starts the clock on your first keystroke and reports{' '}
          <Link to="/tools/typing-accuracy-test">accuracy</Link> alongside speed, which a word
          count on its own cannot give you. Every term used here is defined in the{' '}
          <Link to="/typing-glossary">typing glossary</Link>.
        </p>

        <p className="tool-note">
          {accuracyBand(98).label} accuracy is the level worth aiming at before speed. That is
          not something this calculator can measure, which is the honest limit of a page like
          this one.
        </p>
      </section>
    </ToolPage>
  );
}

export default WpmCalculatorPage;
