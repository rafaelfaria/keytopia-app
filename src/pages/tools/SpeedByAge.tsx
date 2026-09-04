/**
 * `/tools/typing-speed-by-age`
 *
 * The page most likely to be copied badly by everyone else, so it is written to
 * be right rather than tidy.
 *
 * The honest position, stated at the top of the page and not buried under the
 * widget: there is no reliable published table of average typing speed by
 * single year of age. The largest study of modern typing reports one population
 * mean and does not break it down by age. So this page shows what each source
 * actually measured or recommended, keeps published research, educational
 * targets and circulating rules of thumb in visibly separate groups, and cites
 * every one.
 *
 * The second rule is about tone. A child reading their own result is being
 * compared against a target an adult chose for a curriculum, on a skill they
 * are in the middle of learning. `compare()` in benchmarks.ts has no branch
 * that produces a negative verdict, and this page has no styling that turns one
 * into a red mark.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToolPage, ToolCta } from '../../components/tools/ToolShell';
import { toolByPath } from '../../lib/tools/registry';
import {
  BENCHMARKS, NO_AGE_TABLE_NOTE, POPULATION, SOURCES, TIER_META,
  benchmarksForAge, compare, sourceById, type Tier,
} from '../../lib/tools/benchmarks';
import { lastResult } from '../../lib/tools/storage';
import { benchmarkCompared } from '../../lib/tools/analytics';

const TOOL = toolByPath('/tools/typing-speed-by-age')!;

const AGE_OPTIONS = [
  { value: 7, label: '7 or under' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' },
  { value: 11, label: '11' },
  { value: 12, label: '12' },
  { value: 13, label: '13' },
  { value: 15, label: '14 to 16' },
  { value: 18, label: '17 to 19' },
  { value: 25, label: '20 to 29' },
  { value: 40, label: '30 to 49' },
  { value: 60, label: '50 or over' },
];

const TIER_ORDER: Tier[] = ['measured', 'target', 'guidance'];

export function SpeedByAgePage() {
  const [wpm, setWpm] = useState('');
  const [age, setAge] = useState(25);
  const [prefilled, setPrefilled] = useState<number | null>(null);

  // The result from a test taken elsewhere in the suite, if there is one.
  // Read on mount because localStorage is a browser global and this page is
  // prerendered in Node.
  useEffect(() => {
    const last = lastResult();
    if (last && !wpm) {
      setWpm(String(last.wpm));
      setPrefilled(last.wpm);
    }
    // Intentionally on mount only: re-running this would fight the reader for
    // control of the field every time they cleared it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = useMemo(() => {
    const n = Number(wpm);
    if (!wpm.trim() || !Number.isFinite(n)) return null;
    if (n <= 0 || n > 400) return null;
    return Math.round(n * 10) / 10;
  }, [wpm]);

  const rows = useMemo(() => benchmarksForAge(age), [age]);

  const comparisons = useMemo(
    () => (parsed === null ? [] : rows.map((b) => compare(parsed, b))),
    [parsed, rows],
  );

  useEffect(() => {
    if (parsed === null) return;
    const label = AGE_OPTIONS.find((a) => a.value === age)?.label ?? String(age);
    benchmarkCompared(label, parsed);
  }, [parsed, age]);

  const invalid = wpm.trim() !== '' && parsed === null;

  return (
    <ToolPage tool={TOOL}>
      <section className="tool-body" aria-label="Typing speed benchmark comparison">
        {/* The disclosure comes before the widget, not after it. It is the
            single most useful thing on the page. */}
        <p className="tool-disclosure">{NO_AGE_TABLE_NOTE}</p>

        <form className="tool-form" onSubmit={(e) => e.preventDefault()}>
          <div className="tool-form-row">
            <label className="tool-label" htmlFor="bm-wpm">
              Typing speed (WPM)
              <input
                id="bm-wpm"
                className="tool-input"
                type="number"
                inputMode="decimal"
                min="1"
                max="400"
                step="any"
                value={wpm}
                onChange={(e) => { setWpm(e.target.value); setPrefilled(null); }}
                placeholder="e.g. 45"
                aria-describedby="bm-wpm-help"
              />
            </label>

            <label className="tool-label" htmlFor="bm-age">
              Age
              <select
                id="bm-age"
                className="tool-input"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
              >
                {AGE_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="tool-note" id="bm-wpm-help">
            {prefilled !== null ? (
              <>Filled in with your most recent result from this site, {prefilled} WPM. Change it
                to anything you like.</>
            ) : (
              <>Do not have a figure? The{' '}
                <Link to="/tools/typing-speed-test">typing speed test</Link> takes a minute, and
                this page will pick the result up automatically.</>
            )}
          </p>
        </form>

        <div className="tool-answer" role="status" aria-live="polite">
          {invalid && (
            <p className="tool-problem">
              Enter a typing speed between 1 and 400 WPM. The fastest speeds ever recorded sit
              well inside that range.
            </p>
          )}

          {parsed !== null && (
            <div className="tool-benchmarks">
              {TIER_ORDER.map((tier) => {
                const group = comparisons.filter((c) => c.benchmark.tier === tier);
                if (!group.length) return null;
                return (
                  <section className={`tool-tier is-${tier}`} key={tier} aria-labelledby={`tier-${tier}`}>
                    <h3 id={`tier-${tier}`}>{TIER_META[tier].label}</h3>
                    <p className="tool-tier-blurb">{TIER_META[tier].blurb}</p>

                    <ul className="tool-tier-list">
                      {group.map((c) => (
                        <li key={c.benchmark.id} className={`is-${c.standing}`}>
                          <div className="tool-tier-head">
                            <strong>{c.benchmark.group}</strong>
                            <span className="tool-tier-figure">
                              {c.benchmark.wpm === 0
                                ? 'no speed target'
                                : c.benchmark.wpmHigh
                                  ? `${c.benchmark.wpmLow}–${c.benchmark.wpmHigh} WPM`
                                  : `${c.benchmark.wpm} WPM`}
                            </span>
                          </div>
                          <p className="tool-tier-verdict">{c.sentence}</p>
                          <p className="tool-tier-note">{c.benchmark.note}</p>
                          {c.benchmark.caveat && (
                            <p className="tool-tier-caveat">{c.benchmark.caveat}</p>
                          )}
                          <p className="tool-tier-source">
                            Source: {sourceById(c.benchmark.sourceId).citation}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}

              <div className="tt-again">
                <ToolCta tool="typing-speed-by-age" to="/tools/typing-progress-tracker" kind="soft">
                  Track this over time
                </ToolCta>
                <ToolCta tool="typing-speed-by-age" to="/onboarding">
                  Start practising, it&apos;s free
                </ToolCta>
              </div>

              <p className="tt-handoff">
                The comparison worth making is with yourself last month, not with a benchmark
                somebody else set. That is what the{' '}
                <Link to="/tools/typing-progress-tracker">progress tracker</Link> is for, and it
                needs no account.
              </p>
            </div>
          )}
        </div>

        <section className="pub-section">
          <h2>What the largest study actually found</h2>
          <p>
            Dhakal and colleagues recorded {POPULATION.keystrokes.toLocaleString()} keystrokes
            from {POPULATION.n.toLocaleString()} people and reported a mean of {POPULATION.wpm}{' '}
            words per minute, with a standard deviation of {POPULATION.sd}. Within that sample,
            people reporting formal typing training averaged {POPULATION.trainedWpm} WPM against{' '}
            {POPULATION.untrainedWpm} for those without, so training moves the number by about
            five WPM. The average uncorrected error rate, meaning mistakes left in the finished
            text, was {POPULATION.uncorrectedErrorPct}%.
          </p>
          <p className="tool-tier-caveat">{POPULATION.sampleNote}</p>
        </section>

        <section className="pub-section">
          <h2>Every source on this page</h2>
          <ol className="tool-sources">
            {SOURCES.map((s) => (
              <li key={s.id}>
                {s.citation}{' '}
                {s.url && (
                  <a href={s.url} rel="noopener noreferrer nofollow" target="_blank">{s.url}</a>
                )}
              </li>
            ))}
          </ol>
          <p className="tool-note">
            {BENCHMARKS.length} benchmark rows, drawn from {SOURCES.length} sources, each labelled
            with which of the three kinds of claim it is. Nothing on this page is an average
            computed by KeyTopia from its own users, and nothing is interpolated between the
            figures a source published.
          </p>
        </section>
      </section>
    </ToolPage>
  );
}

export default SpeedByAgePage;
