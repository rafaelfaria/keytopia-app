/**
 * The chrome every free-tool page wears.
 *
 * Wraps the site's existing `PublicPage` rather than replacing it, so a tool
 * page has the same header, hero, breadcrumbs, footer and SEO head as every
 * other public page. What this adds on top is the part that makes eight pages
 * feel like one suite: a strip of sibling tools, the "you are here" state, and
 * a single place to fire the view event.
 *
 * SSR-safe. This tree is rendered to static HTML in Node by the prerenderer, so
 * nothing here may touch a browser global outside an effect.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PublicPage } from '../public/PublicPage';
import { pageByPath } from '../../lib/seo/site';
import { CATEGORIES, TOOLS, TOOLS_BASE, toolByPath, type ToolEntry } from '../../lib/tools/registry';
import { contentForPath } from '../../lib/seo/toolsContent';
import { ctaClick, toolView, type ToolId } from '../../lib/tools/analytics';
import type { Faq, GuideSection } from '../../lib/seo/content';

/** Page definitions are guaranteed present: the registry drives the router. */
const def = (path: string) => {
  const p = pageByPath(path);
  if (!p) throw new Error(`No PublicPage registered for ${path}`);
  return p;
};

/**
 * The suite navigation.
 *
 * Real links, rendered into the static HTML, so a crawler that finds one tool
 * finds all eight, and a reader who landed on the accuracy test from a search
 * result can see there are seven other things here without going back.
 */
export function ToolNav({ current }: { current: string }) {
  return (
    <nav className="tool-nav" aria-label="Free typing tools">
      <Link to={TOOLS_BASE} className={`tool-nav-link${current === TOOLS_BASE ? ' is-on' : ''}`}>
        All tools
      </Link>
      {TOOLS.map((t) => (
        <Link
          key={t.path}
          to={t.path}
          className={`tool-nav-link${current === t.path ? ' is-on' : ''}`}
          aria-current={current === t.path ? 'page' : undefined}
        >
          {t.name}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The hint shown to somebody on a touchscreen.
 *
 * Rendered as a note rather than a block: a phone visitor can still use every
 * tool here, and telling them to go away would be both rude and wrong. It only
 * appears once the client has actually detected a coarse pointer, so the
 * prerendered HTML never claims to know what device you are on.
 */
export function TouchNote() {
  const touch = useIsTouch();
  if (!touch) return null;
  return (
    <p className="tool-touch-note" role="note">
      You are on a touchscreen. Everything here works, but a speed measured on an
      on-screen keyboard is not comparable with one from a physical keyboard. For a
      result worth tracking, come back at a real keyboard.
    </p>
  );
}

export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  return touch;
}

/** A link out of the free tools and into KeyTopia, counted when it is used. */
export function ToolCta({ tool, to, kind = 'primary', children }: {
  tool: ToolId;
  to: string;
  kind?: 'primary' | 'soft';
  children: ReactNode;
}) {
  return (
    <Link
      className={`btn btn-${kind} btn-big`}
      to={to}
      onClick={() => ctaClick(tool, typeof children === 'string' ? children : to, to)}
    >
      {children}
    </Link>
  );
}

/**
 * The block every tool ends with: what to do next, inside the suite and inside
 * KeyTopia. Contextual links rather than a marketing wall, and it only ever
 * appears below a finished result, never in front of one.
 */
export function NextInSuite({ tool }: { tool: ToolEntry }) {
  return (
    <section className="tool-next" aria-labelledby="tool-next-h">
      <h2 id="tool-next-h">Where to go from here</h2>
      <div className="tool-next-grid">
        {tool.next.map((path) => {
          const t = toolByPath(path);
          if (!t) return null;
          return (
            <Link className="tool-next-card" to={path} key={path}>
              <strong>{t.name}</strong>
              <span>{t.blurb}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Faqs({ faqs }: { faqs: Faq[] }) {
  return (
    <section className="pub-section" aria-labelledby="tool-faq-h">
      <h2 id="tool-faq-h">Questions people ask</h2>
      <div className="pub-faq">
        {faqs.map((f) => (
          <details className="pub-faq-item" key={f.question} open>
            <summary><h3>{f.question}</h3></summary>
            <p>{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Sections({ sections }: { sections: GuideSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <section className="pub-section" key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
          {s.bullets && (
            <ul className="pub-bullets">
              {s.bullets.map((b) => <li key={b.slice(0, 40)}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

/**
 * A whole tool page: the interactive part on top, then the writing.
 *
 * The order is not negotiable and is enforced by this component rather than by
 * each page remembering. Somebody who searched for "typing speed test" wants to
 * type, not to read nine hundred words about typing first, and burying the tool
 * under an article is the single most common way these pages get made useless.
 */
export function ToolPage({ tool, children }: { tool: ToolEntry; children: ReactNode }) {
  const page = def(tool.path);
  const content = contentForPath(tool.path);

  useEffect(() => { toolView(tool.id); }, [tool.id]);

  return (
    <PublicPage page={page} lede={content.intro}>
      <ToolNav current={tool.path} />

      {tool.typing && <TouchNote />}

      {/* The tool itself. Everything below this point is supporting material. */}
      {children}

      <NextInSuite tool={tool} />

      <Sections sections={content.sections} />

      <Faqs faqs={content.faqs} />

      <section className="pub-section">
        <h2>Further reading</h2>
        <ul className="pub-bullets tool-reading">
          {content.reading.map((r) => (
            <li key={r.path}><Link to={r.path}>{r.label}</Link></li>
          ))}
        </ul>
      </section>

      <section className="pub-cta-band">
        <h2>A test measures. It does not teach.</h2>
        <p>
          KeyTopia turns the keys that slowed you down into the practice text for your next
          session, and keeps doing it as they improve. It is free, carries no advertising, and
          works without an account until you want your progress to follow you between devices.
        </p>
        <div className="pub-cta-row">
          <ToolCta tool={tool.id} to="/onboarding">Start practising, it&apos;s free</ToolCta>
          <ToolCta tool={tool.id} to="/learn-to-type" kind="soft">Read the method first</ToolCta>
        </div>
      </section>
    </PublicPage>
  );
}

export { CATEGORIES };
