/**
 * Vercel Routing Middleware: sitemap.xml and llms.txt, generated per request.
 *
 * The blog publishes on a drip — one article every other day — and both of
 * those files list only the articles whose date has arrived. Generated at build
 * time they are a photograph of deploy day: the site would keep claiming one
 * live article until somebody happened to redeploy, and the schedule would
 * quietly stop advancing with nothing to show that it had.
 *
 * Middleware is what makes this work rather than a `rewrites` rule. Vercel
 * checks the filesystem *before* rewrites, so `dist/sitemap.xml` would win and
 * the rewrite would never fire. Middleware runs before both, so the generated
 * response takes precedence while the static file stays on disk as a fallback
 * for `vite preview` and for any host that is not Vercel.
 *
 * Deliberately importing ./src/lib/seo/generators and not ./generatorsFull:
 * llms-full.txt embeds every word of every article, and that belongs in a build
 * step rather than in the path of every request. It stays a static file.
 */

import { buildLlmsTxt, buildSitemapXml } from './src/lib/seo/generators';
import { livePosts, publicPages } from './src/lib/seo/site';

/**
 * Only these two paths. Without a matcher, middleware runs on every request to
 * the site — including every asset — to serve two files that are asked for a
 * handful of times a day.
 */
export const config = {
  matcher: ['/sitemap.xml', '/llms.txt'],
};

/**
 * Cached at the edge for an hour and served stale for a day while it
 * revalidates, so a crawler burst costs one generation rather than thousands,
 * and the drip still advances within an hour of an article's date.
 *
 * `max-age=0` keeps browsers from holding their own copy: the file changes
 * under them every other day and a stale private cache is the one copy nothing
 * can invalidate.
 */
const CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export default function middleware(request: Request): Response | undefined {
  const { pathname } = new URL(request.url);

  // Both registries are computed here, per request, rather than read from the
  // module-level snapshots. A warm instance's module scope was evaluated at
  // cold start, which on a long-lived instance can be several publication slots
  // ago — exactly the staleness this middleware exists to remove.
  const pages = publicPages();

  if (pathname === '/sitemap.xml') {
    return new Response(buildSitemapXml(pages), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': CACHE,
      },
    });
  }

  if (pathname === '/llms.txt') {
    return new Response(buildLlmsTxt(pages, livePosts()), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': CACHE,
      },
    });
  }

  // Anything else the matcher let through falls through to the filesystem.
  return undefined;
}
