/**
 * Passage generation for the free tools.
 *
 * Every passage is a pure function of a seed, for three reasons. A prerendered
 * page must produce byte-identical HTML on every build or the static document
 * and the interactive one disagree. The daily exercise has to hand the same
 * text to everyone who opens it on the same calendar day, without a server
 * round trip to decide what that text is. And a bug in a drill is only
 * reproducible if the drill is.
 *
 * The word and sentence pools are KeyTopia's existing ones (src/lib/words.ts).
 * Nothing here invents a second corpus.
 */

import { mulberry32, hashStr, pick, pickN, shuffle, type Rng } from '../rng';
import { COMMON_WORDS, SENTENCES, PARAGRAPHS, TRICKY_WORDS } from '../words';

/** How much text a run of `seconds` needs before anyone could reach the end. */
function wordsForSeconds(seconds: number): number {
  // Sized for 150 WPM, comfortably past the fastest measured typists, so the
  // passage never runs out under someone mid-sprint.
  return Math.max(60, Math.ceil((seconds / 60) * 150) + 40);
}

/** A stream of common words: the standard shape of a timed speed test. */
export function wordStream(seed: number, count: number): string {
  const rnd = mulberry32(seed);
  const out: string[] = [];
  let prev = '';
  for (let i = 0; i < count; i++) {
    let w = COMMON_WORDS[Math.floor(rnd() * COMMON_WORDS.length)];
    // One retry against an immediate repeat. Two identical words in a row read
    // as a rendering bug and are also unrepresentatively easy to type.
    if (w === prev) w = COMMON_WORDS[Math.floor(rnd() * COMMON_WORDS.length)];
    out.push(w);
    prev = w;
  }
  return out.join(' ');
}

export function speedTestText(seed: number, seconds: number): string {
  return wordStream(seed, wordsForSeconds(seconds));
}

/**
 * Prose with punctuation and capitals, for the accuracy test.
 *
 * Accuracy is not tested by lowercase common words: the keys people actually
 * miss are the shifted ones, the apostrophe and the comma. Real sentences put
 * those in the path without resorting to nonsense strings.
 */
export function accuracyText(seed: number, sentences = 5): string {
  const rnd = mulberry32(seed);
  return pickN(rnd, SENTENCES, Math.min(sentences, SENTENCES.length)).join(' ');
}

/**
 * A passage engineered for coverage rather than realism: the weak-key analysis
 * needs a minimum number of observations of *every* letter, or it reports on
 * whichever letters happened to turn up.
 *
 * Built by taking the letters that are rare in ordinary English and choosing
 * real words that contain them, then shuffling the result in with common words
 * so the run still reads as typing rather than as a spelling list.
 */
const RARE_CARRIERS: Record<string, string[]> = {
  j: ['jump', 'journey', 'just', 'major', 'enjoy', 'jacket'],
  q: ['quick', 'quiet', 'question', 'quart', 'equal', 'quite'],
  x: ['box', 'six', 'expect', 'exact', 'mix', 'exercise'],
  z: ['zip', 'size', 'zero', 'lazy', 'dozen', 'prize'],
  v: ['very', 'value', 'voice', 'visit', 'every', 'travel'],
  k: ['key', 'kind', 'break', 'thick', 'market', 'walk'],
  w: ['water', 'wonder', 'window', 'weather', 'write', 'brown'],
  y: ['yellow', 'yesterday', 'yard', 'happy', 'system', 'young'],
  b: ['bridge', 'body', 'about', 'number', 'blue', 'habit'],
  p: ['paper', 'people', 'place', 'proper', 'happy', 'plant'],
  g: ['garden', 'green', 'group', 'bring', 'light', 'grand'],
  f: ['field', 'friend', 'follow', 'often', 'first', 'craft'],
  c: ['circle', 'change', 'because', 'clock', 'correct', 'active'],
  m: ['morning', 'metal', 'summer', 'moment', 'common', 'climb'],
  u: ['under', 'usual', 'result', 'quiet', 'number', 'unit'],
};

/**
 * The letters ordinary English will not top up on its own.
 *
 * These five appear at most once per carrier word and almost never in the
 * common-word filler, so each needs four carriers to clear the analysis
 * threshold; the rest reach it from three carriers plus whatever the filler
 * happens to contain. Getting the counts wrong is not a cosmetic fault: it
 * produces a report that silently says nothing about precisely the keys most
 * likely to be somebody's problem, which is the failure this passage exists to
 * prevent. The test in text.test.ts checks every letter against the threshold
 * rather than trusting these constants.
 */
const VERY_RARE = 'jqxzv';

