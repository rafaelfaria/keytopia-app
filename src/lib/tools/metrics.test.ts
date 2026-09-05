import { describe, expect, it } from 'vitest';
import {
  CHARS_PER_WORD, MIN_MEASURABLE_MS, accBucket, accuracyBand, accuracyPct, cpm, finite,
  grossWpm, isMeaningful, netWpm, netWpmFromErrors, secondsFromInput, speedBand, wpmBucket,
  wpmFromWords,
} from './metrics';
import { wpmOf } from '../metrics';

describe('gross WPM', () => {
  it('is characters over five, over minutes', () => {
    // 300 characters in exactly one minute = 60 "words".
    expect(grossWpm(300, 60_000)).toBe(60);
    expect(grossWpm(150, 30_000)).toBe(60);
    expect(grossWpm(600, 120_000)).toBe(60);
  });

  it('agrees with the engine the rest of KeyTopia scores on', () => {
    // The whole point of this module: one canonical implementation. If these
    // ever diverge, a tool result and a lesson result stop being comparable.
    for (const [chars, ms] of [[300, 60_000], [123, 45_000], [7, 3_000]] as const) {
      expect(grossWpm(chars, ms)).toBeCloseTo(Math.round(wpmOf(chars, ms) * 10) / 10, 5);
    }
  });

  it('returns zero rather than dividing by zero time', () => {
    expect(grossWpm(300, 0)).toBe(0);
    expect(grossWpm(300, -1)).toBe(0);
  });

  it('returns zero for no characters', () => {
    expect(grossWpm(0, 60_000)).toBe(0);
    expect(grossWpm(-5, 60_000)).toBe(0);
  });

  it('never emits NaN or Infinity', () => {
    for (const [c, ms] of [[NaN, 60_000], [300, NaN], [Infinity, 60_000], [300, Infinity]] as const) {
      const v = grossWpm(c, ms);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('handles a very short test without exaggerating it', () => {
    // The engine itself refuses anything under half a second.
    expect(grossWpm(10, 400)).toBe(0);
    // And a 2-second run is arithmetically fine but flagged unusable elsewhere.
    expect(grossWpm(10, 2_000)).toBeGreaterThan(0);
    expect(isMeaningful(4, 2_000)).toBe(false);
  });
});

describe('net WPM', () => {
  it('scores only the characters that landed', () => {
    expect(netWpm(250, 60_000)).toBe(50);
  });

  it('is never above gross for the same run', () => {
    expect(netWpm(250, 60_000)).toBeLessThan(grossWpm(300, 60_000));
  });
});

describe('net WPM from an error count (the calculator)', () => {
  it('subtracts one word per uncorrected error per minute', () => {
    // 60 gross, 10 errors, 2 minutes => 60 - 5 = 55.
    expect(netWpmFromErrors(60, 10, 2)).toBe(55);
    expect(netWpmFromErrors(60, 0, 1)).toBe(60);
  });

  it('never goes negative', () => {
    expect(netWpmFromErrors(5, 100, 1)).toBe(0);
  });

  it('returns zero for zero minutes rather than Infinity', () => {
    expect(netWpmFromErrors(60, 10, 0)).toBe(0);
  });
});

describe('word-count calculator', () => {
  it('converts a word count and a time directly', () => {
    expect(wpmFromWords(60, 60)).toBe(60);
    expect(wpmFromWords(30, 30)).toBe(60);
    expect(wpmFromWords(45, 90)).toBe(30);
  });

  it('agrees with the character route for the same typing', () => {
    // 60 words is 300 characters by the five-character convention.
    expect(wpmFromWords(60, 60)).toBe(grossWpm(60 * CHARS_PER_WORD, 60_000));
  });

  it('refuses nonsense input', () => {
    expect(wpmFromWords(0, 60)).toBe(0);
    expect(wpmFromWords(-10, 60)).toBe(0);
    expect(wpmFromWords(60, 0)).toBe(0);
    expect(wpmFromWords(NaN, 60)).toBe(0);
  });
});

describe('characters per minute', () => {
  it('is five times WPM', () => {
    expect(cpm(300, 60_000)).toBe(300);
    expect(cpm(300, 60_000)).toBe(grossWpm(300, 60_000) * CHARS_PER_WORD);
  });
});

describe('accuracy', () => {
  it('is 100 when everything landed', () => {
    expect(accuracyPct(120, 120)).toBe(100);
  });

  it('reports a partial rate to one decimal', () => {
    expect(accuracyPct(90, 100)).toBe(90);
    expect(accuracyPct(95, 97)).toBe(97.9);
  });

  it('is zero, not NaN, for empty input', () => {
    expect(accuracyPct(0, 0)).toBe(0);
    expect(Number.isNaN(accuracyPct(0, 0))).toBe(false);
  });

  it('clamps a correct count above the typed count', () => {
    // Extra characters cannot produce more than 100%.
    expect(accuracyPct(150, 100)).toBe(100);
  });

  it('handles missing characters as a lower rate, not an error', () => {
    expect(accuracyPct(40, 100)).toBe(40);
  });

  it('never returns a negative rate', () => {
    expect(accuracyPct(-20, 100)).toBe(0);
  });
});

describe('time input parsing', () => {
  it('converts minutes to seconds', () => {
    expect(secondsFromInput(2, 'minutes')).toBe(120);
    expect(secondsFromInput(90, 'seconds')).toBe(90);
  });

  it('rejects zero, negatives and absurd values', () => {
    expect(secondsFromInput(0, 'minutes')).toBeNull();
    expect(secondsFromInput(-3, 'seconds')).toBeNull();
    expect(secondsFromInput(NaN, 'seconds')).toBeNull();
    expect(secondsFromInput(100_000, 'seconds')).toBeNull();
  });
});

describe('guards', () => {
  it('replaces non-finite values with the fallback', () => {
    expect(finite(NaN)).toBe(0);
    expect(finite(Infinity, 7)).toBe(7);
    expect(finite(42)).toBe(42);
  });

  it('requires both enough strokes and enough time to be meaningful', () => {
    expect(isMeaningful(50, MIN_MEASURABLE_MS)).toBe(true);
    expect(isMeaningful(3, 60_000)).toBe(false);
    expect(isMeaningful(50, MIN_MEASURABLE_MS - 1)).toBe(false);
  });
});

describe('plain-English bands', () => {
  it('picks the highest band the value clears', () => {
    expect(speedBand(5).label).toBe('Getting started');
    expect(speedBand(51.6).label).toBe('Around average');
    expect(speedBand(200).label).toBe('Exceptional');
  });

  it('reads accuracy against the 95 and 98 thresholds', () => {
    expect(accuracyBand(80).label).toBe('Needs attention');
    expect(accuracyBand(95).label).toBe('Good foundation');
    expect(accuracyBand(98).label).toBe('Strong');
    expect(accuracyBand(100).label).toBe('Excellent');
  });
});

describe('analytics buckets', () => {
  it('never leaks an exact score', () => {
    expect(wpmBucket(51.6)).toBe('50-69');
    expect(wpmBucket(0)).toBe('0-19');
    expect(wpmBucket(500)).toBe('90+');
    expect(accBucket(97.3)).toBe('96-98');
    expect(accBucket(100)).toBe('99+');
    // A bucket must never contain a decimal from the input.
    for (const v of [12.3, 44.9, 88.8]) expect(wpmBucket(v)).not.toContain('.');
  });
});
