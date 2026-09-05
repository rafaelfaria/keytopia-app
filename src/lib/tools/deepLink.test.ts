import { describe, expect, it } from 'vitest';
import {
  TOOL_PARAMS, buildToolPath, paramsFor, readDay, readEnum, readKeys, readNumber, readOneOf,
} from './deepLink';
import { TOOLS } from './registry';

const q = (s: string) => new URLSearchParams(s);

describe('numbers', () => {
  it('reads a value in range', () => {
    expect(readNumber(q('wpm=45'), 'wpm', { min: 1, max: 400 })).toBe(45);
    expect(readNumber(q('wpm=45.5'), 'wpm', { min: 1, max: 400 })).toBe(45.5);
  });

  it('is null for absent, empty and unparseable values', () => {
    for (const s of ['', 'wpm=', 'wpm=banana', 'wpm=%20', 'other=45']) {
      expect(readNumber(q(s), 'wpm', { min: 1, max: 400 }), s).toBeNull();
    }
  });

  it('is null outside the range rather than clamping', () => {
    // Clamping would silently show a different comparison from the one the
    // link advertised. Falling back to the default is honest.
    expect(readNumber(q('wpm=0'), 'wpm', { min: 1, max: 400 })).toBeNull();
    expect(readNumber(q('wpm=-20'), 'wpm', { min: 1, max: 400 })).toBeNull();
    expect(readNumber(q('wpm=9999'), 'wpm', { min: 1, max: 400 })).toBeNull();
  });

  it('rejects Infinity and NaN however they are spelled', () => {
    for (const s of ['wpm=Infinity', 'wpm=-Infinity', 'wpm=NaN', 'wpm=1e999']) {
      expect(readNumber(q(s), 'wpm', { min: 1, max: 400 }), s).toBeNull();
    }
  });
});

describe('fixed sets', () => {
  const DURATIONS = [15, 30, 60, 120] as const;

  it('accepts a member of the set', () => {
    expect(readOneOf(q('duration=30'), 'duration', DURATIONS)).toBe(30);
  });

  it('rejects anything else', () => {
    for (const s of ['duration=45', 'duration=0', 'duration=abc', 'duration=']) {
      expect(readOneOf(q(s), 'duration', DURATIONS), s).toBeNull();
    }
  });

  it('reads an enum case-insensitively', () => {
    expect(readEnum(q('unit=SECONDS'), 'unit', ['minutes', 'seconds'] as const)).toBe('seconds');
    expect(readEnum(q('unit=hours'), 'unit', ['minutes', 'seconds'] as const)).toBeNull();
  });
});

describe('days', () => {
  it('accepts a real calendar day', () => {
    expect(readDay(q('day=2026-09-07'), 'day')).toBe('2026-09-07');
    expect(readDay(q('day=2028-02-29'), 'day')).toBe('2028-02-29');
  });

  it('rejects a date that is only shaped like one', () => {
    // 2026 is not a leap year, and there is no 31st of February in any year.
    for (const s of ['day=2026-02-29', 'day=2026-02-31', 'day=2026-13-01', 'day=2026-00-10']) {
      expect(readDay(q(s), 'day'), s).toBeNull();
    }
  });

  it('rejects other formats', () => {
    for (const s of ['day=07/09/2026', 'day=2026-9-7', 'day=today', 'day=']) {
      expect(readDay(q(s), 'day'), s).toBeNull();
    }
  });
});

describe('keys', () => {
  it('reads letters together or separated', () => {
    expect(readKeys(q('keys=rtp'), 'keys')).toEqual(['r', 't', 'p']);
    expect(readKeys(q('keys=r,t,p'), 'keys')).toEqual(['r', 't', 'p']);
    expect(readKeys(q('keys=R+T+P'), 'keys')).toEqual(['r', 't', 'p']);
  });

  it('deduplicates', () => {
    expect(readKeys(q('keys=rrrttt'), 'keys')).toEqual(['r', 't']);
  });

  it('drops anything that is not a letter', () => {
    expect(readKeys(q('keys=r1t!p'), 'keys')).toEqual(['r', 't', 'p']);
    expect(readKeys(q('keys=123'), 'keys')).toEqual([]);
  });

  it('caps the count, so a hostile link cannot ask for a drill on the alphabet', () => {
    expect(readKeys(q('keys=abcdefghijklmnop'), 'keys')).toHaveLength(4);
  });

  it('is empty when absent', () => {
    expect(readKeys(q(''), 'keys')).toEqual([]);
  });
});

