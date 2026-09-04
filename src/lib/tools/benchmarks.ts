/**
 * Typing-speed benchmarks, with their sources attached.
 *
 * The temptation on a page called "typing speed by age" is to print a tidy
 * table from age 6 to age 60. No such table exists in the literature. The
 * largest study of modern typing ever run (Dhakal et al., CHI 2018, 168,960
 * participants) reports one population mean and does not publish a
 * speed-by-age breakdown at all; the figures that circulate as "average WPM
 * for a 12-year-old" are almost always a vendor's guidance restated as though
 * it were a measurement.
 *
 * So every row here carries a `tier`, and the UI never mixes them:
 *
 *   'measured'  — a published study reporting figures it actually observed.
 *   'target'    — a recommendation: what a learner is being *aimed* at. Not a
 *                 description of anybody, and not a pass mark.
 *   'guidance'  — widely used rules of thumb whose underlying data is not
 *                 published. Useful for orientation, worth nothing as evidence.
 *
 * `caveat` is not optional decoration. Where a study's sample limits what can
 * be concluded from it, the limitation travels with the number.
 *
 * SSR-safe: pure data and pure functions.
 */

export type Tier = 'measured' | 'target' | 'guidance';

export interface Source {
  id: string;
  citation: string;
  url?: string;
}

export interface Benchmark {
  id: string;
  /** Who the row describes, in the reader's words. */
  group: string;
  /** Rough age span this row is offered for; used to preselect. */
  minAge: number;
  maxAge: number;
  /** Single figure, or a range where the source gives one. */
  wpm: number;
  wpmLow?: number;
  wpmHigh?: number;
  tier: Tier;
  sourceId: string;
  note: string;
  caveat?: string;
}

export const SOURCES: Source[] = [
  {
    id: 'dhakal2018',
    citation:
      'Dhakal, V., Feit, A. M., Kristensson, P. O., & Oulasvirta, A. (2018). Observations on Typing from 136 Million Keystrokes. CHI 2018.',
    url: 'https://doi.org/10.1145/3173574.3174220',
  },
  {
    id: 'salthouse',
    citation:
      'Typewriter-era studies of professional typists (Salthouse; Grudin), as reviewed in Dhakal et al. (2018).',
    url: 'https://doi.org/10.1145/3173574.3174220',
  },
  {
    id: 'honaker1999',
    citation:
      'Honaker, D. (1999). Handwriting and keyboarding legibility/speed of 5th–8th grade students: a pilot study. Unpublished manuscript, as compiled in the QIAT "Handwriting / Keyboarding Rates" resource.',
    url: 'https://qiat.org/docs/resourcebank/hwriting_kybding_rate_info.pdf',
  },
  {
    id: 'findenque1986',
    citation:
      'Findenque, A., Smith, M., & Sullivan, G. (1986). Keyboarding: The issues today. Proceedings of the 5th Annual Extending the Human Mind Conference, University of Oregon, as compiled by QIAT.',
    url: 'https://qiat.org/docs/resourcebank/hwriting_kybding_rate_info.pdf',
  },
  {
    id: 'nicholson',
    citation:
      'Nicholson, B. Recommended keyboarding speeds by grade, as compiled in the QIAT "Handwriting / Keyboarding Rates" resource (rev. 2005).',
    url: 'https://qiat.org/docs/resourcebank/hwriting_kybding_rate_info.pdf',
  },
  {
    id: 'typingcom',
    citation: 'Typing.com, "WPM / Averages by Grade Level" support article.',
    url: 'https://support.typing.com/en/articles/9045953',
  },
];

