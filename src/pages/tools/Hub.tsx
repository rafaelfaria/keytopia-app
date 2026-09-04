/**
 * `/tools` — the free-tools hub.
 *
 * A directory, not a landing page. Somebody arriving here wants to leave for
 * one of the eight tools within a few seconds, so the grid comes first, the
 * categories are the only structure, and the writing is underneath where it
 * cannot get in the way.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicPage } from '../../components/public/PublicPage';
import { pageByPath } from '../../lib/seo/site';
import { CATEGORIES, TOOLS_BASE, toolsIn } from '../../lib/tools/registry';
import {
  TOOLS_HUB_FAQS, TOOLS_HUB_INTRO, TOOLS_HUB_SECTIONS,
} from '../../lib/seo/toolsContent';
import { toolView } from '../../lib/tools/analytics';
import { ToolNav } from '../../components/tools/ToolShell';

export function ToolsHubPage() {
  const page = pageByPath(TOOLS_BASE)!;

  useEffect(() => { toolView('hub'); }, []);

  return (
    <PublicPage page={page} lede={TOOLS_HUB_INTRO}>
      <ToolNav current={TOOLS_BASE} />

      {CATEGORIES.map((cat) => (
        <section className="pub-section tool-cat" key={cat.id} aria-labelledby={`cat-${cat.id}`}>
          <h2 id={`cat-${cat.id}`}>{cat.title}</h2>
          <p className="tool-cat-blurb">{cat.blurb}</p>
          <div className="tool-grid">
            {toolsIn(cat.id).map((t) => (
              <Link className="tool-card" to={t.path} key={t.path}>
                <strong>{t.name}</strong>
                <span>{t.blurb}</span>
                <em>{t.typing ? 'Needs a keyboard' : 'Works anywhere'}</em>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="pub-section">
        <h2>Already know what you want to work on?</h2>
        <p>
          The tools measure. The rest of KeyTopia teaches: a{' '}
          <Link to="/curriculum">41-lesson curriculum</Link> that rebuilds itself around your
          keyboard layout, <Link to="/adaptive-practice">practice text generated from your own
          weak keys</Link>, <Link to="/typing-games">nine typing games</Link> that each name the
          skill they train, and <Link to="/typing-races">races</Link> against rivals with real
          habits. If you would rather read first, the{' '}
          <Link to="/learn-to-type">guide to learning touch typing</Link> is the whole method in
          one page, and the <Link to="/blog">blog</Link> goes deeper on individual questions.
        </p>
      </section>

      {TOOLS_HUB_SECTIONS.map((s) => (
        <section className="pub-section" key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
        </section>
      ))}

      <section className="pub-section" aria-labelledby="hub-faq">
        <h2 id="hub-faq">Questions people ask</h2>
        <div className="pub-faq">
          {TOOLS_HUB_FAQS.map((f) => (
            <details className="pub-faq-item" key={f.question} open>
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
