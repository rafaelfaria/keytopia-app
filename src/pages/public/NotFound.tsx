/**
 * The page for a URL that does not exist.
 *
 * Until this existed, there was no 404 anywhere on the site. The catch-all
 * rewrite in vercel.json sends anything that is not a file in dist/ to
 * index.html, and the prerenderer only emits the public routes, so every
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
 * SSR-safe: no store, no browser globals. This tree is prerendered in Node.
 */

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
  return (
    <div className="pub-root" data-page="/404">
      <SiteHeader />
      <main className="pub-main" id="main">
        <div className="pub-wrap">
          <h1 className="pub-h1">This page does not exist</h1>
          <p className="pub-lede">
            The link you followed points at something that is not here. It may have moved, or the
            address may have picked up a typo on the way.
          </p>

          <h2>Where you might have been going</h2>
          <ul>
            {WAYS_BACK.map((w) => (
              <li key={w.path}>
                <Link to={w.path}>{w.label}</Link>. {w.note}
              </li>
            ))}
          </ul>

          <p>
            Or start from <Link to="/">the home page</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
