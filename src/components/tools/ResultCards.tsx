/**
 * The pieces every tool result is assembled from.
 *
 * Deliberately small components rather than one `<Results>` that takes a dozen
 * booleans: the eight tools genuinely want different things at the top of the
 * page. The speed test leads with WPM; the accuracy test leads with accuracy
 * and would be lying if it led with speed. What they must share is the way a
 * number is drawn, its units, and the sentence under it, so that is what lives
 * here.
 *
 * Every result block is announced. `aria-live="polite"` on the container means
 * a screen-reader user hears the outcome when the run finishes, instead of
 * having to go looking for a region that silently appeared.
 */

import type { ReactNode } from 'react';
import { speedBand, accuracyBand } from '../../lib/tools/metrics';

/** A 0–100 meter under a percentage. Nothing to read; it is the shape. */
export function Meter({ pct, tone }: { pct: number; tone?: 'warn' | 'good' }) {
  return (
    <span className={`tt-meter${tone ? ` is-${tone}` : ''}`} aria-hidden>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

/**
 * The headline: one very large number, its unit, and the sentence that stops
 * it being meaningless. Stacked vertically the number left a screen-wide void
 * beside it, so the qualifying text sits alongside.
 */
export function Headline({ value, unit, children }: { value: ReactNode; unit: string; children: ReactNode }) {
  return (
    <div className="tt-score">
      <b className="tt-score-n">{value}</b>
      <div className="tt-score-side">
        <span className="tt-score-unit">{unit}</span>
        <p className="tt-summary">{children}</p>
      </div>
    </div>
  );
}

export interface StatDef {
  /** The figure. */
  value: ReactNode;
  /** A suffix rendered small: '%', 'ms'. */
  suffix?: string;
  label: string;
  /** The plain-English gloss. "30" tells nobody anything on its own. */
  hint: string;
  /** 0–100 for a meter, or undefined for a bare figure. */
  meter?: number;
  tone?: 'warn' | 'good';
}

export function StatGrid({ stats }: { stats: StatDef[] }) {
  return (
    <dl className="tt-stats">
      {stats.map((s) => (
        <div key={s.label}>
          <dt>{s.value}{s.suffix && <i>{s.suffix}</i>}</dt>
          <dd>
            {s.label}<span>{s.hint}</span>
            {s.meter !== undefined && <Meter pct={s.meter} tone={s.tone} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The findings, one line each.
 *
 * These used to run together as a paragraph on the older test page, so four
 * unrelated diagnoses arrived as one block and the reader had to work out
 * which sentence applied to which number. One line per finding is the fix.
 */
export function Findings({ title, notes }: { title: string; notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="tt-notes">
      <h3>{title}</h3>
      <ul>{notes.map((n) => <li key={n.slice(0, 30)}>{n}</li>)}</ul>
    </div>
  );
}

/**
 * The standard reading of a speed and an accuracy together.
 *
 * Centralised so that two tools cannot reach opposite conclusions about the
 * same pair of numbers, which is the sort of thing a reader notices
 * immediately and never trusts you about again.
 */
export function readRun(r: { wpm: number; raw: number; acc: number; backspaces: number; seconds: number }): string[] {
  const notes: string[] = [];
  const gap = Math.max(0, Math.round((r.raw - r.wpm) * 10) / 10);

  if (gap > 0.5) {
    notes.push(`Your mistakes cost you ${gap} WPM. Closing that gap is almost always faster than typing harder.`);
  }
  notes.push(accuracyBand(r.acc).note);
  if (r.acc >= 97) notes.push(speedBand(r.wpm).note);
  if (r.backspaces > r.seconds * 1.5) {
    notes.push('You spent a lot of this run correcting. Every backspace is three keystrokes you did not need to make, so accuracy here is worth more than pace.');
  }
  return notes;
}

/** The panel of per-key evidence, shared by the accuracy and weak-key tools. */
export function KeyBars({ title, rows, unit }: {
  title: string;
  rows: { label: string; pct: number; value: string; sub?: string }[];
  unit?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="tt-panel">
      <h3>{title}</h3>
      <ol className="tt-bars">
        {unit && (
          <li className="tt-bars-head" aria-hidden>
            <span /><span /><span>{unit}</span><span />
          </li>
        )}
        {rows.map((r) => (
          <li key={r.label}>
            <kbd>{r.label}</kbd>
            <span className="tt-bar" aria-hidden>
              <i style={{ width: `${Math.max(2, Math.min(100, r.pct))}%` }} />
            </span>
            <span className="tt-bar-v">{r.value}</span>
            <span className="tt-bar-v is-soft">{r.sub ?? ''}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Wrapper that announces the whole result when it appears. */
export function ResultPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tt-results" aria-live="polite" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** "Not enough typing to say anything", said properly rather than as a zero. */
export function TooShort({ onRetry }: { onRetry: () => void }) {
  return (
    <ResultPanel title="Not enough to measure">
      <p className="tt-summary">
        That run was too short to produce a figure worth showing. A few keystrokes over a
        second or two can be divided into any number at all, so there is nothing here to
        report rather than a misleading one.
      </p>
      <div className="tt-again">
        <button type="button" className="btn btn-primary btn-big" onClick={onRetry}>Try again</button>
      </div>
    </ResultPanel>
  );
}
