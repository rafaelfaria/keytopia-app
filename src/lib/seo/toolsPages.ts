/**
 * The SEO registry entries for the free-tools suite.
 *
 * Kept in their own module rather than typed into the middle of
 * `STATIC_PAGES`: there are nine of them, they share a shape, and they are the
 * one group of pages whose titles and descriptions are written to rank for
 * specific queries rather than to describe a product surface. Splicing them in
 * from here keeps site.ts readable and keeps this file reviewable as a set.
 *
 * Imported by src/lib/seo/site.ts, which is the single list everything else
 * (sitemap, robots, llms.txt, the prerenderer, the OG generator, the footer)
 * still reads from.
 */

import type { PublicPage } from './site';
import { TOOLS_REVISED } from './revisions.generated';

/** Bumped when the tool pages meaningfully change, not on every deploy. */


type ToolPageInput =
  Omit<PublicPage, 'priority' | 'changeFrequency' | 'lastModified' | 'group'>
  & Partial<Pick<PublicPage, 'priority' | 'changeFrequency'>>;

const page = (p: ToolPageInput): PublicPage => ({
  changeFrequency: 'monthly',
  priority: 0.8,
  ...p,
  lastModified: TOOLS_REVISED,
  group: 'Tools',
});

export const TOOL_PAGES: PublicPage[] = [
  page({
    path: '/tools',
    label: 'Free typing tools',
    title: 'Free Typing Tools: speed test, accuracy test, WPM calculator and more',
    description:
      'Eight free typing tools that actually work in your browser: a typing speed test, accuracy ' +
      'test, timed challenge, WPM calculator, weak-key analysis, age benchmarks, a daily exercise ' +
      'and a progress tracker. No sign-up, no attempt limit, results stay on your device.',
    llmsNote:
      'Hub for eight free in-browser typing tools, grouped into testing, understanding and improving. All share one typing engine and one WPM definition.',
    priority: 0.9,
  }),
  page({
    path: '/tools/typing-speed-test',
    label: 'Typing speed test',
    title: 'Free Typing Speed Test: measure your WPM in 60 seconds',
    description:
      'Take a free typing speed test at 15, 30, 60 or 120 seconds. Get your WPM, accuracy, ' +
      'characters typed and mistakes, plus a session best. No sign-up, unlimited attempts, and ' +
      'the result never leaves your browser.',
    llmsNote:
      'Free typing speed test with 15/30/60/120-second options, reporting net and gross WPM, accuracy, characters and uncorrected mistakes.',
    priority: 0.9,
  }),
  page({
    path: '/tools/wpm-calculator',
    label: 'WPM calculator',
    title: 'WPM Calculator: work out words per minute from words or characters',
    description:
      'Calculate typing speed from figures you already have. Enter words or characters and a time ' +
      'in seconds or minutes to get gross WPM, net WPM and characters per minute, with the ' +
      'formula shown. Free, instant, no sign-up.',
    llmsNote:
      'WPM calculator converting a word or character count plus an elapsed time into gross WPM, net WPM and CPM, with the formula displayed.',
  }),
  page({
    path: '/tools/typing-accuracy-test',
    label: 'Typing accuracy test',
    title: 'Typing Accuracy Test: measure precision, not speed',
    description:
      'A free typing test where accuracy is the score. Type real sentences with punctuation and ' +
      'get your accuracy percentage, correct and incorrect characters, corrections made, and the ' +
      'specific keys that produced your errors.',
    llmsNote:
      'Untimed typing accuracy test on punctuated prose, reporting accuracy, correct and incorrect characters, backspaces and per-key error sources.',
  }),
  page({
    path: '/tools/timed-typing-challenge',
    label: 'Timed typing challenge',
    title: 'Timed Typing Challenge: 15 seconds to 5 minutes',
    description:
      'A free timed typing challenge with a countdown from 15 seconds to 5 minutes. The score ' +
      'locks when time expires, and you get WPM, accuracy, correct words, characters and ' +
      'mistakes, plus a result you can copy and share.',
    llmsNote:
      'Timed typing challenge at 15s, 30s, 60s, 2min and 5min, with an accurate countdown, a locked final score and a copyable result. No leaderboard.',
  }),
  page({
    path: '/tools/weak-key-analysis',
    label: 'Weak-key analysis',
    title: 'Weak-Key Analysis: find the exact keys slowing your typing down',
    description:
      'A free typing exercise built to see every letter of the alphabet several times, then a ' +
      'per-key report: accuracy, response time, which keys you confuse with which, and a practice ' +
      'drill generated from your own weakest keys.',
    llmsNote:
      'Per-key typing analysis on a coverage-weighted passage. Reports per-key accuracy and response time with a four-sighting minimum, names confusion pairs, and generates a targeted drill.',
    priority: 0.9,
  }),
  page({
    path: '/tools/daily-typing-exercise',
    label: 'Daily typing exercise',
    title: 'Daily Typing Exercise: a new practice passage every day',
    description:
      'A free typing exercise that changes every calendar day and is the same for everybody. ' +
      'Three to ten minutes of common words, real sentences and awkward letter combinations, with ' +
      'a streak kept in your own browser. No account needed.',
    llmsNote:
      'A deterministic daily typing exercise generated from the calendar date, with a locally stored streak and per-day best result.',
    changeFrequency: 'daily',
  }),
  page({
    path: '/tools/typing-speed-by-age',
    label: 'Typing speed by age',
    title: 'Typing Speed by Age: what research measured, and what schools aim at',
    description:
      'Compare a typing speed against published research and educational targets for any age, ' +
      'with the two kept clearly apart and every figure sourced. Includes the honest answer to why ' +
      'no reliable average-by-age table exists.',
    llmsNote:
      'Age-based typing benchmark comparison. Separates published measurements (Dhakal et al. 2018, n=168,960, mean 51.6 WPM), educational targets and general guidance, with citations, and states that no reliable WPM-by-age table exists.',
  }),
  page({
    path: '/tools/typing-progress-tracker',
    label: 'Typing progress tracker',
    title: 'Typing Progress Tracker: chart your WPM over time, free',
    description:
      'Keep a record of your typing results and see whether you are actually improving. Latest ' +
      'and best speed, average, session count and a trend that resists flukes. Stored in your ' +
      'browser, no account required.',
    llmsNote:
      'Free local typing progress tracker: latest, best and average WPM, accuracy, session count, a half-against-half trend and a chart. Accepts results from the other tools or manual entry.',
  }),
];

/** Just the paths, for the router and the prerenderer to check against. */
export const TOOL_PAGE_PATHS: string[] = TOOL_PAGES.map((p) => p.path);
