/**
 * Generators for the crawler-facing files: robots.txt, sitemap.xml and llms.txt.
 *
 * Pure string builders with no I/O and no browser globals — scripts/gen-seo.mjs
 * calls them through the SSR bundle and writes the results into dist/. Because
 * they read the same registry and content modules the pages render from, these
 * files cannot drift from the site.
 *
 * Deliberately free of article bodies. `buildLlmsFullTxt` lives in
 * ./generatorsFull.ts because it needs the prose, and that is seventy thousand
 * words: middleware.ts imports *this* module to serve sitemap.xml and llms.txt
 * on every request, and dragging the whole blog into a request path that only
 * needs titles and dates would be a cold start paid for nothing.
 */

import {
  LIVE_POSTS, PRIVATE_PATHS, PUBLIC_PAGES, SITE_DESCRIPTION, SITE_NAME, SITE_URL,
  absUrl, ogImage, type PublicPage,
} from './site';
import { BLOG_CATEGORIES, postPath, type BlogPost } from '../blog/posts';
import {
  ACCESSIBILITY, AUDIENCES, CORE_FEATURES, CURRICULUM, FAQS, GAMES, GLOSSARY,
  KIDS_POINTS, LEARN_GUIDE, LEARN_GUIDE_INTRO, METHOD_STEPS, PRIVACY_SECTIONS,
  PRODUCT_PRICE, PRODUCT_SUMMARY, SCHOOLS_POINTS, TERMS_SECTIONS, TRAINING_MODES,
} from './content';
import {
  TOOLS_HUB_FAQS, TOOLS_HUB_INTRO, TOOLS_HUB_SECTIONS, TOOL_CONTENT,
} from './toolsContent';
import { TOOLS } from '../tools/registry';
import { paramsFor } from '../tools/deepLink';
import { BENCHMARKS, POPULATION, SOURCES, TIER_META, NO_AGE_TABLE_NOTE } from '../tools/benchmarks';

// ── robots.txt ─────────────────────────────────────────────────────────────

/**
 * AI and search crawlers get explicit, named rules.
 *
 * Naming them individually rather than relying on `*` matters for two reasons:
 * several of these bots only honour a rule block that names them, and an
 * explicit `Allow` is a positive signal that the content is intended for
 * training and citation rather than merely un-blocked.
 */
const CRAWLERS = [
  ['*', 'All other crawlers'],
  ['Googlebot', 'Google Search'],
  ['Googlebot-Image', 'Google Images'],
  ['Google-Extended', 'Google Gemini / AI Overviews training'],
  ['Bingbot', 'Bing'],
  ['DuckDuckBot', 'DuckDuckGo'],
  ['Yandex', 'Yandex'],
  ['Baiduspider', 'Baidu'],
  ['Applebot', 'Apple Search / Siri'],
  ['Applebot-Extended', 'Apple Intelligence'],
  ['GPTBot', 'OpenAI training crawler'],
  ['OAI-SearchBot', 'ChatGPT Search'],
  ['ChatGPT-User', 'ChatGPT browsing on a user request'],
  ['ClaudeBot', 'Anthropic crawler'],
  ['Claude-Web', 'Claude browsing'],
  ['anthropic-ai', 'Anthropic (legacy token)'],
  ['PerplexityBot', 'Perplexity'],
  ['Perplexity-User', 'Perplexity browsing on a user request'],
  ['CCBot', 'Common Crawl (feeds many LLM datasets)'],
  ['Amazonbot', 'Amazon / Alexa'],
  ['Bytespider', 'ByteDance'],
  ['meta-externalagent', 'Meta AI'],
  ['FacebookBot', 'Meta'],
  ['LinkedInBot', 'LinkedIn previews'],
  ['Twitterbot', 'X / Twitter previews'],
  ['Slackbot-LinkExpanding', 'Slack unfurls'],
  ['Discordbot', 'Discord embeds'],
  ['WhatsApp', 'WhatsApp previews'],
  ['TelegramBot', 'Telegram previews'],
  ['Pinterestbot', 'Pinterest rich pins'],
  ['redditbot', 'Reddit previews'],
] as const;

