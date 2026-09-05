/**
 * llms-full.txt: the complete text of every public page in one fetch.
 *
 * Split from ./generators.ts because it is the only generator that needs the
 * article prose. That import pulls in every word of the blog, which is fine for
 * a build script and wrong for the request path — see the note in generators.ts.
 *
 * Build-time only. Nothing in the browser bundle and nothing in middleware
 * imports this module.
 */

import { LIVE_POSTS, PUBLIC_PAGES, SITE_NAME, absUrl } from './site';
import { postPath } from '../blog/posts';
import { articleBySlug } from '../blog/registry';
import { blocksToText } from '../blog/markdown';
import { buildLlmsTxt } from './generators';
import {
  CURRICULUM, FAQS, GAMES, GLOSSARY, KIDS_POINTS, LEARN_GUIDE, LEARN_GUIDE_INTRO,
  METHOD_STEPS, PRIVACY_SECTIONS, PRODUCT_SUMMARY, SCHOOLS_POINTS, TERMS_SECTIONS,
} from './content';
import {
  TOOLS_HUB_FAQS, TOOLS_HUB_INTRO, TOOLS_HUB_SECTIONS, TOOL_CONTENT,
} from './toolsContent';
import { TOOLS } from '../tools/registry';
import { paramsFor } from '../tools/deepLink';
import {
  BENCHMARKS, NO_AGE_TABLE_NOTE, POPULATION, SOURCES, TIER_META,
} from '../tools/benchmarks';

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
  for (const s of TOOLS_HUB_SECTIONS) {
    out.push(`### ${s.heading}`, '');
    for (const p of s.paragraphs) out.push(p, '');
  }
  out.push('### Deep-link parameters', '');
  for (const t of TOOLS) {
    for (const spec of paramsFor(t.path)) {
      out.push(`- ${t.name}: \`?${spec.name}=\` (${spec.accepts}). ${spec.describe} Example: ${absUrl(t.path)}${spec.example}`);
    }
  }
  out.push('');
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
    const specs = paramsFor(tool.path);
    if (specs.length) {
      out.push('#### Link parameters', '');
      for (const spec of specs) {
        out.push(`- \`?${spec.name}=\` (${spec.accepts}): ${spec.describe} Example: ${absUrl(tool.path)}${spec.example}`);
      }
      out.push('');
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
