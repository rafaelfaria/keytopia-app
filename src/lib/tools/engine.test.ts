/**
 * The typing engine, exercised the way the free tools drive it.
 *
 * The engine itself is shared with the lessons, games and races, so these
 * tests are as much a guard on not having broken those as they are a check on
 * the tools: the timer must start on the first keystroke and not before, it
 * must stop at the limit, scoring must stop with it, and a restart must
 * produce a clean slate.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine } from '../../components/typing';

/** Type a whole string into an engine at a fixed pace. */
function type(engine: Engine, text: string, startAt = 1_000, msPerKey = 100): number {
  let t = startAt;
  for (const ch of text) {
    engine.key(ch, t);
    t += msPerKey;
  }
  return t;
}

const TEXT = 'the quick brown fox jumps over the lazy dog';

beforeEach(() => {
  // The engine reads `performance.now()` for defaults; every call in these
  // tests passes an explicit timestamp, so nothing here depends on real time.
  vi.restoreAllMocks();
});

describe('the clock', () => {
  it('has not started before the first keystroke', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard', timeLimitSec: 60 });
    expect(e.started).toBe(false);
    expect(e.elapsedMs(5_000)).toBe(0);
    // A full time limit remains, no matter how long the page has been open.
    expect(e.remainingSec(999_999)).toBe(60);
  });

  it('starts on the first keystroke, not on the first backspace', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard', timeLimitSec: 60 });
    e.key('Backspace', 1_000);
    expect(e.started).toBe(false);

    e.key('t', 2_000);
    expect(e.started).toBe(true);
    expect(e.elapsedMs(3_000)).toBe(1_000);
  });

  it('counts down from the first keystroke', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard', timeLimitSec: 30 });
    e.key('t', 10_000);
    expect(e.remainingSec(20_000)).toBe(20);
    expect(e.remainingSec(40_000)).toBe(0);
    // Never negative, however long the tab was in the background.
    expect(e.remainingSec(999_999)).toBe(0);
  });
});

describe('finishing', () => {
  it('ends on its own when the text runs out', () => {
    const e = new Engine({ text: 'hi', mode: 'speed', label: 'test', correction: 'standard' });
    e.key('h', 1_000);
    expect(e.done).toBe(false);
    expect(e.key('i', 1_100)).toBe('done');
    expect(e.done).toBe(true);
  });

  it('cannot be scored further once finished', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard' });
    const end = type(e, 'the quick');
    e.finish(end);

    const before = e.result();
    expect(e.key('x', end + 100)).toBe('none');
    expect(e.key('Backspace', end + 200)).toBe('none');
    const after = e.result();

    expect(after.typed).toBe(before.typed);
    expect(after.correct).toBe(before.correct);
    expect(after.wpm).toBe(before.wpm);
  });

  it('finishing twice does not move the end time', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard' });
    type(e, 'the');
    const first = e.finish(5_000);
    const second = e.finish(90_000);
    expect(second.seconds).toBe(first.seconds);
  });

  it('a partial word still earns credit for the characters that landed', () => {
    const e = new Engine({ text: 'hello world', mode: 'speed', label: 'test', correction: 'standard' });
    type(e, 'hello wor');
    e.finish(5_000);
    // "hello" plus its space, plus the three characters of "wor".
    expect(e.correctChars()).toBe(9);
  });
});

describe('restart', () => {
  it('a fresh engine carries nothing over', () => {
    const first = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard' });
    type(first, 'the quixk');
    first.finish(5_000);
    expect(first.errorsTotal).toBeGreaterThan(0);

    // `useTypingSession.restart` builds a new Engine; this is that new one.
    const second = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard' });
    expect(second.started).toBe(false);
    expect(second.done).toBe(false);
    expect(second.pos).toBe(0);
    expect(second.errorsTotal).toBe(0);
    expect(second.backspaces).toBe(0);
    expect(second.strokes).toHaveLength(0);
    expect(second.correctChars()).toBe(0);
  });
});

describe('scoring', () => {
  it('a perfect run scores every character and 100% accuracy', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard' });
    type(e, TEXT, 1_000, 100);
    const r = e.result();
    expect(r.acc).toBe(100);
    expect(r.correct).toBe(TEXT.length);
    expect(r.uncorrected).toBe(0);
    expect(r.wpm).toBeGreaterThan(0);
  });

  it('a wrong key costs accuracy even after it is corrected', () => {
    const e = new Engine({ text: 'the', mode: 'speed', label: 'test', correction: 'standard' });
    e.key('t', 1_000);
    e.key('x', 1_100);          // wrong
    e.key('Backspace', 1_200);  // fixed
    e.key('h', 1_300);
    e.key('e', 1_400);
    const r = e.finish(1_500);
    expect(r.acc).toBeLessThan(100);
    expect(r.corrected).toBe(1);
    expect(r.uncorrected).toBe(0);
    expect(r.backspaces).toBe(1);
  });

  it('an uncorrected error is not credited to the word it is in', () => {
    const e = new Engine({ text: 'the cat', mode: 'speed', label: 'test', correction: 'standard' });
    type(e, 'thx cat');
    e.finish(5_000);
    // "thx" earns nothing; "cat" earns its three characters.
    expect(e.correctChars()).toBe(3);
  });

  it('marks a mashed run invalid', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard' });
    type(e, 'aaaaaaaaaaaaaaaaaaaa');
    const r = e.finish(10_000);
    expect(r.valid).toBe(false);
  });

  it('gross WPM is at least net WPM for the same run', () => {
    const e = new Engine({ text: TEXT, mode: 'speed', label: 'test', correction: 'standard' });
    type(e, 'the quixk brown fox');
    const r = e.finish(10_000);
    expect(r.raw).toBeGreaterThanOrEqual(r.wpm);
  });
});

describe('per-key aggregation', () => {
  it('counts appearances and misses against the expected key', () => {
    const e = new Engine({ text: 'aaa', mode: 'speed', label: 'test', correction: 'standard' });
    e.key('a', 1_000);
    e.key('s', 1_100); // missed
    e.key('a', 1_200);
    const r = e.finish(1_300);
    expect(r.keyAgg.a.a).toBe(3);
    expect(r.keyAgg.a.e).toBe(1);
  });
});