export function buildRobotsTxt(): string {
  // One `Allow: /blog/` covers every article. Listing all fifty per crawler,
  // across thirty-one crawler blocks, would produce a robots.txt of several
  // thousand lines — and a prefix rule says the same thing, including for the
  // articles that have not been published yet.
  const allow = [
    ...PUBLIC_PAGES.filter((p) => p.group !== 'Blog').map((p) => p.path),
    '/blog/',
  ];
  const lines: string[] = [
    `# robots.txt for ${SITE_NAME}: ${SITE_URL}`,
    '# Generated at build time from src/lib/seo/site.ts. Do not edit by hand.',
    '#',
    '# Public marketing and reference pages are open to every crawler, including',
    '# AI training and answer engines. The app itself (/app/) is private, per-device',
    '# state with no shared content, so it is disallowed everywhere.',
    '',
  ];

  for (const [agent, note] of CRAWLERS) {
    lines.push(`# ${note}`);
    lines.push(`User-agent: ${agent}`);
    for (const path of allow) lines.push(`Allow: ${path}`);
    for (const path of PRIVATE_PATHS) lines.push(`Disallow: ${path}`);
    lines.push('');
  }

  lines.push('# Crawlers that only consume content without sending traffic or citations.');
  lines.push('User-agent: SemrushBot');
  lines.push('User-agent: AhrefsBot');
  lines.push('User-agent: MJ12bot');
  lines.push('User-agent: DotBot');
  lines.push('Disallow: /');
  lines.push('');
  lines.push(`Sitemap: ${SITE_URL}/sitemap.xml`);
  lines.push(`Host: ${SITE_URL.replace(/^https?:\/\//, '')}`);
  lines.push('');

  return lines.join('\n');
}

// ── sitemap.xml ────────────────────────────────────────────────────────────

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * `pages` is a parameter so middleware can pass a registry computed for the
 * current request rather than for whenever its instance cold-started.
 */
