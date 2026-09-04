/**
 * The registries have to agree with each other.
 *
 * A tool lives in four places: the SEO registry (which drives the canonical
 * URL, the sitemap, robots.txt, llms.txt, the OG image and the footer), the
 * tools registry (the hub and the in-suite nav), the content module (the
 * intro, the article and the FAQs), and the two route maps in main.tsx and
 * entry-prerender.tsx. Any one of those being out of step produces a fault
 * that survives review: a page in the sitemap with no component behind it, a
 * hub card that 404s, a canonical pointing somewhere that does not exist.
 *
 * These tests are the reason those cannot ship.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGES, pageByPath, pageTitle, SITE_URL, absUrl } from '../seo/site';
import { TOOL_PAGES, TOOL_PAGE_PATHS } from '../seo/toolsPages';
import { TOOLS, TOOLS_BASE, TOOL_PATHS, toolByPath, toolsIn, CATEGORIES } from './registry';
import { TOOL_CONTENT, TOOLS_HUB_FAQS, contentForPath } from '../seo/toolsContent';
import { jsonLdForPath } from '../seo/jsonLd';
import { BENCHMARKS, SOURCES, benchmarksForAge, compare, sourceById } from './benchmarks';
import { BLOG_POSTS } from '../blog/posts';

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

describe('every tool route exists everywhere it must', () => {
  it('the two registries list the same paths', () => {
    expect([...TOOL_PATHS].sort()).toEqual([...TOOL_PAGE_PATHS].sort());
  });

  it('every tool has an SEO registry entry', () => {
    for (const path of TOOL_PATHS) {
      expect(pageByPath(path), `missing registry entry for ${path}`).toBeDefined();
    }
  });

  it('every tool page is registered in the client router', () => {
    const main = read('src/main.tsx');
    for (const path of TOOL_PATHS) {
      expect(main, `no <Route> for ${path}`).toContain(`path="${path}"`);
    }
  });

  it('every tool page is registered with the prerenderer', () => {
    const entry = read('src/entry-prerender.tsx');
    for (const path of TOOL_PATHS) {
      expect(entry, `no prerender component for ${path}`).toContain(`'${path}':`);
    }
  });

  it('every registry page the prerenderer will be handed has a component', () => {
    // `routes()` walks PUBLIC_PAGES, and `render()` throws for anything with no
    // component. This asserts the tools half of that contract.
    const entry = read('src/entry-prerender.tsx');
    for (const page of PUBLIC_PAGES.filter((p) => p.group === 'Tools')) {
      expect(entry, `prerender would throw on ${page.path}`).toContain(`'${page.path}':`);
    }
  });

  it('every tool has written content', () => {
    for (const t of TOOLS) expect(() => contentForPath(t.path)).not.toThrow();
    expect(Object.keys(TOOL_CONTENT).sort()).toEqual(TOOLS.map((t) => t.path).sort());
  });
});

describe('the URLs are what they claim to be', () => {
  it('uses the short, descriptive paths under /tools', () => {
    expect(TOOL_PATHS).toEqual([
      '/tools',
      '/tools/typing-speed-test',
      '/tools/typing-accuracy-test',
      '/tools/timed-typing-challenge',
      '/tools/wpm-calculator',
      '/tools/weak-key-analysis',
      '/tools/typing-speed-by-age',
      '/tools/daily-typing-exercise',
      '/tools/typing-progress-tracker',
    ]);
  });

  it('resolves each to a canonical absolute URL', () => {
    for (const path of TOOL_PATHS) {
      expect(absUrl(path)).toBe(`${SITE_URL}${path}`);
    }
  });

  it('has no trailing slashes or uppercase', () => {
    for (const path of TOOL_PATHS) {
      expect(path).toMatch(/^\/tools(\/[a-z0-9-]+)?$/);
    }
  });
});

describe('SEO metadata', () => {
  const pages = TOOL_PAGES;

  it('gives every page a distinct title and description', () => {
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
  });

  it('keeps descriptions in a length search engines will use', () => {
    for (const p of pages) {
      expect(p.description.length, `${p.path} description`).toBeGreaterThan(110);
      expect(p.description.length, `${p.path} description`).toBeLessThan(340);
    }
  });

  it('brand-suffixes the title', () => {
    for (const p of pages) expect(pageTitle(p)).toContain('KeyTopia');
  });

  it('groups them under Tools so the footer and llms.txt pick them up', () => {
    for (const p of pages) expect(p.group).toBe('Tools');
  });

  it('gives every page an llms.txt note', () => {
    for (const p of pages) expect(p.llmsNote.length).toBeGreaterThan(40);
  });
});

describe('structured data', () => {
  it('describes the hub as a list of the eight tools', () => {
    const graph = jsonLdForPath(pageByPath(TOOLS_BASE)!) as { '@graph': Record<string, unknown>[] };
    const list = graph['@graph'].find((n) => n['@type'] === 'ItemList') as
      { numberOfItems: number; itemListElement: { url: string }[] };
    expect(list).toBeDefined();
    expect(list.numberOfItems).toBe(TOOLS.length);
    expect(list.itemListElement.map((i) => i.url).sort())
      .toEqual(TOOLS.map((t) => absUrl(t.path)).sort());
  });

  it('describes each tool as a free SoftwareApplication', () => {
    for (const t of TOOLS) {
      const graph = jsonLdForPath(pageByPath(t.path)!) as { '@graph': Record<string, unknown>[] };
      const app = graph['@graph'].find((n) => n['@type'] === 'SoftwareApplication') as
        { url: string; isAccessibleForFree: boolean; offers: { price: string } };
      expect(app, `no SoftwareApplication node for ${t.path}`).toBeDefined();
      expect(app.url).toBe(absUrl(t.path));
      expect(app.isAccessibleForFree).toBe(true);
      expect(app.offers.price).toBe('0');
    }
  });

  it('never claims a rating nobody gave', () => {
    for (const path of TOOL_PATHS) {
      const json = JSON.stringify(jsonLdForPath(pageByPath(path)!));
      expect(json).not.toContain('aggregateRating');
      expect(json).not.toContain('reviewCount');
    }
  });

  it('emits a FAQPage only where the page actually shows those questions', () => {
    for (const t of TOOLS) {
      const graph = jsonLdForPath(pageByPath(t.path)!) as { '@graph': Record<string, unknown>[] };
      const faq = graph['@graph'].find((n) => n['@type'] === 'FAQPage') as
        { mainEntity: { name: string }[] } | undefined;
      const written = contentForPath(t.path).faqs;
      expect(faq, `no FAQPage for ${t.path}`).toBeDefined();
      expect(faq!.mainEntity.map((q) => q.name)).toEqual(written.map((f) => f.question));
    }
  });

  it('gives the hub the FAQs the hub renders', () => {
    const graph = jsonLdForPath(pageByPath(TOOLS_BASE)!) as { '@graph': Record<string, unknown>[] };
    const faq = graph['@graph'].find((n) => n['@type'] === 'FAQPage') as { mainEntity: { name: string }[] };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(TOOLS_HUB_FAQS.map((f) => f.question));
  });

  it('breadcrumbs a tool through the hub', () => {
    const graph = jsonLdForPath(pageByPath('/tools/typing-speed-test')!) as
      { '@graph': Record<string, unknown>[] };
    const crumbs = graph['@graph'].find((n) => n['@type'] === 'BreadcrumbList') as
      { itemListElement: { item: string }[] };
    expect(crumbs.itemListElement.map((i) => i.item)).toEqual([
      absUrl('/'), absUrl('/tools'), absUrl('/tools/typing-speed-test'),
    ]);
  });
});

describe('the hub and the cross-links', () => {
  it('puts every tool in exactly one category', () => {
    const covered = CATEGORIES.flatMap((c) => toolsIn(c.id));
    expect(covered).toHaveLength(TOOLS.length);
    expect(new Set(covered.map((t) => t.id)).size).toBe(TOOLS.length);
  });

  it('has at least two tools in every category', () => {
    for (const c of CATEGORIES) expect(toolsIn(c.id).length).toBeGreaterThanOrEqual(2);
  });

  it('only ever points at tools that exist', () => {
    for (const t of TOOLS) {
      for (const next of t.next) {
        expect(toolByPath(next), `${t.id} points at ${next}, which does not exist`).toBeDefined();
      }
    }
  });

  it('never sends a tool to itself', () => {
    for (const t of TOOLS) expect(t.next).not.toContain(t.path);
  });

  it('leaves no tool unreachable from another tool', () => {
    const linkedTo = new Set(TOOLS.flatMap((t) => t.next));
    for (const t of TOOLS) {
      expect(linkedTo.has(t.path), `${t.path} is a dead end nobody links to`).toBe(true);
    }
  });

  it('links every tool to blog articles that actually exist', () => {
    // A mistyped slug does not 404: the router falls through to a redirect, so
    // the link silently goes nowhere useful and nobody notices for months.
    // Checked against the article registry rather than against a shape.
    const slugs = new Set(BLOG_POSTS.map((p) => p.slug));
    for (const t of TOOLS) {
      const reading = contentForPath(t.path).reading;
      expect(reading.length, `${t.path} has no further reading`).toBeGreaterThanOrEqual(3);
      for (const r of reading) {
        expect(r.path).toMatch(/^\/blog\/[a-z0-9-]+$/);
        const slug = r.path.slice('/blog/'.length);
        expect(slugs.has(slug), `${t.path} links to /blog/${slug}, which is not an article`).toBe(true);
      }
    }
  });
});

describe('the written content', () => {
  it('gives every tool an intro of roughly 50 to 120 words', () => {
    for (const t of TOOLS) {
      const words = contentForPath(t.path).intro.split(/\s+/).length;
      expect(words, `${t.path} intro is ${words} words`).toBeGreaterThanOrEqual(45);
      expect(words, `${t.path} intro is ${words} words`).toBeLessThanOrEqual(130);
    }
  });

  it('gives every tool 400 to 1000 words of supporting content', () => {
    for (const t of TOOLS) {
      const words = contentForPath(t.path).sections
        .flatMap((s) => s.paragraphs).join(' ').split(/\s+/).length;
      expect(words, `${t.path} body is ${words} words`).toBeGreaterThanOrEqual(380);
      expect(words, `${t.path} body is ${words} words`).toBeLessThanOrEqual(1100);
    }
  });

  it('gives every tool three to six FAQs', () => {
    for (const t of TOOLS) {
      const faqs = contentForPath(t.path).faqs;
      expect(faqs.length, `${t.path} has ${faqs.length} FAQs`).toBeGreaterThanOrEqual(3);
      expect(faqs.length, `${t.path} has ${faqs.length} FAQs`).toBeLessThanOrEqual(6);
      for (const f of faqs) {
        expect(f.question).toMatch(/\?$/);
        expect(f.answer.length).toBeGreaterThan(60);
      }
    }
  });

  it('asks each question only once across the whole suite', () => {
    const all = TOOLS.flatMap((t) => contentForPath(t.path).faqs.map((f) => f.question));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the benchmark data', () => {
  it('attaches a real source to every row', () => {
    for (const b of BENCHMARKS) expect(() => sourceById(b.sourceId)).not.toThrow();
  });

  it('cites every source it lists', () => {
    const used = new Set(BENCHMARKS.map((b) => b.sourceId));
    for (const s of SOURCES) expect(used.has(s.id), `${s.id} is cited by nothing`).toBe(true);
  });

  it('keeps the three kinds of claim apart', () => {
    const tiers = new Set(BENCHMARKS.map((b) => b.tier));
    expect(tiers).toEqual(new Set(['measured', 'target', 'guidance']));
  });

  it('caveats every small-sample or unsourced row', () => {
    for (const b of BENCHMARKS.filter((x) => x.tier === 'guidance')) {
      expect(b.caveat, `${b.id} presents guidance with no caveat`).toBeTruthy();
    }
  });

  it('offers something for every age the picker allows', () => {
    for (const age of [7, 8, 9, 10, 11, 12, 13, 15, 18, 25, 40, 60]) {
      expect(benchmarksForAge(age).length, `nothing for age ${age}`).toBeGreaterThan(0);
    }
  });

  it('puts published research before recommendations', () => {
    const tiers = benchmarksForAge(25).map((b) => b.tier);
    expect(tiers.indexOf('measured')).toBeLessThan(tiers.lastIndexOf('guidance'));
  });

  it('never tells anybody they are behind', () => {
    // The one rule this page cannot break. A child comparing themselves with a
    // curriculum target must not be given a verdict, only a position.
    const forbidden = /behind|below average|failing|too slow|poor|bad\b/i;
    for (const b of BENCHMARKS) {
      for (const wpm of [1, 5, 10, 20, 35, 50, 80, 150]) {
        const c = compare(wpm, b);
        expect(c.sentence, `"${c.sentence}"`).not.toMatch(forbidden);
        expect(['above', 'around', 'approaching', 'no-target']).toContain(c.standing);
      }
    }
  });

  it('recognises a result that clears the benchmark', () => {
    const adult = BENCHMARKS.find((b) => b.id === 'pop-all')!;
    expect(compare(80, adult).standing).toBe('above');
    expect(compare(50, adult).standing).toBe('around');
    expect(compare(15, adult).standing).toBe('approaching');
  });

  it('says there is no target where there is no target', () => {
    const early = BENCHMARKS.find((b) => b.id === 'target-early')!;
    expect(compare(3, early).standing).toBe('no-target');
    expect(compare(40, early).standing).toBe('no-target');
  });

  it('never invents a figure with false precision', () => {
    for (const b of BENCHMARKS) {
      expect(Number.isFinite(b.wpm)).toBe(true);
      // At most one decimal place: anything finer would be claiming a precision
      // no source on this page actually published.
      expect(String(b.wpm)).toMatch(/^\d+(\.\d)?$/);
    }
  });
});
