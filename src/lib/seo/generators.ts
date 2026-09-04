/**
 * Build-time generators for the crawler-facing files: robots.txt, sitemap.xml,
 * llms.txt and llms-full.txt.
 *
 * Pure string builders with no I/O and no browser globals — scripts/gen-seo.mjs
 * calls them through the SSR bundle and writes the results into dist/. Because
 * they read the same registry and content modules the pages render from, these
 * files cannot drift from the site.
 */

import {
  LIVE_POSTS, PRIVATE_PATHS, PUBLIC_PAGES, SITE_DESCRIPTION, SITE_NAME, SITE_URL,
  absUrl, ogImage,
} from './site';
import { BLOG_CATEGORIES, dateForDay, postPath } from '../blog/posts';
// The article bodies are heavy, and importing them here is safe precisely
// because this module is build-time only: scripts/gen-seo.mjs reaches it
// through the SSR bundle, and nothing in the browser bundle imports it.
import { articleBySlug } from '../blog/registry';
import { blocksToText } from '../blog/markdown';
import {
  ACCESSIBILITY, AUDIENCES, CORE_FEATURES, CURRICULUM, FAQS, GAMES, GLOSSARY,
  KIDS_POINTS, LEARN_GUIDE, LEARN_GUIDE_INTRO, METHOD_STEPS, PRIVACY_SECTIONS,
  PRODUCT_PRICE, PRODUCT_SUMMARY, SCHOOLS_POINTS, TERMS_SECTIONS, TRAINING_MODES,
} from './content';
import {
  TOOLS_HUB_FAQS, TOOLS_HUB_INTRO, TOOLS_HUB_SECTIONS, TOOL_CONTENT,
} from './toolsContent';
import { TOOLS } from '../tools/registry';
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