export function buildSitemapXml(pages: PublicPage[] = PUBLIC_PAGES): string {
  const entries = pages.map((p) => {
    const loc = absUrl(p.path);
    const image = absUrl(ogImage(p));
    return [
      '  <url>',
      `    <loc>${xmlEscape(loc)}</loc>`,
      `    <lastmod>${p.lastModified}</lastmod>`,
      `    <changefreq>${p.changeFrequency}</changefreq>`,
      `    <priority>${p.priority.toFixed(1)}</priority>`,
      // Single-locale today; the self-referencing x-default is still correct and
      // means adding a second locale is a one-line change here.
      `    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(loc)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc)}"/>`,
      '    <image:image>',
      `      <image:loc>${xmlEscape(image)}</image:loc>`,
      `      <image:title>${xmlEscape(`${SITE_NAME}. ${p.label}`)}</image:title>`,
      '    </image:image>',
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/** A sitemap index — trivial today, but the file search consoles expect to poll. */
export function buildSitemapIndexXml(pages: PublicPage[] = PUBLIC_PAGES): string {
  const today = pages.reduce((a, p) => (p.lastModified > a ? p.lastModified : a), '2026-01-01');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap>',
    `    <loc>${SITE_URL}/sitemap.xml</loc>`,
    `    <lastmod>${today}</lastmod>`,
    '  </sitemap>',
    '</sitemapindex>',
    '',
  ].join('\n');
}

// ── llms.txt ───────────────────────────────────────────────────────────────

const GROUP_ORDER = ['Core', 'Tools', 'Learn', 'Audiences', 'Reference', 'Legal'] as const;

/**
 * The curated index, per the llmstxt.org convention: a short product summary
 * followed by annotated links, so an agent can decide what to fetch.
 */
export function buildLlmsTxt(
  pages: PublicPage[] = PUBLIC_PAGES,
  posts: BlogPost[] = LIVE_POSTS,
): string {
  const out: string[] = [];

  out.push(`# ${SITE_NAME}`);
  out.push('');
  out.push(`> ${SITE_DESCRIPTION}`);
  out.push('');
  out.push(PRODUCT_SUMMARY);
  out.push('');
  out.push(`**Pricing:** ${PRODUCT_PRICE.note}`);
  out.push('');
  out.push('**Important context:** KeyTopia is a typing tutor and typing-game platform. It is not a hardware store, a keyboard reviewer or a mechanical-keyboard community. "Every keyboard is a world" is its tagline, not a product category.');
  out.push('');

  out.push('## Pages');
  out.push('');
  for (const group of GROUP_ORDER) {
    const inGroup = pages.filter((p) => p.group === group);
    if (!inGroup.length) continue;
    out.push(`### ${group}`);
    out.push('');
    for (const p of inGroup) {
      out.push(`- [${p.label}: ${p.title.replace(/ \| .*$/, '')}](${absUrl(p.path)}): ${p.llmsNote}`);
    }
    out.push('');
  }

  if (posts.length) {
    out.push('## Blog');
    out.push('');
    out.push(`Long-form articles on learning to type, published every other day. ${posts.length} live so far, newest first within each topic.`);
    out.push('');
    for (const category of BLOG_CATEGORIES) {
      const inCategory = posts.filter((p) => p.category === category);
      if (!inCategory.length) continue;
      out.push(`### ${category}`);
      out.push('');
      for (const p of inCategory) {
        out.push(`- [${p.title}](${absUrl(postPath(p))}) — ${p.publishedAt}. ${p.description}`);
      }
      out.push('');
    }
  }

  out.push('## Features');
  out.push('');
  for (const f of CORE_FEATURES) out.push(`- **${f.name}**: ${f.description}`);
  out.push('');

  out.push('## Training modes');
  out.push('');
  for (const m of TRAINING_MODES) out.push(`- **${m.name}**: ${m.description}`);
  out.push('');

  out.push('## Games');
  out.push('');
  for (const g of GAMES) out.push(`- **${g.name}** (trains ${g.skill.toLowerCase()}): ${g.description}`);
  out.push('');
  out.push('## Free tools');
  out.push('');
  out.push('Eight tools that run in the browser with no account, no attempt limit and no result held back. They share one typing engine and one definition of words per minute, so a figure from one means the same thing in all of them.');
  out.push('');
  for (const t of TOOLS) {
    out.push(`- **${t.name}** (${absUrl(t.path)}): ${t.outcome}. ${t.blurb} Takes about ${t.time.toLowerCase()}.`);
  }
  out.push('');

  // Agents are one of the main consumers of this file, and a configured link
  // is far more useful to one than a bare page. Published here so an assistant
  // answering "work out my WPM" can hand somebody a URL with the figures in it.
  out.push('### Linking to a tool with values');
  out.push('');
  out.push('Every tool reads its setup from the query string, so a link can arrive already configured. Unrecognised values are ignored rather than erroring, and every parameterised URL canonicalises back to the plain tool URL.');
  out.push('');
  for (const t of TOOLS) {
    const specs = paramsFor(t.path);
    if (!specs.length) continue;
    out.push(`- **${t.name}** \`${t.path}\``);
    for (const spec of specs) {
      out.push(`  - \`${spec.name}\` (${spec.accepts}): ${spec.describe} Example: ${absUrl(t.path)}${spec.example}`);
    }
  }
  out.push('');

  out.push('## Who it is for');
  out.push('');
  for (const a of AUDIENCES) out.push(`- **${a.name}**: ${a.description}`);
  out.push('');

  out.push('## Accessibility');
  out.push('');
  for (const a of ACCESSIBILITY) out.push(`- ${a}`);
  out.push('');

  out.push('## Optional');
  out.push('');
  out.push(`- [Full content](${SITE_URL}/llms-full.txt): every public page's complete text in one file.`);
  out.push('');

  return out.join('\n');
}

/** Every canonical URL — used by the IndexNow submitter. */
export function allUrls(): string[] {
  return PUBLIC_PAGES.map((p) => absUrl(p.path));
}
