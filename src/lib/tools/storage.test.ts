/**
 * The local result store.
 *
 * Tested against an in-memory stand-in for localStorage rather than jsdom, and
 * also with no storage at all, because "no storage" is a real state: a private
 * window, a browser configured to block site data, and the Node prerender all
 * reach this module with `localStorage` undefined, and none of them may throw
 * into a render.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearResults, dailyStreak, deleteResult, isSignedIn, loadState, lastResult,
  recordDaily, saveResult, summarise, type ToolResult,
} from './storage';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const g = globalThis as { localStorage?: unknown };

beforeEach(() => { g.localStorage = new MemoryStorage(); });
afterEach(() => { delete g.localStorage; });

const result = (over: Partial<ToolResult> = {}) => ({
  source: 'typing-speed-test' as const,
  wpm: 50, raw: 55, acc: 96, seconds: 60, mistakes: 2, typed: 250,
  ...over,
});

describe('saving and retrieving', () => {
  it('round-trips a result', () => {
    const saved = saveResult(result());
    const [read] = loadState().results;
    expect(read.id).toBe(saved.id);
    expect(read.wpm).toBe(50);
    expect(read.acc).toBe(96);
  });

  it('stamps an id and a time', () => {
    const saved = saveResult(result());
    expect(saved.id).toBeTruthy();
    expect(saved.t).toBeGreaterThan(0);
  });

  it('accepts an explicit timestamp', () => {
    const saved = saveResult({ ...result(), t: 1_700_000_000_000 });
    expect(saved.t).toBe(1_700_000_000_000);
  });

  it('keeps results in the order they were saved', () => {
    saveResult(result({ wpm: 40, t: 1 }));
    saveResult(result({ wpm: 50, t: 2 }));
    expect(loadState().results.map((r) => r.wpm)).toEqual([40, 50]);
  });

  it('returns the most recent result for cross-tool prefill', () => {
    expect(lastResult()).toBeNull();
    saveResult(result({ wpm: 40, t: 1 }));
    saveResult(result({ wpm: 62, t: 2 }));
    expect(lastResult()?.wpm).toBe(62);
  });

  it('deletes one row without touching the others', () => {
    const a = saveResult(result({ wpm: 40 }));
    saveResult(result({ wpm: 50 }));
    deleteResult(a.id);
    const left = loadState().results;
    expect(left).toHaveLength(1);
    expect(left[0].wpm).toBe(50);
  });

  it('clears everything on request', () => {
    saveResult(result());
    saveResult(result());
    clearResults();
    expect(loadState().results).toHaveLength(0);
  });

  it('caps the history so it cannot grow without bound', () => {
    for (let i = 0; i < 260; i++) saveResult(result({ wpm: i, t: i + 1 }));
    const kept = loadState().results;
    expect(kept).toHaveLength(200);
    // The newest are the ones kept.
    expect(kept[kept.length - 1].wpm).toBe(259);
  });

  it('never stores anything that was typed', () => {
    saveResult(result());
    const raw = (g.localStorage as MemoryStorage).getItem('keytopia-tools-v1')!;
    const parsed = JSON.parse(raw);
    for (const r of parsed.results) {
      expect(Object.keys(r).sort()).toEqual(
        ['acc', 'id', 'mistakes', 'raw', 'seconds', 'source', 't', 'typed', 'wpm'],
      );
    }
  });
});

describe('corrupt and missing storage', () => {
  it('returns the empty state for unparseable data', () => {
    (g.localStorage as MemoryStorage).setItem('keytopia-tools-v1', '{not json');
    expect(loadState().results).toHaveLength(0);
  });

  it('drops rows that are not results', () => {
    (g.localStorage as MemoryStorage).setItem(
      'keytopia-tools-v1',
      JSON.stringify({ v: 1, results: [null, { wpm: 'fast' }, { t: 1, wpm: 50, acc: 90 }], daily: {} }),
    );
    expect(loadState().results).toHaveLength(1);
  });

  it('works with no storage at all', () => {
    delete g.localStorage;
    expect(() => loadState()).not.toThrow();
    expect(loadState().results).toHaveLength(0);
    expect(lastResult()).toBeNull();
    expect(() => saveResult(result())).not.toThrow();
    expect(isSignedIn()).toBe(false);
  });
});

describe('the daily record', () => {
  it('records a day', () => {
    recordDaily('2026-09-04', 50, 96);
    expect(loadState().daily['2026-09-04']).toEqual({ wpm: 50, acc: 96 });
  });

  it('keeps only the best run of a day', () => {
    recordDaily('2026-09-04', 50, 96);
    recordDaily('2026-09-04', 41, 99); // slower, so it must not replace
    expect(loadState().daily['2026-09-04'].wpm).toBe(50);
    recordDaily('2026-09-04', 58, 94); // faster, so it must
    expect(loadState().daily['2026-09-04'].wpm).toBe(58);
  });
});

describe('the streak', () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00`);

  it('is zero with nothing recorded', () => {
    expect(dailyStreak({}, at('2026-09-04'))).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const daily = { '2026-09-02': 1, '2026-09-03': 1, '2026-09-04': 1 };
    expect(dailyStreak(daily, at('2026-09-04'))).toBe(3);
  });

  it('still counts a streak that ends yesterday', () => {
    // The day is not over yet; resetting at midnight punishes the clock.
    const daily = { '2026-09-02': 1, '2026-09-03': 1 };
    expect(dailyStreak(daily, at('2026-09-04'))).toBe(2);
  });

  it('breaks on a missing day', () => {
    const daily = { '2026-08-30': 1, '2026-09-03': 1, '2026-09-04': 1 };
    expect(dailyStreak(daily, at('2026-09-04'))).toBe(2);
  });

  it('does not count a gap of two days', () => {
    expect(dailyStreak({ '2026-09-01': 1 }, at('2026-09-04'))).toBe(0);
  });

  it('crosses a month boundary', () => {
    const daily = { '2026-08-30': 1, '2026-08-31': 1, '2026-09-01': 1 };
    expect(dailyStreak(daily, at('2026-09-01'))).toBe(3);
  });
});

describe('the progress summary', () => {
  const rows = (wpms: number[]): ToolResult[] =>
    wpms.map((wpm, i) => ({
      id: String(i), t: (i + 1) * 1000, source: 'typing-speed-test',
      wpm, raw: wpm + 5, acc: 95, seconds: 60, mistakes: 1, typed: 250,
    }));

  it('is empty for no results', () => {
    const s = summarise([]);
    expect(s).toEqual({ count: 0, latest: null, best: null, averageWpm: 0, averageAcc: 0, trend: null });
  });

  it('finds latest, best, average and count', () => {
    const s = summarise(rows([40, 60, 50]));
    expect(s.count).toBe(3);
    expect(s.latest?.wpm).toBe(50);   // last by time, not the largest
    expect(s.best?.wpm).toBe(60);
    expect(s.averageWpm).toBe(50);
    expect(s.averageAcc).toBe(95);
  });

  it('orders by time regardless of the order given', () => {
    const shuffled = [...rows([40, 60, 50])].reverse();
    expect(summarise(shuffled).latest?.wpm).toBe(50);
  });

  it('withholds a trend below six results', () => {
    expect(summarise(rows([40, 42, 44, 46, 48])).trend).toBeNull();
  });

  it('compares the older half against the newer half', () => {
    // Older three average 40, newer three average 50.
    expect(summarise(rows([40, 40, 40, 50, 50, 50])).trend).toBe(10);
  });

  it('reports a decline as a negative trend', () => {
    expect(summarise(rows([60, 60, 60, 50, 50, 50])).trend).toBe(-10);
  });

  it('is not fooled by one fluke run', () => {
    // A single 120 at the end must not read as a 20 WPM improvement.
    const s = summarise(rows([40, 40, 40, 40, 40, 120]));
    expect(s.trend).toBeLessThan(20);
    expect(s.best?.wpm).toBe(120);
  });
});
