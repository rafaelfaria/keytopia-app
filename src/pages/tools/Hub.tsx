/**
 * `/tools` — the free-tools hub.
 *
 * This was a dump, and the diagnosis is worth keeping because it is easy to
 * rebuild by accident. Four things were wrong at once:
 *
 *  1. A sixty-word paragraph sat above every tool, so somebody who searched for
 *     "typing speed test" read about engine architecture before they could see
 *     that a typing speed test existed.
 *  2. The nine-item tool nav sat directly on top of the eight tool cards. The
 *     same links, twice, touching. That alone made the page feel like clutter
 *     rather than a directory.
 *  3. The cards said what each tool *was* and never what you *got*. Eight
 *     similar-sounding names with no outcome attached is not a menu, it is a
 *     list, and a reader cannot choose from it.
 *  4. Three prose sections and five open accordions closed the page, which is
 *     roughly nine hundred words of undifferentiated grey under the only part
 *     anybody came for.
 *
 * So: one line of lede, one obvious front door, cards that lead with the
 * outcome and the time it costs, the claims as three short panels instead of
 * three essays, and the reading collapsed to headings. The nav strip is gone
 * from this page and kept on the individual tools, where it is navigation
 * rather than a duplicate of the thing below it.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicPage } from '../../components/public/PublicPage';
import { pageByPath } from '../../lib/seo/site';
import { CATEGORIES, TOOLS, TOOLS_BASE, toolByPath, toolsIn } from '../../lib/tools/registry';
import {
  TOOLS_HUB_FAQS, TOOLS_HUB_PROMISE, TOOLS_HUB_PROMISES, TOOLS_HUB_SECTIONS,
} from '../../lib/seo/toolsContent';
import { paramsFor } from '../../lib/tools/deepLink';
import { ctaClick, toolView } from '../../lib/tools/analytics';

/** The front door. Named here rather than inferred, because it is a decision. */
const START_HERE = toolByPath('/tools/typing-speed-test')!;

function ToolCard({ path, featured }: { path: string; featured?: boolean }) {
  const t = toolByPath(path);
  if (!t) return null;
  return (
    <Link className={`tool-card${featured ? ' is-featured' : ''}`} to={t.path}>
      <strong>{t.name}</strong>
      {/* The outcome, not the description. A reader scanning eight cards is
          comparing what they walk away with. */}
      <span className="tool-card-outcome">{t.outcome}</span>
      <span className="tool-card-blurb">{t.blurb}</span>
      <em>
        <span>{t.time}</span>
        <span>{t.typing ? 'Physical keyboard' : 'Any device'}</span>
      </em>
    </Link>
  );
}

