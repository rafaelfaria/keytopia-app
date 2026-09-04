/**
 * A deliberately small Markdown subset, parsed to an AST and rendered to React.
 *
 * Why not a library: this tree is rendered to static HTML in Node by
 * scripts/prerender.mjs, and it is also the source for the article's table of
 * contents, its FAQ structured data and its entry in llms-full.txt. A parser
 * that produces an AST gives all four of those from one pass over one string,
 * and keeps a Markdown runtime out of the browser bundle entirely.
 *
 * The subset is exactly what the articles use — headings, paragraphs, lists,
 * tables, callouts and rules, with bold, italic, code and links inline. Anything
 * outside it renders as literal text rather than silently disappearing, which is
 * the behaviour you want when a typo in an article would otherwise drop a
 * paragraph from a published page.
 *
 * SSR-safe: no browser globals.
 */

import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type Block =
  | { kind: 'heading'; level: 2 | 3; text: string; id: string }
  | { kind: 'para'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'hr' };

/** A heading's anchor: stable, lowercase, and safe in a URL fragment. */
export function headingId(text: string): string {
  return stripInline(text)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

const splitRow = (line: string): string[] =>
  line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

// ── Parser ─────────────────────────────────────────────────────────────────

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (/^---+\s*$/.test(line)) { blocks.push({ kind: 'hr' }); i++; continue; }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({
        kind: 'heading',
        level: heading[1].length === 2 ? 2 : 3,
        text,
        id: headingId(text),
      });
      i++;
      continue;
    }

    // A table needs its divider row, otherwise a line of prose that happens to
    // contain pipes would be swallowed as a one-column table.
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', lines: quoted.filter((l) => l.trim()) });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s+/, '').trim());
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Paragraph: consecutive non-blank lines that start no other block.
    const para: string[] = [];
    while (
      i < lines.length
      && lines[i].trim()
      && !/^(#{2,3}\s|>\s?|[-*]\s|\d+[.)]\s|---+\s*$)/.test(lines[i])
      && !isTableRow(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length) blocks.push({ kind: 'para', text: para.join(' ') });
  }

  return blocks;
}

// ── Inline ─────────────────────────────────────────────────────────────────

/**
 * Inline pattern: code, link, bold, italic — matched in that order so a link's
 * text can itself be emphasised.
 *
 * A *factory*, not a shared instance. `inline()` below recurses into a link's
 * own text, and a single module-level `/g` regex carries `lastIndex` between
 * calls: the inner call would rewind it and the outer loop would restart from
 * the beginning of the string, forever. That is not a subtle slowdown — it
 * exhausted the heap and killed the prerenderer outright.
 */
const INLINE_SRC = '`([^`]+)`|\\[([^\\]]+)\\]\\(([^)\\s]+)\\)|\\*\\*([^*]+)\\*\\*|\\*([^*]+)\\*';
const inlineRe = (): RegExp => new RegExp(INLINE_SRC, 'g');

export interface RenderOpts {
  /**
   * Decide what an internal link becomes.
   *
   * Articles link forward to articles later in the schedule, which is correct —
   * the link graph is written once and the targets go live over the following
   * weeks. Returning `false` renders such a link as plain text instead, so a
   * reader is never sent to a page that does not exist yet. Omitted, every
   * internal link is a link.
   */
  resolveHref?: (href: string) => string | false;
}

/** Inline Markdown, stripped to its text. Used for ids, excerpts and llms.txt. */
export function stripInline(text: string): string {
  return text.replace(inlineRe(), (_m, code, linkText, _href, bold, italic) =>
    code ?? linkText ?? bold ?? italic ?? '');
}

/**
 * Render inline Markdown.
 *
 * Internal links become router links so an in-article link does not reload the
 * whole application; anything absolute is treated as external and gets the
 * usual `rel` hardening.
 */
