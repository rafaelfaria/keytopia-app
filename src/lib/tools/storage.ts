/**
 * Local persistence for the free tools.
 *
 * These pages are usable with no account, which means the only place a result
 * can live is the browser it was typed in. This is the whole store: one
 * localStorage key, a capped list of result summaries, and the day-by-day map
 * the daily exercise counts a streak from.
 *
 * What is deliberately *not* here:
 *
 *  - The typed text. A tool needs your speed, not your sentences. Nothing in
 *    this module can reconstruct what anybody wrote.
 *  - Anything identifying. No name, no email, no id that outlives the browser.
 *  - The app's own store. `src/lib/store.ts` is a zustand-persist store bound
 *    to a profile inside an account; a stranger on /tools has neither, and
 *    importing it would also drag localStorage into module scope, which the
 *    prerenderer cannot survive.
 *
 * Every function is total: private mode, a full disk and a corrupted value all
 * return the empty state rather than throwing into a render.
 */

import { dayKey, median } from '../metrics';
import { uid } from '../rng';

/** Frozen, like the other keytopia-* keys: it names data on real machines. */
const KEY = 'keytopia-tools-v1';

/** Enough history to draw a trend from; small enough to never matter. */
const MAX_RESULTS = 200;

export type ToolSource =
  | 'typing-speed-test'
  | 'typing-accuracy-test'
  | 'timed-typing-challenge'
  | 'weak-key-analysis'
  | 'daily-typing-exercise'
  | 'manual';

export interface ToolResult {
  id: string;
  /** Epoch ms. */
  t: number;
  source: ToolSource;
  wpm: number;
  /** Gross/raw WPM, mistakes included. */
  raw: number;
  /** 0–100. */
  acc: number;
  seconds: number;
  /** Uncorrected mistakes left in the text. */
  mistakes: number;
  /** Keystrokes made. */
  typed: number;
}

export interface ToolState {
  v: 1;
  results: ToolResult[];
  /** dayKey → the best run recorded for the daily exercise that day. */
  daily: Record<string, { wpm: number; acc: number }>;
}

const EMPTY: ToolState = { v: 1, results: [], daily: {} };

function read(): ToolState {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ToolState>;
    return {
      v: 1,
      results: Array.isArray(parsed.results) ? parsed.results.filter(isResult) : [],
      daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
    };
  } catch {
    return EMPTY;
  }
}

function isResult(r: unknown): r is ToolResult {
  const x = r as ToolResult;
  return !!x && typeof x.t === 'number' && Number.isFinite(x.wpm) && Number.isFinite(x.acc);
}

function write(state: ToolState): ToolState {
  if (typeof localStorage === 'undefined') return state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode, or quota. The in-memory value is still returned. */
  }
  return state;
}

export function loadState(): ToolState {
  return read();
}

/** The most recent result, for prefilling one tool from another. */
export function lastResult(): ToolResult | null {
  const { results } = read();
  return results.length ? results[results.length - 1] : null;
}

export function saveResult(r: Omit<ToolResult, 'id' | 't'> & { t?: number }): ToolResult {
  const state = read();
  const full: ToolResult = { id: uid(), t: r.t ?? Date.now(), ...r };
  const results = [...state.results, full].slice(-MAX_RESULTS);
  write({ ...state, results });
  return full;
}

export function deleteResult(id: string): ToolState {
  const state = read();
  return write({ ...state, results: state.results.filter((r) => r.id !== id) });
}

export function clearResults(): ToolState {
  const state = read();
  return write({ ...state, results: [] });
}

/**
 * Record a daily-exercise run. Only the best run of a given day is kept: the
 * point of the streak is that you showed up, and a second, worse attempt should
 * never be able to make the day look worse than the first one did.
 */
export function recordDaily(day: string, wpm: number, acc: number): ToolState {
  const state = read();
  const existing = state.daily[day];
  if (existing && existing.wpm >= wpm) return state;
  return write({ ...state, daily: { ...state.daily, [day]: { wpm, acc } } });
}

/**
 * Consecutive days ending today or yesterday.
 *
 * Yesterday counts as the end of a live streak because the day is not over
 * yet; a streak that resets at midnight punishes people for the clock rather
 * than for skipping.
 */
export function dailyStreak(daily: Record<string, unknown>, today = new Date()): number {
  let streak = 0;
  const cursor = new Date(today);
  if (!daily[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (daily[dayKey(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface ProgressSummary {
  count: number;
  latest: ToolResult | null;
  best: ToolResult | null;
  averageWpm: number;
  averageAcc: number;
  /** WPM change from the first half of the history to the second. */
  trend: number | null;
}

/**
 * The tracker's numbers.
 *
 * `trend` compares the older half of the history against the newer half, by
 * median rather than by mean, and it is worth saying why both halves of that
 * matter. Comparing the first result with the last is dominated by whichever
 * two runs happened to be flukes. Comparing the means fixes most of that but
 * not all of it: in a six-run history one exceptional day still drags the
 * newer mean up by twenty-something WPM and reports an improvement that did
 * not happen. The median of each half ignores it, which is exactly the
 * property this figure needs.
 *
 * It stays null below six results, where the comparison would be two runs
 * against two runs and mean nothing either way.
 */
export function summarise(results: ToolResult[]): ProgressSummary {
  if (!results.length) {
    return { count: 0, latest: null, best: null, averageWpm: 0, averageAcc: 0, trend: null };
  }
  const ordered = [...results].sort((a, b) => a.t - b.t);
  const wpms = ordered.map((r) => r.wpm);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  let trend: number | null = null;
  if (ordered.length >= 6) {
    const half = Math.floor(ordered.length / 2);
    trend = Math.round((median(wpms.slice(half)) - median(wpms.slice(0, half))) * 10) / 10;
  }

  return {
    count: ordered.length,
    latest: ordered[ordered.length - 1],
    best: ordered.reduce((a, b) => (b.wpm > a.wpm ? b : a)),
    averageWpm: Math.round(mean(wpms) * 10) / 10,
    averageAcc: Math.round(mean(ordered.map((r) => r.acc)) * 10) / 10,
    trend,
  };
}

/**
 * Whether somebody is signed in, without importing the account layer.
 *
 * The tools are prerendered and must not pull Supabase or the profile store
 * into their bundle, and the only thing they want to know is whether to label
 * an analytics event as coming from a signed-in visitor. The presence of the
 * auth token is enough for that, and reading it tells us nothing about who
 * they are.
 */
export function isSignedIn(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return !!localStorage.getItem('keytopia-auth');
  } catch {
    return false;
  }
}

export { dayKey };