describe('building links', () => {
  it('omits empty values rather than emitting bare ampersands', () => {
    expect(buildToolPath('/tools/wpm-calculator', { words: 60, time: 1, errors: '', unit: null }))
      .toBe('/tools/wpm-calculator?words=60&time=1');
  });

  it('returns a bare path when nothing is set', () => {
    expect(buildToolPath('/tools/typing-speed-test', { duration: null })).toBe('/tools/typing-speed-test');
  });

  it('escapes values', () => {
    expect(buildToolPath('/tools/x', { q: 'a b&c' })).toBe('/tools/x?q=a+b%26c');
  });

  it('round-trips through the readers', () => {
    const path = buildToolPath('/tools/typing-speed-by-age', { wpm: 45, age: 10 });
    const parsed = new URLSearchParams(path.split('?')[1]);
    expect(readNumber(parsed, 'wpm', { min: 1, max: 400 })).toBe(45);
    expect(readNumber(parsed, 'age', { min: 4, max: 120 })).toBe(10);
  });
});

describe('the declared parameters', () => {
  it('gives every tool at least one', () => {
    for (const t of TOOLS) {
      expect(paramsFor(t.path).length, `${t.path} has no deep-link parameter`).toBeGreaterThan(0);
    }
  });

  it('documents nothing for a route that is not a tool', () => {
    expect(Object.keys(TOOL_PARAMS).sort()).toEqual(TOOLS.map((t) => t.path).sort());
  });

  it('gives every parameter a description, an accepted range and an example', () => {
    for (const [path, specs] of Object.entries(TOOL_PARAMS)) {
      for (const spec of specs) {
        expect(spec.name, path).toMatch(/^[a-z]+$/);
        expect(spec.describe.length, `${path}?${spec.name}`).toBeGreaterThan(30);
        expect(spec.accepts.length, `${path}?${spec.name}`).toBeGreaterThan(3);
        expect(spec.example, `${path}?${spec.name}`).toMatch(/^\?[a-z]+=/);
      }
    }
  });

  it('gives examples that name the parameter they document', () => {
    for (const [path, specs] of Object.entries(TOOL_PARAMS)) {
      for (const spec of specs) {
        expect(spec.example, `${path} example for ${spec.name}`).toContain(`${spec.name}=`);
      }
    }
  });

  it('gives examples whose values the readers actually accept', () => {
    // The example is what the hub renders as a working link, so an example the
    // parser rejects is a link that advertises a feature and then ignores it.
    const durations = [15, 30, 60, 120, 300] as const;
    for (const [path, specs] of Object.entries(TOOL_PARAMS)) {
      for (const spec of specs) {
        const parsed = new URLSearchParams(spec.example.slice(1));
        const value = parsed.get(spec.name);
        expect(value, `${path} ${spec.name}`).toBeTruthy();
        if (spec.name === 'duration') {
          expect(readOneOf(parsed, 'duration', durations), path).not.toBeNull();
        } else if (spec.name === 'day') {
          expect(readDay(parsed, 'day'), path).not.toBeNull();
        } else if (spec.name === 'keys') {
          expect(readKeys(parsed, 'keys').length, path).toBeGreaterThan(0);
        } else if (spec.name === 'unit') {
          expect(readEnum(parsed, 'unit', ['minutes', 'seconds'] as const), path).not.toBeNull();
        } else {
          expect(readNumber(parsed, spec.name, { min: 0, max: 1e9 }), `${path} ${spec.name}`).not.toBeNull();
        }
      }
    }
  });
});
