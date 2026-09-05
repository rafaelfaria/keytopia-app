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
import { isPublishedOn, postBySlug, todayIso } from './src/lib/blog/posts';
import { BLOG_SHOW_ALL, livePosts, publicPages } from './src/lib/seo/site';

/**
 * The two generated files, plus every article URL.
 *
 * Without a matcher, middleware runs on every request to the site — including
 * every asset — so it names exactly what it needs. The blog pattern is here
 * because the schedule is enforced at the edge: see `blogGate` below.
 */
export const config = {
  matcher: ['/sitemap.xml', '/llms.txt', '/blog/:slug'],
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

/**
 * The publication schedule, enforced at the edge.
 *
 * Every article is prerendered on every build, scheduled ones included, so that
 * an article going live is a fact about the calendar and never about when the
 * site last built. The cost of that is that the static file for a scheduled
 * article exists and would otherwise be served the moment somebody guessed its
 * URL, which is precisely the "not in the sitemap, yet readable" combination
 * the drip exists to prevent.
 *
 * So the file is on disk and this decides whether anyone may have it. The date
 * is read per request, which is the whole point: nothing has to run, deploy or
 * rebuild for the next article to become available at midnight UTC.
 *
 * An unknown slug is left alone. There is no file behind it, so it falls
 * through to the 404 document like any other unrecognised path.
 */
async function blogGate(request: Request, slug: string): Promise<Response | undefined> {
  const post = postBySlug(slug);
  if (!post) return undefined;
  if (isPublishedOn(post, todayIso(), BLOG_SHOW_ALL)) return undefined;

  // Serve the site's own 404 document rather than a bare body, so a person who
  // guessed a URL gets the real page. Only reachable by guessing, since nothing
  // links to a scheduled article, so the extra fetch costs nothing in practice.
  const notFound = await fetch(new URL('/404.html', request.url));
  return new Response(await notFound.text(), {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cacheable only until the day turns. A scheduled article becomes
      // published on a date boundary, and a 404 cached past it would outlive
      // the reason it was issued.
      'Cache-Control': 'public, max-age=0, s-maxage=300',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith('/blog/')) {
    return blogGate(request, pathname.slice('/blog/'.length));
  }

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
