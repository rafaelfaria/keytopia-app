/**
 * Where an article's metadata meets its prose.
 *
 * This module imports the bodies, so it is the heavy half of the blog and must
 * only ever be reached from the two blog routes — which main.tsx loads lazily.
 * src/lib/seo/site.ts deliberately imports ./posts instead, so the sitemap and
 * the page registry cost the main bundle nothing but metadata.
 *
 * Parsing is memoised per slug. An article is parsed at most once per process,
 * whether that process is a browser tab or the prerenderer walking fifty routes.
 */

import { BODIES } from './bodies';
import {
  BLOG_POSTS, postBySlug, postPath, type BlogPost,
} from './posts';
// The live set is decided by the SEO layer, which is also what the sitemap and
// the prerenderer read — so "reachable" and "in the sitemap" cannot disagree.
import { LIVE_POSTS } from '../seo/site';
import {
  extractFaqs, internalLinks, parseMarkdown, readingMinutes, wordCount,
  tableOfContents, type Block, type Faq, type Heading,
} from './markdown';

export interface Article {
  post: BlogPost;
  /** ISO publication date, derived from the day number. */
  date: string;
  blocks: Block[];
  toc: Heading[];
  faqs: Faq[];
  minutes: number;
  words: number;
}

const CACHE = new Map<string, Article>();

const LIVE_SLUGS = new Set(LIVE_POSTS.map((p) => p.slug));

/** Whether an article has reached its publication date in this build. */
export const isLive = (slug: string): boolean => LIVE_SLUGS.has(slug);

/**
 * An article, if it is published.
 *
 * The live check is here rather than in the route, because every caller needs
 * it: without it a scheduled article would be absent from the sitemap and yet
 * fully readable at its own URL, which is the one combination the drip is meant
 * to prevent.
 */
export function articleBySlug(slug: string): Article | undefined {
  if (!isLive(slug)) return undefined;
  const cached = CACHE.get(slug);
  if (cached) return cached;

  const post = postBySlug(slug);
  const source = BODIES[slug];
  if (!post || !source) return undefined;

  const blocks = parseMarkdown(source);
  const article: Article = {
    post,
    date: post.publishedAt,
    blocks,
    toc: tableOfContents(blocks),
    faqs: extractFaqs(blocks),
    minutes: readingMinutes(blocks),
    words: wordCount(blocks),
  };
  CACHE.set(slug, article);
  return article;
}

/**
 * The curated "keep reading" set.
 *
 * Scheduled articles are dropped rather than shown: a card is a promise that
 * there is something to read behind it, and one that bounces to the index is
 * worse than three cards instead of four.
 */
export function relatedPosts(post: BlogPost): BlogPost[] {
  return post.related
    .map(postBySlug)
    .filter((p): p is BlogPost => p !== undefined && p.slug !== post.slug && isLive(p.slug));
}

/**
 * The articles either side of this one, published only.
 *
 * "Previous" is the older article and "next" the newer one, which is the
 * direction a reader working through the archive expects.
 */
export function neighbours(post: BlogPost): { prev?: BlogPost; next?: BlogPost } {
  const byDay = BLOG_POSTS.filter((p) => isLive(p.slug));
  const i = byDay.findIndex((p) => p.slug === post.slug);
  if (i === -1) return {};
  return { prev: byDay[i - 1], next: byDay[i + 1] };
}

/** The pillar a post belongs under, if it is not itself one. */
export function pillarFor(post: BlogPost): BlogPost | undefined {
  if (post.pillar) return undefined;
  const pillar = BLOG_POSTS.find((p) => p.pillar && p.category === post.category);
  return pillar && isLive(pillar.slug) ? pillar : undefined;
}

/**
 * How an in-article internal link should render.
 *
 * Site pages always resolve. A link to another article resolves only once that
 * article is live; before then it renders as plain text, so the cross-links
 * written for the whole campaign can sit in the prose from day one without
 * pointing anywhere broken.
 */
export function resolveArticleHref(href: string): string | false {
  const path = href.split('#')[0].replace(/\/$/, '') || '/';
  if (!path.startsWith('/blog/')) return href;
  return isLive(path.slice('/blog/'.length)) ? href : false;
}

// ── Build-time validation ──────────────────────────────────────────────────

/** Public routes an article may link to besides other articles. */
const SITE_PATHS = new Set([
  '/', '/typing-test', '/learn-to-type', '/curriculum', '/typing-games',
  '/adaptive-practice', '/typing-practice-modes', '/typing-races', '/typing-analytics',
  '/typing-for-kids', '/typing-for-schools', '/faq', '/typing-glossary',
  '/privacy', '/terms', '/blog', '/signin', '/onboarding',
]);

export interface BlogProblem { slug: string; problem: string }

/**
 * Every check that should fail a build rather than ship quietly.
 *
 * A broken internal link in a fifty-article cluster is invisible in review and
 * expensive in ranking, so `npm run build` runs this and stops. It also catches
 * the two mistakes a schedule of this size invites: a post with no prose, and
 * two posts landing on the same day.
 */
export function validateBlog(): BlogProblem[] {
  const problems: BlogProblem[] = [];
  const dates = new Map<string, string>();
  const slugs = new Set<string>();

  for (const post of BLOG_POSTS) {
    if (slugs.has(post.slug)) problems.push({ slug: post.slug, problem: 'duplicate slug' });
    slugs.add(post.slug);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt)) {
      problems.push({ slug: post.slug, problem: `publishedAt is not an ISO date: ${post.publishedAt}` });
    }
    // Two articles on one date is legal in the model and almost never intended:
    // spreading the campaign out is the whole point of scheduling it.
    const clash = dates.get(post.publishedAt);
    if (clash) problems.push({ slug: post.slug, problem: `publishes on ${post.publishedAt}, same day as ${clash}` });
    dates.set(post.publishedAt, post.slug);

    const source = BODIES[post.slug];
    if (!source) {
      problems.push({ slug: post.slug, problem: 'no article body' });
      continue;
    }

    const stated = post.readingMinutes;
    const actual = readingMinutes(parseMarkdown(source));
    if (stated !== actual) {
      problems.push({ slug: post.slug, problem: `readingMinutes says ${stated}, the prose reads as ${actual}` });
    }

    for (const href of internalLinks(source)) {
      const path = href.split('#')[0].replace(/\/$/, '') || '/';
      if (SITE_PATHS.has(path)) continue;
      const blogSlug = path.startsWith('/blog/') ? path.slice('/blog/'.length) : null;
      if (blogSlug && postBySlug(blogSlug)) continue;
      problems.push({ slug: post.slug, problem: `link to unknown path ${href}` });
    }

    if (internalLinks(source).some((h) => h === postPath(post))) {
      problems.push({ slug: post.slug, problem: 'links to itself' });
    }
  }

  for (const slug of Object.keys(BODIES)) {
    if (!postBySlug(slug)) problems.push({ slug, problem: 'body has no registry entry' });
  }

  return problems;
}
