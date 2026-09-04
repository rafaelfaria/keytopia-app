import { describe, expect, it } from 'vitest';
import { MIN_SAMPLE, analyseKeys, practiceAdvice } from './keys';
import type { KeyStat } from '../types';

const stat = (a: number, e: number, ms = 200, n = a): KeyStat => ({ a, e, ms, n });

describe('the sample threshold', () => {
  it('judges nothing on fewer than MIN_SAMPLE appearances', () => {
    const a = analyseKeys({ r: stat(1, 1), e: stat(20, 0) });
    // R was missed on its only appearance. That is a slip, not a weak key.
    expect(a.ranked.map((k) => k.key)).not.toContain('r');
    expect(a.weakest.map((k) => k.key)).not.toContain('r');
    expect(a.undersampled).toContain('r');
  });

  it('judges a key the moment it clears the threshold', () => {
    const a = analyseKeys({ r: stat(MIN_SAMPLE, 2), e: stat(20, 0) });
    expect(a.ranked.map((k) => k.key)).toContain('r');
    expect(a.weakest.map((k) => k.key)).toContain('r');
    expect(a.undersampled).not.toContain('r');
  });

  it('honours a caller-supplied threshold', () => {
    const stats = { r: stat(6, 3) };
    expect(analyseKeys(stats, [], 4).ranked).toHaveLength(1);
    expect(analyseKeys(stats, [], 10).ranked).toHaveLength(0);
  });
});

describe('ranking', () => {
  it('sorts worst first by accuracy', () => {
    const a = analyseKeys({
      r: stat(10, 5),   // 50%
      t: stat(10, 1),   // 90%
      p: stat(10, 3),   // 70%
      e: stat(10, 0),   // 100%
    });
    expect(a.ranked.map((k) => k.key)).toEqual(['r', 'p', 't', 'e']);
  });

  it('breaks ties on response time', () => {
    const a = analyseKeys({
      r: stat(10, 0, 900),
      t: stat(10, 0, 100),
      e: stat(10, 0, 200),
    });
    // All perfect, so the slowest sorts first.
    expect(a.ranked[0].key).toBe('r');
  });

  it('puts the fastest error-free keys in strongest', () => {
    const a = analyseKeys({
      f: stat(20, 0, 120),
      j: stat(20, 0, 130),
      q: stat(20, 4, 400),
    });
    expect(a.strongest.map((k) => k.key)).toEqual(['f', 'j']);
    expect(a.strongest.map((k) => k.key)).not.toContain('q');
  });

  it('reports no weak key when nothing is actually wrong', () => {
    const a = analyseKeys({
      f: stat(20, 0, 200), j: stat(20, 0, 205), d: stat(20, 0, 198), k: stat(20, 0, 202),
    });
    expect(a.weakest).toHaveLength(0);
    expect(a.focus).toHaveLength(0);
    expect(practiceAdvice(a)).toBeNull(); // fewer than 8 keys sampled
  });

  it('counts a consistently slow but error-free key as weak', () => {
    const a = analyseKeys({
      f: stat(20, 0, 200), j: stat(20, 0, 200), d: stat(20, 0, 200),
      p: stat(20, 0, 600), // three times the median
    });
    expect(a.weakest.map((k) => k.key)).toContain('p');
  });

  it('computes accuracy per key to one decimal', () => {
    const a = analyseKeys({ r: stat(8, 1) });
    expect(a.ranked[0].accuracy).toBe(87.5);
  });
});

describe('confusions', () => {
  const strokes = (pairs: [string, string][]) =>
    pairs.map(([key, exp]) => ({ key, exp, ok: key === exp }));

  it('names the key typed instead, once it happened twice', () => {
    const a = analyseKeys(
      { r: stat(10, 3) },
      strokes([['e', 'r'], ['e', 'r'], ['r', 'r'], ['t', 'r']]),
    );
    expect(a.confusions).toEqual([{ expected: 'r', typed: 'e', count: 2 }]);
  });

  it('ignores a swap that only happened once', () => {
    const a = analyseKeys({ r: stat(10, 1) }, strokes([['e', 'r'], ['r', 'r']]));
    expect(a.confusions).toHaveLength(0);
  });

  it('sorts the most frequent confusion first', () => {
    const a = analyseKeys(
      { r: stat(20, 7), t: stat(20, 4) },
      strokes([
        ['e', 'r'], ['e', 'r'],
        ['y', 't'], ['y', 't'], ['y', 't'], ['y', 't'],
      ]),
    );
    expect(a.confusions[0]).toEqual({ expected: 't', typed: 'y', count: 4 });
  });

  it('is case-insensitive about what was typed', () => {
    const a = analyseKeys({ r: stat(10, 2) }, strokes([['E', 'r'], ['e', 'r']]));
    expect(a.confusions).toEqual([{ expected: 'r', typed: 'e', count: 2 }]);
  });
});

describe('focus keys and advice', () => {
  const eight = (extra: Record<string, KeyStat> = {}) => ({
    a: stat(20, 0), s: stat(20, 0), d: stat(20, 0), f: stat(20, 0),
    j: stat(20, 0), k: stat(20, 0), l: stat(20, 0), e: stat(20, 0),
    ...extra,
  });

  it('offers at most three letters to drill', () => {
    const a = analyseKeys(eight({
      r: stat(20, 9), t: stat(20, 8), p: stat(20, 7), q: stat(20, 6), z: stat(20, 5),
    }));
    expect(a.focus).toHaveLength(3);
    expect(a.focus).toEqual(['r', 't', 'p']);
  });

  it('excludes punctuation from the drill focus', () => {
    const a = analyseKeys(eight({ ',': stat(20, 10), r: stat(20, 5) }));
    expect(a.focus).not.toContain(',');
    expect(a.focus).toContain('r');
  });

  it('names the worst key and its evidence', () => {
    const a = analyseKeys(eight({ r: stat(20, 9) }));
    const advice = practiceAdvice(a);
    expect(advice).toContain('R');
    expect(advice).toContain('9 of 20');
  });

  it('says so plainly when the run was clean', () => {
    const a = analyseKeys(eight());
    expect(practiceAdvice(a)).toContain('No key stood out');
  });

  it('refuses to advise on too little evidence', () => {
    expect(practiceAdvice(analyseKeys({ r: stat(20, 9) }))).toBeNull();
  });
});

describe('input hygiene', () => {
  it('ignores keys that are not typeable characters', () => {
    const a = analyseKeys({ Shift: stat(20, 5), Enter: stat(20, 5), r: stat(20, 5) });
    expect(a.ranked.map((k) => k.key)).toEqual(['r']);
  });

  it('survives an empty aggregate', () => {
    const a = analyseKeys({});
    expect(a.ranked).toHaveLength(0);
    expect(a.weakest).toHaveLength(0);
    expect(a.strongest).toHaveLength(0);
    expect(a.confusions).toHaveLength(0);
    expect(a.sampled).toBe(0);
  });

  it('does not divide by zero when no key was ever timed', () => {
    const a = analyseKeys({ r: stat(10, 2, 0), t: stat(10, 0, 0) });
    for (const k of a.ranked) expect(Number.isFinite(k.relative)).toBe(true);
  });
});
