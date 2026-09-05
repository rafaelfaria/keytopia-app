import { describe, expect, it } from 'vitest';
import { accuracyText, coverageText, dailyExercise, drillText, speedTestText, wordStream } from './text';
import { COMMON_WORDS } from '../words';

describe('the daily exercise', () => {
  it('gives the same day the same exercise, every time', () => {
    const a = dailyExercise('2026-09-04');
    const b = dailyExercise('2026-09-04');
    expect(a.text).toBe(b.text);
    expect(a.title).toBe(b.title);
    expect(a.focus).toBe(b.focus);
  });

  it('gives a different day a different exercise', () => {
    const today = dailyExercise('2026-09-04');
    const tomorrow = dailyExercise('2026-09-05');
    expect(tomorrow.text).not.toBe(today.text);
    expect(tomorrow.day).toBe('2026-09-05');
  });

  it('does not repeat itself across a whole month', () => {
    const texts = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      texts.add(dailyExercise(`2026-09-${String(d).padStart(2, '0')}`).text);
    }
    expect(texts.size).toBe(30);
  });

  it('carries the day it belongs to', () => {
    expect(dailyExercise('2027-01-31').day).toBe('2027-01-31');
  });

  it('is long enough to take a few minutes and short enough to finish', () => {
    for (const day of ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-12-25']) {
      const words = dailyExercise(day).text.split(' ').length;
      // 3 to 10 minutes: at 20 WPM that is 60 to 200 words, and a fast typist
      // should still be doing more than a token amount of work.
      expect(words).toBeGreaterThanOrEqual(55);
      expect(words).toBeLessThanOrEqual(230);
    }
  });

  it('estimates a sane range of minutes', () => {
    const e = dailyExercise('2026-09-04');
    const [slow, fast] = e.minutes;
    expect(fast).toBeGreaterThan(0);
    expect(slow).toBeGreaterThanOrEqual(fast);
  });

  it('has no leading, trailing or doubled spaces', () => {
    for (const day of ['2026-09-04', '2026-09-11', '2026-10-01']) {
      const t = dailyExercise(day).text;
      expect(t).toBe(t.trim());
      expect(t).not.toMatch(/\s{2}/);
    }
  });
});

describe('word streams', () => {
  it('is deterministic for a seed', () => {
    expect(wordStream(42, 50)).toBe(wordStream(42, 50));
  });

  it('changes with the seed', () => {
    expect(wordStream(42, 50)).not.toBe(wordStream(43, 50));
  });

  it('produces exactly the requested number of words', () => {
    expect(wordStream(1, 30).split(' ')).toHaveLength(30);
  });

  it('draws only from the shared word list', () => {
    const pool = new Set(COMMON_WORDS);
    for (const w of wordStream(7, 200).split(' ')) expect(pool.has(w)).toBe(true);
  });

  it('gives a longer test more text to work with', () => {
    const short = speedTestText(1, 15).split(' ').length;
    const long = speedTestText(1, 300).split(' ').length;
    expect(long).toBeGreaterThan(short);
    // Enough for 150 WPM, comfortably past the fastest measured typists, so
    // nobody can run out of passage mid-sprint.
    expect(long).toBeGreaterThanOrEqual((300 / 60) * 150);
  });
});

describe('the accuracy passage', () => {
  it('is deterministic', () => {
    expect(accuracyText(9, 5)).toBe(accuracyText(9, 5));
  });

  it('contains the punctuation and capitals it exists to test', () => {
    const t = accuracyText(9, 5);
    expect(t).toMatch(/[A-Z]/);
    expect(t).toMatch(/\./);
  });
});

describe('the coverage passage', () => {
  const text = coverageText(11, 90);

  it('is deterministic', () => {
    expect(coverageText(11, 90)).toBe(text);
  });

  it('shows every rare letter enough times to be judged', () => {
    // The reason this passage exists: ordinary English would measure E
    // thoroughly and Z not at all, then quietly say nothing about Z.
    for (const letter of 'jqxzvkwybpgfcmu') {
      const seen = [...text].filter((c) => c === letter).length;
      expect(seen, `letter ${letter} appeared ${seen} times`).toBeGreaterThanOrEqual(4);
    }
  });

  it('covers the whole alphabet at least once', () => {
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      expect(text, `missing ${letter}`).toContain(letter);
    }
  });

  it('is made of real words, not nonsense strings', () => {
    for (const w of text.split(' ')) expect(w).toMatch(/^[a-z]+$/);
  });
});

describe('the generated drill', () => {
  it('is deterministic for the same keys and seed', () => {
    expect(drillText(['r', 't', 'p'], 5)).toBe(drillText(['r', 't', 'p'], 5));
  });

  it('is dense in the keys it was asked for', () => {
    const text = drillText(['r', 't', 'p'], 5, 40);
    const focusChars = [...text].filter((c) => 'rtp'.includes(c)).length;
    const letters = [...text].filter((c) => /[a-z]/.test(c)).length;
    // Those three letters are about 15% of ordinary English. A drill that did
    // not beat that comfortably would not be a drill.
    expect(focusChars / letters).toBeGreaterThan(0.25);
  });

  it('contains every focus key', () => {
    const text = drillText(['j', 'q', 'z'], 5, 40);
    for (const k of 'jqz') expect(text).toContain(k);
  });

  it('falls back to ordinary words when given no usable keys', () => {
    const text = drillText([], 5, 20);
    expect(text.split(' ')).toHaveLength(20);
    expect(text).toMatch(/^[a-z ]+$/);
  });

  it('ignores punctuation and multi-character keys', () => {
    expect(() => drillText([',', 'Shift', 'r'], 5, 20)).not.toThrow();
    expect(drillText([',', 'Shift'], 5, 20).split(' ')).toHaveLength(20);
  });
});