export function sourceById(id: string): Source {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown benchmark source: ${id}`);
  return s;
}

/**
 * The headline measured figure, quoted on several pages. Kept as one constant
 * so the tools cannot end up disagreeing about what the average is.
 */
export const POPULATION = {
  wpm: 51.6,
  sd: 20.2,
  n: 168_960,
  keystrokes: 136_857_600,
  /** Mean uncorrected error rate, i.e. errors left in the finished text. */
  uncorrectedErrorPct: 1.17,
  trainedWpm: 54.4,
  untrainedWpm: 49.0,
  sourceId: 'dhakal2018',
  sampleNote:
    'Participants were self-selected from the user base of an online typing-practice site: mean age 24.5, with 75% aged 11–30, and skewed towards the United States. It is the largest measurement of modern typing there is, but it is not a random sample of the population.',
} as const;

export const BENCHMARKS: Benchmark[] = [
  // ── Measured ─────────────────────────────────────────────────────────────
  {
    id: 'pop-all',
    group: 'General population (mostly teens and young adults)',
    minAge: 11,
    maxAge: 120,
    wpm: 51.6,
    tier: 'measured',
    sourceId: 'dhakal2018',
    note: 'Mean of 51.6 WPM (SD 20.2) across 168,960 people typing 136 million keystrokes. The single largest measurement of typing on modern keyboards.',
    caveat: POPULATION.sampleNote,
  },
  {
    id: 'pop-trained',
    group: 'Adults who have had typing training',
    minAge: 16,
    maxAge: 120,
    wpm: 54.4,
    tier: 'measured',
    sourceId: 'dhakal2018',
    note: 'Within the same study, people reporting formal typing training averaged 54.4 WPM against 49.0 for those without. The gap is real but modest: about 5 WPM.',
  },
  {
    id: 'pop-untrained',
    group: 'Adults with no typing training',
    minAge: 16,
    maxAge: 120,
    wpm: 49.0,
    tier: 'measured',
    sourceId: 'dhakal2018',
    note: 'Most people never take a typing course and still reach the high forties. Training moves the number less than the amount of typing you do.',
  },
  {
    id: 'grade5',
    group: 'Around 10–11 years old (grade 5)',
    minAge: 9,
    maxAge: 11,
    wpm: 9.5,
    wpmLow: 8.5,
    wpmHigh: 10.5,
    tier: 'measured',
    sourceId: 'honaker1999',
    note: 'A pilot study of fifth graders measured 8.5 WPM for boys and 10.5 for girls.',
    caveat: 'A small pilot study, not a national survey. Treat it as one data point rather than a norm.',
  },
  {
    id: 'grade8',
    group: 'Around 13–14 years old (grade 8)',
    minAge: 12,
    maxAge: 14,
    wpm: 18.3,
    wpmLow: 17.7,
    wpmHigh: 18.9,
    tier: 'measured',
    sourceId: 'honaker1999',
    note: 'The same pilot study measured 17.7 WPM for boys and 18.9 for girls three years later.',
    caveat: 'Same small-sample limitation as the grade 5 figure.',
  },
  {
    id: 'professional',
    group: 'Professional typists (typewriter-era studies)',
    minAge: 18,
    maxAge: 120,
    wpm: 67,
    wpmLow: 60,
    wpmHigh: 75,
    tier: 'measured',
    sourceId: 'salthouse',
    note: 'Trained typists studied in the 1930s–1980s typed 60–75 WPM. Useful as the ceiling that sustained, trained practice reaches, rather than as a target for anyone.',
  },

  // ── Educational targets ──────────────────────────────────────────────────
  {
    id: 'target-early',
    group: 'Grade 3 and below (about 8 and under)',
    minAge: 4,
    maxAge: 8,
    wpm: 0,
    tier: 'target',
    sourceId: 'nicholson',
    note: 'No speed expectation at all at this age. The recommendation is to work on technique and accuracy only, and to leave speed entirely alone.',
  },
  { id: 'target-g4', group: 'Grade 4 (about 9)', minAge: 9, maxAge: 9, wpm: 14, tier: 'target', sourceId: 'nicholson', note: 'A recommended target of 14 WPM.' },
  { id: 'target-g5', group: 'Grade 5 (about 10)', minAge: 10, maxAge: 10, wpm: 17, tier: 'target', sourceId: 'nicholson', note: 'A recommended target of 17 WPM.' },
  { id: 'target-g6', group: 'Grade 6 (about 11)', minAge: 11, maxAge: 11, wpm: 20, tier: 'target', sourceId: 'nicholson', note: 'A recommended target of 20 WPM.' },
  { id: 'target-g7', group: 'Grade 7 (about 12)', minAge: 12, maxAge: 12, wpm: 25, tier: 'target', sourceId: 'nicholson', note: 'A recommended target of 25 WPM.' },
  {
    id: 'target-teens',
    group: 'Teenagers',
    minAge: 13,
    maxAge: 19,
    wpm: 40,
    wpmLow: 35,
    wpmHigh: 45,
    tier: 'target',
    sourceId: 'nicholson',
    note: 'A recommended range of 35–45 WPM through the teenage years.',
  },
  {
    id: 'target-work',
    group: 'Adults in keyboard-heavy jobs',
    minAge: 18,
    maxAge: 120,
    wpm: 42,
    wpmLow: 35,
    wpmHigh: 50,
    tier: 'target',
    sourceId: 'nicholson',
    note: 'A recommended 35–50 WPM for work where typing is most of the day.',
  },
  {
    id: 'target-handwriting',
    group: 'Any child typing schoolwork',
    minAge: 7,
    maxAge: 16,
    wpm: 10,
    tier: 'target',
    sourceId: 'findenque1986',
    note: 'The threshold worth aiming at first: about 10 WPM is where a child can use a word processor at roughly the speed they write by hand, so typing stops being the slow part.',
  },

  // ── General guidance ─────────────────────────────────────────────────────
  {
    id: 'guide-elementary',
    group: 'Elementary school (grades 3–5)',
    minAge: 8,
    maxAge: 11,
    wpm: 14,
    wpmLow: 8,
    wpmHigh: 20,
    tier: 'guidance',
    sourceId: 'typingcom',
    note: 'A commonly used band of 8–20 WPM, with 85% accuracy suggested as the floor.',
    caveat: 'Published as instructional guidance. No study or measured population is cited for it.',
  },
  {
    id: 'guide-middle',
    group: 'Middle school (grades 6–8)',
    minAge: 11,
    maxAge: 14,
    wpm: 25,
    wpmLow: 20,
    wpmHigh: 30,
    tier: 'guidance',
    sourceId: 'typingcom',
    note: 'A commonly used band of 20–30 WPM, with 90% accuracy suggested as the floor.',
    caveat: 'Instructional guidance, not a measurement.',
  },
  {
    id: 'guide-high',
    group: 'High school (grades 9–12)',
    minAge: 14,
    maxAge: 18,
    wpm: 35,
    wpmLow: 30,
    wpmHigh: 40,
    tier: 'guidance',
    sourceId: 'typingcom',
    note: 'A commonly used band of 30–40 WPM, with 95% accuracy suggested as the floor.',
    caveat: 'Instructional guidance, not a measurement.',
  },
  {
    id: 'guide-adult',
    group: 'College and adult',
    minAge: 18,
    maxAge: 120,
    wpm: 40,
    tier: 'guidance',
    sourceId: 'typingcom',
    note: 'A commonly quoted floor of 40 WPM and above, with 98% accuracy suggested.',
    caveat: 'Instructional guidance. The measured population mean is meaningfully higher, at 51.6 WPM.',
  },
];

export const TIER_META: Record<Tier, { label: string; blurb: string }> = {
  measured: {
    label: 'Published research',
    blurb: 'Figures a study reported observing. The strongest evidence available, and still bounded by who that study happened to measure.',
  },
  target: {
    label: 'Educational target',
    blurb: 'What a learner is being aimed at by a curriculum or a specialist. A goal, not a description of anyone, and not a pass mark.',
  },
  guidance: {
    label: 'General guidance',
    blurb: 'Rules of thumb in wide circulation whose underlying data is not published. Useful for orientation, worth nothing as proof.',
  },
};

/** The rows offered for a given age, most specific first. */
export function benchmarksForAge(age: number): Benchmark[] {
  const inRange = BENCHMARKS.filter((b) => age >= b.minAge && age <= b.maxAge);
  const span = (b: Benchmark) => b.maxAge - b.minAge;
  const tierRank: Record<Tier, number> = { measured: 0, target: 1, guidance: 2 };
  return inRange.sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || span(a) - span(b));
}

export type Standing = 'above' | 'around' | 'approaching' | 'below-target' | 'no-target';

export interface Comparison {
  benchmark: Benchmark;
  standing: Standing;
  /** Difference in WPM. Positive means faster than the benchmark. */
  delta: number;
  /** The sentence shown to the reader. */
  sentence: string;
}

/**
 * How a result sits against one benchmark.
 *
 * The wording is the point of this function. A child reading their own result
 * must not be told they are behind: they are being compared with a target
 * someone else chose, on a skill they are in the middle of learning. "Around",
 * "on your way to" and "ahead of" are the whole vocabulary, and there is no
 * branch that produces a negative verdict.
 */
export function compare(wpm: number, b: Benchmark): Comparison {
  const target = b.wpm;
  const high = b.wpmHigh ?? target;
  const low = b.wpmLow ?? target;

  if (target === 0) {
    return {
      benchmark: b,
      standing: 'no-target',
      delta: 0,
      sentence: 'There is no speed expectation at this age. Anything you type today is ahead of where the guidance asks you to be, because the guidance asks for careful fingers rather than fast ones.',
    };
  }

  const delta = Math.round((wpm - target) * 10) / 10;
  const band = Math.max(3, target * 0.12);

  if (wpm >= high) {
    return {
      benchmark: b,
      standing: 'above',
      delta,
      sentence: `At ${wpm} WPM you are comfortably ahead of this benchmark${b.wpmHigh ? ` (${low}–${high} WPM)` : ` (${target} WPM)`}.`,
    };
  }
  if (wpm >= low - band) {
    return {
      benchmark: b,
      standing: 'around',
      delta,
      sentence: `At ${wpm} WPM you are currently around this benchmark${b.wpmHigh ? ` (${low}–${high} WPM)` : ` (${target} WPM)`}.`,
    };
  }
  // How far off is not a detail. Telling somebody that forty-six WPM of
  // headroom is "a few weeks of practice" is a lie they will measure against,
  // and the whole page is built on not doing that. The gap picks the sentence.
  const gap = Math.abs(delta);
  const effort = gap <= 8
    ? 'That is close enough to reach with a few weeks of short daily practice.'
    : gap <= 20
      ? 'A gap that size is usually a few months of short daily practice rather than a different kind of person.'
      : 'A gap that size is a long-term goal rather than a next step. The useful target is the one just above where you are now.';
  return {
    benchmark: b,
    standing: 'approaching',
    delta,
    sentence: `At ${wpm} WPM you are on your way to this benchmark${b.wpmHigh ? ` (${low}–${high} WPM)` : ` (${target} WPM)`}. That is ${gap} WPM of headroom. ${effort}`,
  };
}

/**
 * The disclosure the age page leads with, kept next to the data it qualifies
 * so it can never be quietly dropped from the page.
 */
export const NO_AGE_TABLE_NOTE =
  'There is no reliable published table of average typing speed by single year of age. The largest study of modern typing reports one population mean and does not break its results down by age, and its participants were mostly teenagers and young adults who chose to visit a typing site. Anything presenting a precise average for a specific age is extrapolating. This page shows you what each source actually measured or recommended, and labels which is which.';