function inline(text: string, keyBase: string, opts: RenderOpts = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;

  const re = inlineRe();
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${n++}`;
    const [, code, linkText, href, bold, italic] = m;

    if (code !== undefined) {
      out.push(<code key={key}>{code}</code>);
    } else if (linkText !== undefined) {
      const inner = inline(linkText, key, opts);
      if (!href.startsWith('/')) {
        out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>);
      } else {
        const resolved = opts.resolveHref ? opts.resolveHref(href) : href;
        out.push(
          resolved === false
            ? <span key={key} className="blog-link-pending">{inner}</span>
            : <Link key={key} to={resolved}>{inner}</Link>,
        );
      }
    } else if (bold !== undefined) {
      out.push(<strong key={key}>{inline(bold, key, opts)}</strong>);
    } else if (italic !== undefined) {
      out.push(<em key={key}>{inline(italic, key, opts)}</em>);
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── Render ─────────────────────────────────────────────────────────────────

export function renderBlocks(blocks: Block[], opts: RenderOpts = {}): ReactNode {
  const md = (text: string, key: string) => inline(text, key, opts);
  return blocks.map((b, i) => {
    const key = `b${i}`;
    switch (b.kind) {
      case 'heading':
        return b.level === 2
          ? <h2 key={key} id={b.id}>{md(b.text, key)}</h2>
          : <h3 key={key} id={b.id}>{md(b.text, key)}</h3>;
      case 'para':
        return <p key={key}>{md(b.text, key)}</p>;
      case 'ul':
        return (
          <ul key={key} className="blog-ul">
            {b.items.map((it, j) => <li key={j}>{md(it, `${key}-${j}`)}</li>)}
          </ul>
        );
      case 'ol':
        return (
          <ol key={key} className="blog-ol">
            {b.items.map((it, j) => <li key={j}>{md(it, `${key}-${j}`)}</li>)}
          </ol>
        );
      case 'table':
        return (
          // The wrapper is what lets a wide table scroll inside the article
          // instead of making the whole page scroll sideways on a phone.
          <div className="blog-table-wrap" key={key}>
            <table className="blog-table">
              <thead>
                <tr>{b.head.map((h, j) => <th key={j} scope="col">{md(h, `${key}-h${j}`)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((row, j) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      k === 0
                        ? <th key={k} scope="row">{md(cell, `${key}-${j}-${k}`)}</th>
                        : <td key={k}>{md(cell, `${key}-${j}-${k}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'quote':
        return (
          <blockquote key={key} className="blog-callout">
            {b.lines.map((l, j) => <p key={j}>{md(l, `${key}-${j}`)}</p>)}
          </blockquote>
        );
      case 'hr':
        return <hr key={key} className="blog-rule" />;
      default:
        return <Fragment key={key} />;
    }
  });
}

// ── Derived views of the same AST ──────────────────────────────────────────

export interface Heading { id: string; text: string; level: 2 | 3 }

/** H2s only: an article's table of contents is a list of its sections. */
export function tableOfContents(blocks: Block[]): Heading[] {
  return blocks
    .filter((b): b is Extract<Block, { kind: 'heading' }> => b.kind === 'heading' && b.level === 2)
    .map((b) => ({ id: b.id, text: stripInline(b.text), level: b.level }));
}

export interface Faq { question: string; answer: string }

/**
 * The FAQ section, lifted out for FAQPage structured data.
 *
 * The articles write their FAQ as an H2 whose text contains "questions",
 * followed by one H3 per question. Reading it back out of the prose means the
 * page and its schema cannot disagree — there is no second copy to update.
 */
export function extractFaqs(blocks: Block[]): Faq[] {
  const start = blocks.findIndex(
    (b) => b.kind === 'heading' && b.level === 2 && /questions?$/i.test(stripInline(b.text).trim()),
  );
  if (start === -1) return [];

  const faqs: Faq[] = [];
  let current: Faq | null = null;

  for (let i = start + 1; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === 'heading' && b.level === 2) break;
    if (b.kind === 'heading' && b.level === 3) {
      if (current) faqs.push(current);
      current = { question: stripInline(b.text), answer: '' };
    } else if (current && b.kind === 'para') {
      current.answer = current.answer ? `${current.answer} ${stripInline(b.text)}` : stripInline(b.text);
    }
  }
  if (current) faqs.push(current);
  return faqs.filter((f) => f.answer);
}

/** Plain text, for llms-full.txt and for counting words. */
export function blocksToText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': out.push(`${'#'.repeat(b.level)} ${stripInline(b.text)}`, ''); break;
      case 'para': out.push(stripInline(b.text), ''); break;
      case 'ul': out.push(...b.items.map((i) => `- ${stripInline(i)}`), ''); break;
      case 'ol': out.push(...b.items.map((i, n) => `${n + 1}. ${stripInline(i)}`), ''); break;
      case 'quote': out.push(...b.lines.map((l) => `> ${stripInline(l)}`), ''); break;
      case 'table':
        out.push(b.head.map(stripInline).join(' | '));
        out.push(...b.rows.map((r) => r.map(stripInline).join(' | ')), '');
        break;
      default: break;
    }
  }
  return out.join('\n');
}

export function wordCount(blocks: Block[]): number {
  return blocksToText(blocks).split(/\s+/).filter(Boolean).length;
}

/** Reading time in whole minutes, floored at one. */
export function readingMinutes(blocks: Block[]): number {
  return Math.max(1, Math.round(wordCount(blocks) / 225));
}

/** Every internal link an article points at — the input to link validation. */
export function internalLinks(src: string): string[] {
  const out: string[] = [];
  const re = /\[[^\]]+\]\((\/[^)\s]*)\)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m[1]);
  return out;
}
