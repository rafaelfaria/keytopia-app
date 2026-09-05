/**
 * SSR entry used only at build time by scripts/prerender.mjs.
 *
 * It renders the public pages to static HTML so that crawlers which do not
 * execute JavaScript — every AI agent crawler, most link-preview bots, and
 * Googlebot on its first pass — see the real content instead of an empty
 * `<div id="root">`.
 *
 * It must never import the store, the sound engine, GSAP or Three.js: those
 * touch browser globals at module scope and would crash in Node. That is why
 * the home page is prerendered from `HomeOutline` (a text-faithful version of
 * the landing page built from the same content data) rather than from
 * `Landing.tsx` itself.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import BlogIndex from './pages/blog/BlogIndex';
import BlogPostPage from './pages/blog/BlogPost';
import { articleBySlug } from './lib/blog/registry';
import {
  AdaptivePracticePage, AnalyticsPage, CurriculumPage, FaqPage, GlossaryPage,
  HomeOutline, KidsPage, LearnToTypePage, PracticeModesPage, PrivacyPage,
  RacesPage, SchoolsPage, TermsPage, TypingGamesPage,
} from './pages/public/pages';
import { NotFoundPage } from './pages/public/NotFound';
import { TypingTestPage } from './pages/public/TypingTest';
import {
  AccuracyTestPage, DailyExercisePage, ProgressTrackerPage, SpeedByAgePage,
  SpeedTestPage, TimedChallengePage, ToolsHubPage, WeakKeysPage, WpmCalculatorPage,
} from './pages/tools';
import { buildHead, buildNoIndexHead, headToHtml } from './lib/seo/head';
import { pageByPath, PUBLIC_PAGES, SITE_NAME, type PublicPage as PublicPageDef } from './lib/seo/site';

// Re-exported so scripts/gen-seo.mjs can reach the generators through the same
// compiled bundle rather than needing its own TypeScript pipeline.
export {
  allUrls, buildLlmsTxt, buildRobotsTxt, buildSitemapIndexXml, buildSitemapXml,
} from './lib/seo/generators';
// llms-full.txt lives apart because it is the one generator that needs the
// article prose. Only build-time callers reach it.
export { buildLlmsFullTxt } from './lib/seo/generatorsFull';
export { SITE_URL, PUBLIC_PAGES } from './lib/seo/site';
// Re-exported so scripts/prerender.mjs can fail the build on a broken internal
// link, a duplicate publication day or an article with no prose.
export { validateBlog } from './lib/blog/registry';

const ROUTES: Record<string, () => React.ReactElement> = {
  '/': HomeOutline,
  '/typing-test': TypingTestPage,
  '/learn-to-type': LearnToTypePage,
  '/curriculum': CurriculumPage,
  '/typing-games': TypingGamesPage,
  '/adaptive-practice': AdaptivePracticePage,
  '/typing-practice-modes': PracticeModesPage,
  '/typing-races': RacesPage,
  '/typing-analytics': AnalyticsPage,
  '/typing-for-kids': KidsPage,
  '/typing-for-schools': SchoolsPage,
  '/faq': FaqPage,
  '/typing-glossary': GlossaryPage,
  '/privacy': PrivacyPage,
  '/terms': TermsPage,

  // The free tools. Prerendered like every other public page, which is what
  // gives a crawler the explanatory content, the FAQs and the tool's own
  // passage as real HTML before any JavaScript runs. Each page is written so
  // that the parts which depend on the clock or on localStorage render as
  // real explanatory content in Node and fill in on mount.
  '/tools': ToolsHubPage,
  '/tools/typing-speed-test': SpeedTestPage,
  '/tools/wpm-calculator': WpmCalculatorPage,
  '/tools/typing-accuracy-test': AccuracyTestPage,
  '/tools/timed-typing-challenge': TimedChallengePage,
  '/tools/weak-key-analysis': WeakKeysPage,
  '/tools/daily-typing-exercise': DailyExercisePage,
  '/tools/typing-speed-by-age': SpeedByAgePage,
  '/tools/typing-progress-tracker': ProgressTrackerPage,
};

export interface Rendered {
  path: string;
  /** Markup for `<div id="root">`. */
  body: string;
  /** Serialised `<head>` content: title, meta, canonical, JSON-LD. */
  head: string;
}

/**
 * The 404 document's route.
 *
 * Not a PublicPage: it must never appear in the sitemap, robots.txt or
 * llms.txt, which are all derived from PUBLIC_PAGES. It is prerendered anyway,
 * because a static host needs a real file to serve with a 404 status.
 */
export const NOT_FOUND_ROUTE = '/404';

export function routes(): string[] {
  return [...PUBLIC_PAGES.map((p) => p.path), NOT_FOUND_ROUTE];
}

export function render(path: string): Rendered {
  // The 404 page is rendered before the registry lookup, since by definition it
  // has no registry entry. `noindex, nofollow`, no canonical, no JSON-LD.
  if (path === NOT_FOUND_ROUTE) {
    const body = renderToStaticMarkup(
      <StaticRouter location={path}>
        <NotFoundPage />
      </StaticRouter>,
    );
    return { path, body, head: headToHtml(buildNoIndexHead(`Page not found | ${SITE_NAME}`)) };
  }

  const page = pageByPath(path);
  if (!page) throw new Error(`No PublicPage registered for ${path}`);

  // The blog is matched by shape rather than listed above: there is one route
  // per published article and they are derived from the schedule, so a hand-
  // written map would go stale on the first day nobody remembered to edit it.
  if (path === '/blog' || path.startsWith('/blog/')) return renderBlog(path, page);

  const Page = ROUTES[path];
  if (!Page) throw new Error(`No prerender component registered for ${path}`);

  const body = renderToStaticMarkup(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>,
  );

  return { path, body, head: headToHtml(buildHead(page)) };
}

/**
 * The blog routes, rendered through a real `<Routes>` rather than as a bare
 * component: the article page reads its slug from `useParams`, which only has a
 * value when a matched route put it there.
 */
function renderBlog(path: string, page: PublicPageDef): Rendered {
  const body = renderToStaticMarkup(
    <StaticRouter location={path}>
      <Routes>
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
      </Routes>
    </StaticRouter>,
  );

  // The article's word count, reading time and FAQ list come from parsing its
  // Markdown, and they are what turn its head into BlogPosting + FAQPage
  // structured data rather than a bare WebPage.
  const slug = path.startsWith('/blog/') ? path.slice('/blog/'.length) : '';
  const article = slug ? articleBySlug(slug) : undefined;
  const head = article
    ? buildHead(page, { faqs: article.faqs, words: article.words, timeRequired: `PT${article.minutes}M` })
    : buildHead(page);

  return { path, body, head: headToHtml(head) };
}
