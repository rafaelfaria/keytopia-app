/**
 * Deep links: every tool configurable from its URL.
 *
 * A link is the unit of advertising. "Try our WPM calculator" is a link to a
 * blank form; "60 words in 1 minute is 60 WPM, check your own" is a link to a
 * calculator that already has the answer on screen. The second one converts,
 * and the difference between them is a query string.
 *
 * So every tool reads its configuration from the URL, every tool can hand you
 * back a link to whatever you are currently looking at, and the parameters are
 * declared here rather than parsed ad hoc in eight components. That single
 * declaration is what the hub's reference table renders from and what
 * llms.txt publishes, so the documentation cannot drift from the parsers.
 *
 * Three rules the parsers all follow:
 *
 *  - A bad value is ignored, never fatal. A link with `?wpm=banana` shows the
 *    tool in its default state. Advertising links get mangled by mail clients,
 *    truncated by character limits and edited by hand, and a page that throws
 *    on a malformed one is a page that 500s in front of the person the
 *    campaign just paid for.
 *  - Nothing here can write anything. Parameters choose a duration or prefill a
 *    number; none of them can add a row to somebody's saved history, because a
 *    link that silently seeds your results is a link somebody else can send you.
 *  - The canonical URL never changes. Parameters are configuration, not new
 *    pages, so `?duration=30` still canonicalises to the bare tool URL and
 *    cannot fragment its ranking across a dozen near-duplicates.
 *
 * SSR-safe: pure functions over a URLSearchParams-alike.
 */

export interface ParamSpec {
  name: string;
  /** What it does, for the reference table and llms.txt. */
  describe: string;
  /** Accepted values, in human terms. */
  accepts: string;
  /** A complete example query string fragment. */
  example: string;
}

/** A minimal read-only view of the query string. `URLSearchParams` satisfies it. */
export interface Query {
  get(name: string): string | null;
}

// ── Readers ────────────────────────────────────────────────────────────────

/** A number in range, or null. Rejects NaN, Infinity, empty and out-of-range. */
export function readNumber(
  q: Query, name: string, { min, max }: { min: number; max: number },
): number | null {
  const raw = q.get(name);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** One of a fixed set of numbers, or null. Used for durations. */
export function readOneOf<T extends number>(q: Query, name: string, allowed: readonly T[]): T | null {
  const raw = q.get(name);
  if (raw === null) return null;
  const n = Number(raw);
  return (allowed as readonly number[]).includes(n) ? (n as T) : null;
}

/** One of a fixed set of strings, or null. */
export function readEnum<T extends string>(q: Query, name: string, allowed: readonly T[]): T | null {
  const raw = q.get(name)?.trim().toLowerCase();
  if (!raw) return null;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** A `YYYY-MM-DD` calendar day that is a real date, or null. */
export function readDay(q: Query, name: string): string | null {
  const raw = q.get(name)?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects 2026-02-31, which passes the pattern and is not a day.
  const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return real ? raw : null;
}

/**
 * A set of letters to focus on, from `?keys=rtp` or `?keys=r,t,p`.
 *
 * Deduplicated, lowercased, letters only, and capped at four: a drill built
 * from twelve keys is not a drill, and the cap is also what stops a hostile
 * link making the generator do unbounded work.
 */
export function readKeys(q: Query, name: string, limit = 4): string[] {
  const raw = q.get(name);
  if (!raw) return [];
  const seen = new Set<string>();
  for (const ch of raw.toLowerCase()) {
    if (/[a-z]/.test(ch)) seen.add(ch);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

// ── Building ───────────────────────────────────────────────────────────────

/**
 * A tool URL with parameters. Empty, null and undefined values are dropped, so
 * a caller can pass its whole state and get the shortest link that reproduces
 * it rather than a string of `&errors=&unit=`.
 */
export function buildToolPath(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

// ── The declared parameters ────────────────────────────────────────────────

/**
 * Every parameter every tool accepts.
 *
 * The hub renders its reference table from this, llms.txt publishes it, and a
 * test asserts that every tool appears, so a parameter added to a component
 * without a row here is a parameter nobody can discover.
 */
export const TOOL_PARAMS: Record<string, ParamSpec[]> = {
  '/tools/typing-speed-test': [
    {
      name: 'duration',
      describe: 'Preselects the test length, so the link lands on the clock you meant.',
      accepts: '15, 30, 60 or 120 (seconds)',
      example: '?duration=30',
    },
  ],
  '/tools/typing-accuracy-test': [
    {
      name: 'sentences',
      describe: 'How long the passage is, in sentences.',
      accepts: '3 to 10',
      example: '?sentences=8',
    },
  ],
  '/tools/timed-typing-challenge': [
    {
      name: 'duration',
      describe: 'Preselects the countdown, including the five-minute endurance run.',
      accepts: '15, 30, 60, 120 or 300 (seconds)',
      example: '?duration=300',
    },
  ],
  '/tools/wpm-calculator': [
    { name: 'words', describe: 'Prefills the word count and calculates immediately.', accepts: 'any number above 0', example: '?words=60&time=1' },
    { name: 'chars', describe: 'Prefills a character count instead, switching the calculator to characters.', accepts: 'any number above 0', example: '?chars=300&time=60&unit=seconds' },
    { name: 'time', describe: 'Prefills the elapsed time. Read as minutes unless unit says otherwise.', accepts: 'any number above 0', example: '?words=60&time=90&unit=seconds' },
    { name: 'unit', describe: 'Which unit the time is in. Defaults to minutes.', accepts: 'minutes or seconds', example: '?words=60&time=90&unit=seconds' },
    { name: 'errors', describe: 'Prefills uncorrected errors, so the link shows net WPM as well as gross.', accepts: '0 or more', example: '?words=60&time=1&errors=4' },
  ],
  '/tools/weak-key-analysis': [
    {
      name: 'keys',
      describe: 'Skips the analysis and opens a practice drill built from these keys. The link a lesson, a coach or an article can hand somebody directly.',
      accepts: 'up to four letters, together or comma-separated',
      example: '?keys=rtp',
    },
  ],
  '/tools/daily-typing-exercise': [
    {
      name: 'day',
      describe: "Opens a specific day's exercise rather than today's. For a teacher setting Monday's warm-up, or a link that has to keep meaning the same thing after it is sent. Only today's run counts towards a streak.",
      accepts: 'a date as YYYY-MM-DD',
      example: '?day=2026-09-07',
    },
  ],
  '/tools/typing-speed-by-age': [
    { name: 'wpm', describe: 'The speed to compare. Overrides the result picked up from your own last test.', accepts: '1 to 400', example: '?wpm=45&age=10' },
    { name: 'age', describe: 'Which age group to compare against.', accepts: '4 to 120', example: '?wpm=45&age=10' },
  ],
  '/tools/typing-progress-tracker': [
    {
      name: 'goal',
      describe: 'Draws a goal line on the chart and reports how far you are from it. The link to send somebody who has just been told to reach a particular speed.',
      accepts: '1 to 400 (WPM)',
      example: '?goal=60',
    },
  ],
};

export function paramsFor(path: string): ParamSpec[] {
  return TOOL_PARAMS[path] ?? [];
}