export function coverageText(seed: number, words = 90): string {
  const rnd = mulberry32(seed);
  const out: string[] = [];
  for (const [letter, list] of Object.entries(RARE_CARRIERS)) {
    out.push(...pickN(rnd, list, VERY_RARE.includes(letter) ? 4 : 3));
  }
  while (out.length < words) out.push(COMMON_WORDS[Math.floor(rnd() * COMMON_WORDS.length)]);
  return shuffle(rnd, out).join(' ');
}

/**
 * A targeted drill for a specific set of keys.
 *
 * Real words wherever the pool provides them, because typing nonsense trains
 * the fingers to expect nonsense. The short repeated chunks between the words
 * are the one deliberate exception: they are the reps, and they are the same
 * shape the app's own weak-key workout uses (src/lib/adaptive.ts).
 */
export function drillText(keys: string[], seed: number, words = 40): string {
  const focus = keys.filter((k) => /^[a-z]$/.test(k)).slice(0, 4);
  const rnd = mulberry32(seed);
  if (!focus.length) return wordStream(seed, words);

  const set = new Set(focus);
  const scored = [...COMMON_WORDS, ...TRICKY_WORDS]
    .map((w) => ({ w, hits: [...w].filter((c) => set.has(c)).length }))
    .filter((s) => s.hits > 0);
  const pool = scored.length >= 12 ? scored : COMMON_WORDS.map((w) => ({ w, hits: 0 }));

  const out: string[] = [];
  for (let i = 0; i < words; i++) {
    // A rep chunk roughly every sixth word: enough to drill, not enough to
    // turn the exercise into gibberish.
    if (i > 0 && i % 6 === 0) {
      const k = focus[Math.floor(rnd() * focus.length)];
      out.push(pick(rnd, [`${k}${k}${k}`, `${k}a${k}`, `${k}e${k}`, `${k}o${k}`]));
      continue;
    }
    // Bias hard toward the focus keys without ever excluding ordinary words:
    // a drill made only of j-words is a tongue-twister, not practice.
    const bag = rnd() < 0.75 ? pool : scored.length ? scored : pool;
    out.push(bag[Math.floor(rnd() * bag.length)].w);
  }
  return out.join(' ');
}

// ── The daily exercise ─────────────────────────────────────────────────────

export interface DailyExercise {
  /** `YYYY-MM-DD` — the day this exercise belongs to. */
  day: string;
  title: string;
  focus: string;
  text: string;
  /** Roughly how long it takes, in minutes, at 20 and at 60 WPM. */
  minutes: [number, number];
}

const DAILY_SHAPES = [
  {
    id: 'warmup',
    title: 'Common Ground',
    focus: 'the two hundred words that make up most of what anyone writes',
  },
  {
    id: 'prose',
    title: 'Full Sentences',
    focus: 'capitals, commas and full stops in their natural places',
  },
  {
    id: 'mixed',
    title: 'The Mixed Round',
    focus: 'ordinary words, then punctuation, then the words that trip people up',
  },
  {
    id: 'tricky',
    title: 'Awkward Reaches',
    focus: 'the letter pairs that need the same finger twice',
  },
] as const;

/**
 * Today's exercise. Same day in, same exercise out, on every device, with no
 * request and no stored table: the calendar day *is* the seed.
 *
 * `day` is passed in rather than read from the clock so this function stays
 * pure — which is what the tests check, and what lets the page render a
 * specific day for anyone debugging one.
 */
export function dailyExercise(day: string): DailyExercise {
  // The prefix keeps this stream independent of the app's own daily challenge,
  // which seeds on 'keytopia-daily-' (a frozen identifier, per brand.config.json).
  const rnd = mulberry32(hashStr(`keytopia-tools-daily-${day}`));
  const shape = DAILY_SHAPES[Math.floor(rnd() * DAILY_SHAPES.length)];

  let text: string;
  switch (shape.id) {
    case 'prose':
      text = pickN(rnd, SENTENCES, 8).join(' ');
      break;
    case 'mixed': {
      const a = pickN(rnd, COMMON_WORDS, 30).join(' ');
      const b = pickN(rnd, SENTENCES, 3).join(' ');
      const c = pickN(rnd, TRICKY_WORDS, 10).join(' ');
      text = `${a} ${b} ${c}`;
      break;
    }
    case 'tricky': {
      const a = pickN(rnd, TRICKY_WORDS, 16).join(' ');
      const b = pick(rnd, PARAGRAPHS);
      text = `${a} ${b}`;
      break;
    }
    default:
      text = wordStream(Math.floor(rnd() * 1e9), 110);
  }

  text = text.replace(/\s+/g, ' ').trim();
  const words = text.split(' ').length;
  return {
    day,
    title: shape.title,
    focus: shape.focus,
    text,
    minutes: [Math.max(1, Math.round(words / 20)), Math.max(1, Math.round(words / 60))],
  };
}

/** Local calendar day as `YYYY-MM-DD`. Re-exported so pages need one import. */
export { dayKey } from '../metrics';
export type { Rng };
