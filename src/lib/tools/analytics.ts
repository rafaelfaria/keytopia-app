/**
 * Analytics for the free tools.
 *
 * Thin wrappers over `track` in src/lib/analytics/ga4.ts — no second analytics
 * system, and no direct `gtag` call anywhere in the tools. Everything routes
 * through here so the one rule that matters can be enforced in one place:
 *
 *   **Nothing anybody typed is ever sent.** Not the passage, not the
 *   keystrokes, not a sample of either. Speeds and accuracies go out in coarse
 *   buckets, not as exact scores, and no event carries an identifier.
 *
 * The wrappers are also what keeps the event names consistent. A view fired as
 * `free_tool_view` from one page and `tool_viewed` from another produces two
 * half-populated reports and no way to notice.
 */

import { track } from '../analytics/ga4';
import { accBucket, wpmBucket } from './metrics';
import { isSignedIn } from './storage';

export type ToolId =
  | 'hub'
  | 'typing-speed-test'
  | 'wpm-calculator'
  | 'typing-accuracy-test'
  | 'timed-typing-challenge'
  | 'weak-key-analysis'
  | 'daily-typing-exercise'
  | 'typing-speed-by-age'
  | 'typing-progress-tracker';

type Props = Record<string, string | number | boolean>;

function base(tool: ToolId): Props {
  return { tool, signed_in: isSignedIn() };
}

export function toolView(tool: ToolId): void {
  track('free_tool_view', base(tool));
}

export function toolStarted(tool: ToolId, duration?: number): void {
  track('free_tool_started', { ...base(tool), ...(duration ? { duration_s: duration } : {}) });
}

export function toolRestarted(tool: ToolId): void {
  track('free_tool_restarted', base(tool));
}

/**
 * A finished run. `wpm` and `acc` are bucketed here rather than by the caller,
 * so an exact score cannot leak by somebody forgetting to bucket it.
 */
export function toolCompleted(
  tool: ToolId,
  r: { wpm: number; acc: number; seconds: number },
  extra: Props = {},
): void {
  const props: Props = {
    ...base(tool),
    wpm_range: wpmBucket(r.wpm),
    accuracy_range: accBucket(r.acc),
    duration_s: Math.round(r.seconds),
    ...extra,
  };
  track('free_tool_completed', props);

  // A second, tool-specific event, so the funnels for "took a speed test" and
  // "ran a weak-key analysis" can be read without filtering one shared name.
  const specific: Partial<Record<ToolId, string>> = {
    'typing-speed-test': 'typing_test_completed',
    'typing-accuracy-test': 'accuracy_test_completed',
    'timed-typing-challenge': 'typing_test_completed',
    'weak-key-analysis': 'weak_key_analysis_completed',
    'daily-typing-exercise': 'daily_exercise_completed',
  };
  const name = specific[tool];
  if (name) track(name, props);
}

export function benchmarkCompared(ageGroup: string, wpm: number): void {
  track('benchmark_compared', {
    ...base('typing-speed-by-age'),
    age_group: ageGroup,
    wpm_range: wpmBucket(wpm),
  });
}

export function progressSaved(tool: ToolId, wpm: number, acc: number, manual: boolean): void {
  track('progress_result_saved', {
    ...base(tool),
    wpm_range: wpmBucket(wpm),
    accuracy_range: accBucket(acc),
    entry: manual ? 'manual' : 'automatic',
  });
}

/** A click on a link out of the free tools and into KeyTopia proper. */
export function ctaClick(tool: ToolId, label: string, href: string): void {
  track('free_tool_keytopia_cta_click', { ...base(tool), label, link_url: href });
}
