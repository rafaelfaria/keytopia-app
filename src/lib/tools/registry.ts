/**
 * The free-tools registry: one entry per tool, in one place.
 *
 * This is the list the hub renders from, the list the in-suite navigation
 * renders from, the list the JSON-LD `ItemList` is built from, and the list the
 * llms.txt generator walks. A tool that exists is a row here; a tool that is
 * not a row here does not appear anywhere, which is what stops the hub, the
 * nav and the structured data drifting apart.
 *
 * The SEO registry (src/lib/seo/site.ts) still owns titles, descriptions and
 * canonicals, because those belong to the same list every other public page
 * uses. This holds only what is specific to being a *tool*: the category, the
 * one-line promise, and which other tools it hands off to.
 *
 * SSR-safe: data only.
 */

import type { ToolId } from './analytics';

export type ToolCategory = 'test' | 'understand' | 'improve';

export interface ToolEntry {
  id: ToolId;
  path: string;
  /** Short name, for cards and nav. */
  name: string;
  /** The promise, in one line, on the hub card. */
  blurb: string;
  /**
   * What you walk away holding.
   *
   * Separate from `blurb` because they answer different questions. The blurb
   * says what the tool does; this says what you have afterwards that you did
   * not have before, which is the only thing that makes a directory of eight
   * similar-sounding tools navigable. Written as a noun phrase, deliberately:
   * a reader scanning eight cards is comparing outcomes, not reading sentences.
   */
  outcome: string;
  /** Roughly how long it takes, for the card. */
  time: string;
  category: ToolCategory;
  /** Whether it involves actually typing, which decides the keyboard hint. */
  typing: boolean;
  /** Paths of the tools this one most usefully leads to. */
  next: string[];
}

export const TOOLS_BASE = '/tools';

export const CATEGORIES: { id: ToolCategory; title: string; blurb: string }[] = [
  {
    id: 'test',
    title: 'Test your typing',
    blurb: 'Measure where you actually are. Each of these gives you a real result in under two minutes.',
  },
  {
    id: 'understand',
    title: 'Understand your typing',
    blurb: 'Work out what the number means and which specific keys are costing you the difference.',
  },
  {
    id: 'improve',
    title: 'Improve your typing',
    blurb: 'Something to do tomorrow, and a record of whether it worked.',
  },
];

export const TOOLS: ToolEntry[] = [
  {
    id: 'typing-speed-test',
    path: '/tools/typing-speed-test',
    name: 'Typing speed test',
    blurb: 'A 15, 30, 60 or 120-second test. WPM, accuracy, mistakes and a session best.',
    outcome: 'Your WPM, accuracy and mistake count',
    time: '1 min',
    category: 'test',
    typing: true,
    next: ['/tools/typing-speed-by-age', '/tools/weak-key-analysis', '/tools/typing-progress-tracker'],
  },
  {
    id: 'typing-accuracy-test',
    path: '/tools/typing-accuracy-test',
    name: 'Accuracy test',
    blurb: 'Type a passage as carefully as you can. Accuracy leads; speed is the footnote.',
    outcome: 'An accuracy score and the keys behind your errors',
    time: '2–3 min',
    category: 'test',
    typing: true,
    next: ['/tools/weak-key-analysis', '/tools/daily-typing-exercise', '/tools/wpm-calculator'],
  },
  {
    id: 'timed-typing-challenge',
    path: '/tools/timed-typing-challenge',
    name: 'Timed challenge',
    blurb: 'Pick a clock from 15 seconds to 5 minutes and go. A score you can copy and send.',
    outcome: 'A locked score you can copy and send',
    time: '15 sec – 5 min',
    category: 'test',
    typing: true,
    next: ['/tools/typing-speed-test', '/tools/typing-progress-tracker', '/tools/typing-speed-by-age'],
  },
  {
    id: 'wpm-calculator',
    path: '/tools/wpm-calculator',
    name: 'WPM calculator',
    blurb: 'Words or characters, plus a time. Get gross and net WPM with the formula shown.',
    outcome: 'Gross WPM, net WPM and CPM, with the working shown',
    time: 'Instant',
    category: 'understand',
    typing: false,
    next: ['/tools/typing-speed-test', '/tools/timed-typing-challenge', '/tools/typing-speed-by-age'],
  },
  {
    id: 'weak-key-analysis',
    path: '/tools/weak-key-analysis',
    name: 'Weak-key analysis',
    blurb: 'A passage built to see every letter, then a report on which keys cost you, and a drill for them.',
    outcome: 'A ranked list of your weakest keys, and a drill for them',
    time: '3–4 min',
    category: 'understand',
    typing: true,
    next: ['/tools/daily-typing-exercise', '/tools/typing-accuracy-test', '/tools/typing-progress-tracker'],
  },
  {
    id: 'typing-speed-by-age',
    path: '/tools/typing-speed-by-age',
    name: 'Speed by age',
    blurb: 'Compare a result against what research measured and what schools aim at, kept apart.',
    outcome: 'Where a speed sits against sourced benchmarks',
    time: 'Instant',
    category: 'understand',
    typing: false,
    next: ['/tools/typing-speed-test', '/tools/typing-progress-tracker'],
  },
  {
    id: 'daily-typing-exercise',
    path: '/tools/daily-typing-exercise',
    name: 'Daily exercise',
    blurb: 'One exercise a day, the same for everyone, new tomorrow. Builds a streak in your browser.',
    outcome: 'Today\'s exercise, and a streak for showing up',
    time: '3–10 min',
    category: 'improve',
    typing: true,
    next: ['/tools/typing-progress-tracker', '/tools/weak-key-analysis'],
  },
  {
    id: 'typing-progress-tracker',
    path: '/tools/typing-progress-tracker',
    name: 'Progress tracker',
    blurb: 'Every result you keep, charted. Best, average, latest and whether you are actually improving.',
    outcome: 'A chart of your speed over time, and a real trend',
    time: 'Instant',
    category: 'improve',
    typing: false,
    next: ['/tools/typing-speed-test', '/tools/daily-typing-exercise'],
  },
];

export function toolByPath(path: string): ToolEntry | undefined {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return TOOLS.find((t) => t.path === clean);
}

export function toolsIn(category: ToolCategory): ToolEntry[] {
  return TOOLS.filter((t) => t.category === category);
}

/** Every route the suite owns, hub first. Used by the SEO registry and tests. */
export const TOOL_PATHS: string[] = [TOOLS_BASE, ...TOOLS.map((t) => t.path)];