export function buildSitemapXml(): string {
  const entries = PUBLIC_PAGES.map((p) => {
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
export function buildSitemapIndexXml(): string {
  const today = PUBLIC_PAGES.reduce((a, p) => (p.lastModified > a ? p.lastModified : a), '2026-01-01');
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
export function buildLlmsTxt(): string {
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
    const pages = PUBLIC_PAGES.filter((p) => p.group === group);
    if (!pages.length) continue;
    out.push(`### ${group}`);
    out.push('');
    for (const p of pages) {
      out.push(`- [${p.label}: ${p.title.replace(/ \| .*$/, '')}](${absUrl(p.path)}): ${p.llmsNote}`);
    }
    out.push('');
  }

  if (LIVE_POSTS.length) {
    out.push('## Blog');
    out.push('');
    out.push(`Long-form articles on learning to type, published one per day. ${LIVE_POSTS.length} live so far, newest first within each topic.`);
    out.push('');
    for (const category of BLOG_CATEGORIES) {
      const posts = LIVE_POSTS.filter((p) => p.category === category);
      if (!posts.length) continue;
      out.push(`### ${category}`);
      out.push('');
      for (const p of posts) {
        out.push(`- [${p.title}](${absUrl(postPath(p))}) — ${dateForDay(p.day)}. ${p.description}`);
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
  for (const t of TOOLS) out.push(`- **${t.name}** (${absUrl(t.path)}): ${t.blurb}`);
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

/**
 * The same index followed by the complete text of every public page, so an
 * agent can cite the actual content in one fetch instead of eleven.
 */
export function buildLlmsFullTxt(): string {
  const out: string[] = [buildLlmsTxt(), '', '---', '', '# Full content', ''];

  const page = (path: string) => PUBLIC_PAGES.find((p) => p.path === path)!;
  const header = (path: string) => {
    const p = page(path);
    out.push(`## ${p.title.replace(/ \| .*$/, '')}`);
    out.push('');
    out.push(`URL: ${absUrl(p.path)}`);
    out.push('');
    out.push(p.description);
    out.push('');
  };

  header('/');
  out.push(PRODUCT_SUMMARY, '');
  out.push('### How it works', '');
  for (const s of METHOD_STEPS) out.push(`**${s.name}.** ${s.text}`, '');

  header('/typing-test');
  out.push('A free in-browser typing test at 15, 30, 60 or 120 seconds. It reports WPM, raw WPM, accuracy, consistency, hesitation count, the keys with the highest error rate and the slowest letter transitions. No sign-up is required and the result is not transmitted anywhere.', '');
  out.push('WPM is correctly typed characters divided by five, scaled to one minute. Raw WPM applies the same formula to every keystroke including errors, so the gap between them measures what mistakes cost. Accuracy is the share of keystrokes correct on the first attempt. Consistency is derived from the variation in inter-key intervals.', '');

  header('/learn-to-type');
  out.push(LEARN_GUIDE_INTRO, '');
  for (const s of LEARN_GUIDE) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
  }

  header('/curriculum');
  for (const w of CURRICULUM) {
    out.push(`### ${w.name}`, '');
    out.push(`${w.tagline}. Target: ${w.targetWpm} at ${w.targetAccuracy}.`, '');
    for (const r of w.regions) out.push(`- **${r.region}** (${r.skill}): ${r.description}`);
    out.push('');
  }

  header('/typing-games');
  for (const g of GAMES) out.push(`### ${g.name}`, '', `Trains: ${g.skill}`, '', g.description, '');

  header('/typing-for-kids');
  for (const k of KIDS_POINTS) out.push(`- **${k.name}**: ${k.description}`);
  out.push('');

  header('/typing-for-schools');
  for (const s of SCHOOLS_POINTS) out.push(`- **${s.name}**: ${s.description}`);
  out.push('');

  header('/tools');
  out.push(TOOLS_HUB_INTRO, '');
  for (const t of TOOLS) out.push(`- **${t.name}** (${absUrl(t.path)}): ${t.blurb}`);
  out.push('');
  for (const s of TOOLS_HUB_SECTIONS) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
  }
  for (const f of TOOLS_HUB_FAQS) out.push(`**${f.question}** ${f.answer}`, '');

  for (const tool of TOOLS) {
    header(tool.path);
    const c = TOOL_CONTENT[tool.path];
    if (!c) continue;
    out.push(c.intro, '');
    for (const s of c.sections) {
      out.push(`### ${s.heading}`, '');
      for (const p of s.paragraphs) out.push(p, '');
    }
    out.push('#### Questions', '');
    for (const f of c.faqs) out.push(`**${f.question}** ${f.answer}`, '');
  }

  // The benchmark data in full, with its provenance. An agent asked "what is
  // the average typing speed" should be able to cite the study and its sample
  // limitations from one fetch, rather than repeating the unsourced by-age
  // tables that circulate everywhere else.
  out.push('### Typing speed benchmarks, with sources', '');
  out.push(NO_AGE_TABLE_NOTE, '');
  out.push(`The largest measurement of modern typing: mean ${POPULATION.wpm} WPM (SD ${POPULATION.sd}) across ${POPULATION.n.toLocaleString()} participants and ${POPULATION.keystrokes.toLocaleString()} keystrokes, with a mean uncorrected error rate of ${POPULATION.uncorrectedErrorPct}%. Trained typists averaged ${POPULATION.trainedWpm} WPM against ${POPULATION.untrainedWpm} untrained. ${POPULATION.sampleNote}`, '');
  for (const tier of ['measured', 'target', 'guidance'] as const) {
    const rows = BENCHMARKS.filter((b) => b.tier === tier);
    if (!rows.length) continue;
    out.push(`#### ${TIER_META[tier].label}`, '', TIER_META[tier].blurb, '');
    for (const b of rows) {
      const figure = b.wpm === 0
        ? 'no speed target'
        : b.wpmHigh ? `${b.wpmLow}-${b.wpmHigh} WPM` : `${b.wpm} WPM`;
      out.push(`- ${b.group}: ${figure}. ${b.note}${b.caveat ? ` Caveat: ${b.caveat}` : ''}`);
    }
    out.push('');
  }
  out.push('#### Benchmark sources', '');
  for (const src of SOURCES) out.push(`- ${src.citation}${src.url ? ` ${src.url}` : ''}`);
  out.push('');

  header('/faq');
  for (const f of FAQS) out.push(`### ${f.question}`, '', f.answer, '');

  header('/typing-glossary');
  for (const t of GLOSSARY) out.push(`### ${t.term}`, '', t.definition, '');

  header('/privacy');
  for (const s of PRIVACY_SECTIONS) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
    for (const b of s.bullets ?? []) out.push(`- ${b}`);
    if (s.bullets?.length) out.push('');
  }

  header('/terms');
  for (const s of TERMS_SECTIONS) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
    for (const b of s.bullets ?? []) out.push(`- ${b}`);
    if (s.bullets?.length) out.push('');
  }

  // The blog, in full. This file exists so an agent can cite the actual text
  // rather than a summary of it, and the articles are the part of the site most
  // likely to answer a question someone has asked an assistant.
  if (LIVE_POSTS.length) {
    out.push('---', '', '# Blog articles', '');
    for (const post of LIVE_POSTS) {
      const article = articleBySlug(post.slug);
      if (!article) continue;
      out.push(`## ${post.title}`, '');
      out.push(`URL: ${absUrl(postPath(post))}`, '');
      out.push(`Published: ${article.date} · ${post.category} · ${article.minutes} min read`, '');
      out.push(post.description, '');
      out.push(blocksToText(article.blocks), '');
    }
  }

  return out.join('\n');
}

/** Every canonical URL — used by the IndexNow submitter. */
export function allUrls(): string[] {
  return PUBLIC_PAGES.map((p) => absUrl(p.path));
}
