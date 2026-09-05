/**
 * The page for a URL that does not exist.
 *
 * Until this existed, there was no 404 anywhere on the site. The catch-all
 * rewrite in vercel.json sent anything that was not a file in dist/ to
 * index.html, and the prerenderer only emitted the public routes, so every
 * unknown path served a byte-identical copy of the home page — with HTTP 200,
 * the home page's canonical, and `robots: index, follow`. A mistyped link, an
 * old campaign URL and a wrong-case slug all looked to a crawler like a real,
 * indexable page that happened to be the home page. Google calls that a soft
 * 404, and an unbounded supply of them is a crawl-budget leak.
 *
 * This route is prerendered to dist/404.html, which Vercel serves with a real
 * 404 status for any unmatched path. It is deliberately absent from
 * PUBLIC_PAGES, so it never reaches the sitemap, robots.txt or llms.txt, and it
 * carries `noindex, nofollow` and no canonical of its own.
 *
 * The scene is decoration over a page that is complete without it. Everything a
 * lost visitor needs — the heading, the explanation, the ways back — is in the
 * prerendered HTML and readable before a line of JavaScript runs, which is what
 * lets ./notfound3d be imported only after mount. This file stays SSR-safe: no
 * store, no browser globals at module scope.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../../components/public/SiteFooter';
import { SiteHeader } from '../../components/public/SiteHeader';

/** The handful of places someone who lands here most likely wanted. */
const WAYS_BACK: { path: string; label: string; note: string }[] = [
  { path: '/typing-test', label: 'Take the typing test', note: 'Sixty seconds, your WPM, accuracy and per-key timing.' },
  { path: '/learn-to-type', label: 'Learn to type', note: 'The full guide to touch typing, from posture to plateaus.' },
  { path: '/tools', label: 'The free tools', note: 'Speed test, accuracy test, WPM calculator and five more.' },
  { path: '/blog', label: 'The blog', note: 'Guides, honest benchmarks and the science of practice.' },
];

export function NotFoundPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read once, at first render, and never during SSR. matchMedia does not exist
  // in Node, and the prerendered document is the reduced-motion answer anyway:
  // it has no canvas in it at all.
  const [reduced] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    let cancelled = false;
    let scene: { dispose(): void } | undefined;

    void (async () => {
      const { NotFoundScene } = await import('../notfound3d');
      if (cancelled || !canvasRef.current) return;
      scene = new NotFoundScene(canvasRef.current, reduced);
    })();

    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, [reduced]);

  return (
    <div className="pub-root nf-root" data-page="/404">
      <SiteHeader />
      <main className="pub-main" id="main">
        <section className="nf-stage">
          {/* aria-hidden and not focusable: the scene says nothing the copy
              below does not, so a screen reader should walk straight past it. */}
          <canvas ref={canvasRef} className="nf-canvas" aria-hidden="true" />
          <div className="nf-copy">
            <p className="nf-code">404</p>
            <h1 className="pub-h1 nf-h1">This page is not on the map</h1>
            <p className="pub-lede nf-lede">
              The link you followed points at something that is not here. It may have moved, or the
              address may have picked up a typo on the way.
            </p>
            <Link to="/" className="nf-home">Back to the home page</Link>
          </div>
        </section>

        <div className="pub-wrap">
          <h2 className="nf-ways-title">Where you might have been going</h2>
          <ul className="nf-ways">
            {WAYS_BACK.map((w) => (
              <li key={w.path}>
                <Link to={w.path}>
                  <strong>{w.label}</strong>
                  <span>{w.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
