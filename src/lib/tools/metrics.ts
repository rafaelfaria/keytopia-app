/**
 * The one place the free tools do arithmetic.
 *
 * Eight tools that each computed "words per minute" their own way would
 * disagree with each other and with the rest of KeyTopia, and the first person
 * to notice would be a visitor who took the speed test and the timed challenge
 * back to back. So every figure any tool prints comes from this module, and
 * this module is a thin, guarded layer over `src/lib/metrics.ts` — the same
 * `wpmOf` the lessons, games and races have always used.
 *
 * Nothing here touches a browser global: the tool pages are prerendered in
 * Node, and these functions run on both sides.
 */

import { wpmOf, round1 } from '../metrics';

/** The conventional "word" in every WPM figure on the internet: five characters. */
export const CHARS_PER_WORD = 5;

/**
 * Below this, a measurement is noise rather than a slow result.
 *
 * `wpmOf` already refuses to divide by anything under half a second. A typing
 * test needs a wider floor: a run that lasted 900ms produced one or two
 * keystrokes, and (2/5)/(0.9/60) is 26 WPM, a number with no meaning attached
 * to it. Tools show "not enough typing" instead.
 */
export const MIN_MEASURABLE_MS = 1500;
/** And a test with fewer strokes than this cannot characterise anyone. */
export const MIN_MEASURABLE_STROKES = 10;

/** NaN, Infinity and -0 all render as garbage. Everything public goes through here. */
export function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Gross (raw) WPM: every keystroke counts, mistakes included.
 *
 * `(characters / 5) / minutes` — the formula the tool pages print verbatim.
 */
export function grossWpm(charsTyped: number, ms: number): number {
  if (!(charsTyped > 0) || !(ms > 0)) return 0;
  return round1(finite(wpmOf(charsTyped, ms)));
}

/**
 * Net WPM the way the free tools define it: the same formula applied to the
 * characters that landed in a correctly typed word.
 *
 * This is KeyTopia's existing scoring rule (see `Engine.correctChars`), not a
 * second definition invented for the tools, which is why a tool result and a
 * lesson result for identical typing agree.
 */
export function netWpm(correctChars: number, ms: number): number {
  if (!(correctChars > 0) || !(ms > 0)) return 0;
  return round1(finite(wpmOf(correctChars, ms)));
}

/**
 * The textbook net-WPM correction, used only by the calculator, where the user
 * supplies a raw count and an error count rather than a keystroke log:
 *
 *   net = gross − (uncorrected errors / minutes)
 *
 * Kept separate from `netWpm` and labelled as such wherever it appears, because
 * quietly mixing the two definitions is exactly the confusion this module
 * exists to prevent. Never negative: a five-word attempt with nine errors is a
 * bad attempt, not a negative speed.
 */
export function netWpmFromErrors(grossWpmValue: number, errors: number, minutes: number): number {
  if (!(minutes > 0)) return 0;
  const penalty = Math.max(0, errors) / minutes;
  return round1(Math.max(0, finite(grossWpmValue) - finite(penalty)));
}

/** Words per minute from a word count the user typed in themselves. */
export function wpmFromWords(words: number, seconds: number): number {
  if (!(words > 0) || !(seconds > 0)) return 0;
  return round1(finite((words / (seconds / 60))));
}

/** Characters per minute. Printed alongside WPM so the ×5 relationship is visible. */
export function cpm(charsTyped: number, ms: number): number {
  if (!(charsTyped > 0) || !(ms > 0)) return 0;
  return Math.round(finite(charsTyped / (ms / 60000)));
}

/** Share of keystrokes correct on the first attempt, 0–100, one decimal. */
export function accuracyPct(correct: number, typed: number): number {
  if (!(typed > 0)) return 0;
  const pct = (Math.max(0, Math.min(correct, typed)) / typed) * 100;
  return Math.round(finite(pct) * 10) / 10;
}

/** Whether a finished run said anything about the person who typed it. */
export function isMeaningful(strokes: number, ms: number): boolean {
  return strokes >= MIN_MEASURABLE_STROKES && ms >= MIN_MEASURABLE_MS;
}

/**
 * Time entered by hand, normalised to seconds.
 *
 * Returns null rather than 0 for anything unusable, so a calculator can tell
 * "you have not filled this in" apart from "you asked for a division by zero".
 * The upper bound is a day: a typing test that ran for a week is a typo.
 */
export function secondsFromInput(value: number, unit: 'seconds' | 'minutes'): number | null {
  const n = unit === 'minutes' ? value * 60 : value;
  if (!Number.isFinite(n) || n <= 0 || n > 86_400) return null;
  return n;
}

// ── Plain-English readings ─────────────────────────────────────────────────
//
// Thresholds live in code rather than in prose so that every tool draws the
// same line in the same place, and so the boundaries can be read and argued
// with. They are anchored on the largest published measurement of modern
// typing (Dhakal et al. 2018, mean 51.6 WPM) — see src/lib/tools/benchmarks.ts.

export interface Band { min: number; label: string; note: string }

export const SPEED_BANDS: Band[] = [
  { min: 0, label: 'Getting started', note: 'Hunt-and-peck territory. The single biggest gain available to you is learning where the keys are without looking.' },
  { min: 20, label: 'Building', note: 'Faster than handwriting, which is the threshold where typing stops slowing your thinking down.' },
  { min: 35, label: 'Functional', note: 'Comfortable for schoolwork and everyday writing. Most people who never trained formally stop here.' },
  { min: 50, label: 'Around average', note: 'At or above the 51.6 WPM mean measured across 168,000 people in the largest study of modern typing.' },
  { min: 70, label: 'Fast', note: 'Well above average. Speeds like this usually mean consistent finger use rather than raw hand speed.' },
  { min: 90, label: 'Very fast', note: 'The territory of trained touch typists working at full pace.' },
  { min: 110, label: 'Exceptional', note: 'The top of the measured distribution. Fewer than one typist in a hundred sustains this.' },
];

export function speedBand(wpm: number): Band {
  let out = SPEED_BANDS[0];
  for (const b of SPEED_BANDS) if (wpm >= b.min) out = b;
  return out;
}

export const ACCURACY_BANDS: Band[] = [
  { min: 0, label: 'Needs attention', note: 'More than one keystroke in ten is missing its target. Slow right down: at this rate practice is reinforcing the errors.' },
  { min: 90, label: 'Workable', note: 'Usable, but you are spending real time on corrections. Every point you add here is speed you get back.' },
  { min: 95, label: 'Good foundation', note: 'Above the line where practice starts building the right habit rather than an approximate one.' },
  { min: 98, label: 'Strong', note: 'At or better than the average finished accuracy measured in large-scale typing research. You have earned the right to push the pace.' },
  { min: 99.5, label: 'Excellent', note: 'Near-perfect. Speed is now the only thing left to work on.' },
];

export function accuracyBand(acc: number): Band {
  let out = ACCURACY_BANDS[0];
  for (const b of ACCURACY_BANDS) if (acc >= b.min) out = b;
  return out;
}

/** Coarse buckets for analytics, so no exact score is ever reported. */
export function wpmBucket(wpm: number): string {
  if (wpm < 20) return '0-19';
  if (wpm < 35) return '20-34';
  if (wpm < 50) return '35-49';
  if (wpm < 70) return '50-69';
  if (wpm < 90) return '70-89';
  return '90+';
}

export function accBucket(acc: number): string {
  if (acc < 85) return '0-84';
  if (acc < 92) return '85-91';
  if (acc < 96) return '92-95';
  if (acc < 99) return '96-98';
  return '99+';
}