export function ToolsHubPage() {
  const page = pageByPath(TOOLS_BASE)!;

  useEffect(() => { toolView('hub'); }, []);

  return (
    <PublicPage page={page} lede={TOOLS_HUB_PROMISE}>
      {/* ── The front door ────────────────────────────────────────────────
          A directory of eight equals gives nobody a first move. One of them is
          the answer for almost everybody who arrives, so it is offered as an
          action rather than as the first of eight cards. */}
      <section className="tool-start" aria-labelledby="start-here">
        <div className="tool-start-body">
          <p className="tool-start-eyebrow">Start here</p>
          <h2 id="start-here">How fast do you actually type?</h2>
          <p>
            Sixty seconds, no sign-up, and a real number at the end: your speed, your accuracy,
            and the mistakes that cost you the difference. Every other tool on this page can pick
            that result up.
          </p>
          <div className="tool-start-actions">
            <Link
              className="btn btn-primary btn-big"
              to={START_HERE.path}
              onClick={() => ctaClick('hub', 'start here', START_HERE.path)}
            >
              Take the 60-second test
            </Link>
            <Link className="tool-start-alt" to="/tools/weak-key-analysis">
              Or find out which keys slow you down
            </Link>
          </div>
        </div>
        <ul className="tool-start-facts">
          <li><b>8</b><span>tools, all free</span></li>
          <li><b>0</b><span>sign-ups needed</span></li>
          <li><b>1</b><span>shared definition of WPM</span></li>
        </ul>
      </section>

      {/* ── The suite, as three steps ─────────────────────────────────────
          The categories were already the right three groups; what they lacked
          was any statement that they are sequential. Numbering them is the
          whole fix: it turns a taxonomy into an instruction. */}
      {CATEGORIES.map((cat, i) => (
        <section className="tool-cat" key={cat.id} aria-labelledby={`cat-${cat.id}`}>
          <div className="tool-cat-head">
            <span className="tool-cat-step" aria-hidden>{i + 1}</span>
            <div>
              <h2 id={`cat-${cat.id}`}>{cat.title}</h2>
              <p className="tool-cat-blurb">{cat.blurb}</p>
            </div>
          </div>
          <div className="tool-grid">
            {toolsIn(cat.id).map((t) => (
              <ToolCard key={t.path} path={t.path} featured={t.path === START_HERE.path} />
            ))}
          </div>
        </section>
      ))}

      {/* ── The claims ───────────────────────────────────────────────────── */}
      <section className="pub-section" aria-labelledby="promises">
        <h2 id="promises">What makes these different</h2>
        <div className="tool-promises">
          {TOOLS_HUB_PROMISES.map((p) => (
            <article className="tool-promise" key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Deep links ────────────────────────────────────────────────────
          Every tool takes its setup from its URL, which is what makes one
          shareable, embeddable in a lesson plan, or usable as an advert that
          demonstrates the thing rather than describing it. The table is
          generated from the same declarations the parsers use, so it cannot
          document a parameter that does not exist. */}
      <section className="pub-section" aria-labelledby="deep-links">
        <h2 id="deep-links">Link straight to a tool, already set up</h2>
        <p>
          Add a parameter to any tool&apos;s address and it opens configured. Useful for a lesson
          plan, a support reply, an article, or a link you want to come back to. A value that
          makes no sense is ignored rather than breaking the page, and every one of these
          canonicalises back to the plain tool URL.
        </p>
        <div className="tool-table-wrap">
          <table className="tool-table tool-params">
            <caption>Every parameter every tool accepts</caption>
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Parameter</th>
                <th scope="col">Accepts</th>
                <th scope="col">Example</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => {
                const specs = paramsFor(t.path);
                return specs.map((spec, i) => (
                  <tr key={`${t.path}-${spec.name}`}>
                    {i === 0 && (
                      <th scope="row" rowSpan={specs.length}>
                        <Link to={t.path}>{t.name}</Link>
                      </th>
                    )}
                    <td><code>{spec.name}</code></td>
                    <td>{spec.accepts}</td>
                    <td>
                      <Link to={`${t.path}${spec.example}`}>
                        <code>{spec.example}</code>
                      </Link>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
        <p className="tool-note">
          For example,{' '}
          <Link to="/tools/wpm-calculator?words=60&time=1"><code>/tools/wpm-calculator?words=60&amp;time=1</code></Link>{' '}
          opens the calculator with the answer already on screen, and{' '}
          <Link to="/tools/weak-key-analysis?keys=rtp"><code>/tools/weak-key-analysis?keys=rtp</code></Link>{' '}
          opens straight into a drill for R, T and P. Each tool also has a button that builds the
          link for whatever you are currently looking at.
        </p>
      </section>

      {/* ── The reading ──────────────────────────────────────────────────── */}
      {TOOLS_HUB_SECTIONS.map((s) => (
        <section className="pub-section" key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
        </section>
      ))}

      <section className="pub-section" aria-labelledby="beyond">
        <h2 id="beyond">The tools measure. KeyTopia teaches.</h2>
        <p>
          Nothing on this page will make you faster on its own. Improvement comes from practising
          the specific keys that are slow, which is what the rest of KeyTopia does, and it is free
          as well.
        </p>
        <div className="tool-elsewhere">
          <Link to="/curriculum"><strong>The curriculum</strong><span>41 lessons, rebuilt around your keyboard layout</span></Link>
          <Link to="/adaptive-practice"><strong>Adaptive practice</strong><span>Practice text generated from your own weak keys</span></Link>
          <Link to="/typing-games"><strong>Typing games</strong><span>Nine games, each naming the skill it trains</span></Link>
          <Link to="/typing-races"><strong>Races</strong><span>Rivals with real habits, and private rooms</span></Link>
          <Link to="/learn-to-type"><strong>How to learn</strong><span>The whole method in one page</span></Link>
          <Link to="/blog"><strong>The blog</strong><span>Deeper answers to individual questions</span></Link>
        </div>
      </section>

      {/* Closed by default. Five open accordions is not an FAQ, it is five more
          paragraphs at the bottom of a page that already had too many. */}
      <section className="pub-section" aria-labelledby="hub-faq">
        <h2 id="hub-faq">Questions people ask</h2>
        <div className="pub-faq">
          {TOOLS_HUB_FAQS.map((f) => (
            <details className="pub-faq-item" key={f.question}>
              <summary><h3>{f.question}</h3></summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </PublicPage>
  );
}

export default ToolsHubPage;
