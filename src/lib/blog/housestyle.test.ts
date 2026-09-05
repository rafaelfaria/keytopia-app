/**
 * House style, as an invariant rather than a hope.
 *
 * The rule is that user-facing copy joins its clauses with full stops and
 * commas and never with an em dash. It held in the marketing copy, which had
 * exactly one, and failed silently in the blog, which accumulated 624 across
 * all fifty articles. Nothing caught it because nothing was looking: the drip
 * publishes one article every other day, so the breach would have reached the
 * live site in instalments over about fourteen weeks.
 *
 * That is the argument for a test rather than a one-off sweep. The corpus grows
 * by hand, and a rule about prose is exactly the kind that erodes when the only
 * thing enforcing it is whoever happens to be writing.
 */

import { describe, expect, it } from 'vitest';
import { BLOG_POSTS } from './posts';
import { BODIES } from './bodies';

/** Marks that stand in for the em dash and are equally out of house style. */
const BANNED: Array<{ char: string; name: string }> = [
  { char: '—', name: 'em dash' },
  { char: '―', name: 'horizontal bar' },
];

/**
 * The en dash is deliberately allowed: it is doing numeric-range work
 * ("15–120 seconds", "6–12 months") throughout the corpus, which is what it is
 * for. Only the sentence-joining marks are banned.
 */
describe('house style', () => {
  it('has an article body for every post', () => {
    for (const post of BLOG_POSTS) {
      expect(BODIES[post.slug], `no body for ${post.slug}`).toBeTruthy();
    }
  });

  for (const { char, name } of BANNED) {
    it(`uses no ${name} in any article body`, () => {
      const offenders = Object.entries(BODIES)
        .filter(([, body]) => JSON.stringify(body).includes(char))
        .map(([slug]) => slug);
      expect(offenders, `${name} found in: ${offenders.join(', ')}`).toEqual([]);
    });

    it(`uses no ${name} in any article's visible metadata`, () => {
      const offenders = BLOG_POSTS
        .filter((p) => [p.title, p.seoTitle, p.description, p.lede].join(' ').includes(char))
        .map((p) => p.slug);
      expect(offenders, `${name} found in: ${offenders.join(', ')}`).toEqual([]);
    });
  }
});
