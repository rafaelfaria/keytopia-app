/**
 * The publication schedule, as an invariant rather than a hope.
 *
 * The blog drip has one rule: on any given day, the set of articles the site
 * advertises and the set it will actually serve are the same set. That rule was
 * broken in production. sitemap.xml and llms.txt were generated per request
 * from the real date, while the app and the prerenderer read a constant frozen
 * at build time, so from the day after a deploy the sitemap listed an article
 * that every other part of the site denied existed.
 *
 * The fix has three moving parts that have to agree: every article is
 * prerendered on every build, `isPublishedOn` is the only definition of "is it
 * out yet", and middleware.ts applies it at the edge. These tests are what stop
 * the three drifting apart again, so they exercise the schedule across real
 * dates rather than checking today.
 */

import { describe, expect, it } from 'vitest';
import { BLOG_POSTS, isPublishedOn, postPath, publishedPosts } from './posts';

/** A date before the first article, one mid-run, and one after the last. */
const FIRST = BLOG_POSTS.reduce((a, p) => (p.publishedAt < a ? p.publishedAt : a), '9999-99-99');
const LAST = BLOG_POSTS.reduce((a, p) => (p.publishedAt > a ? p.publishedAt : a), '0000-00-00');

describe('the drip', () => {
  it('publishes nothing before the first article is due', () => {
    expect(publishedPosts('2026-09-03')).toHaveLength(0);
  });

  it('publishes exactly the first article on its own date', () => {
    const live = publishedPosts(FIRST);
    expect(live).toHaveLength(1);
    expect(live[0].publishedAt).toBe(FIRST);
  });

  it('publishes every article once the last date has passed', () => {
    expect(publishedPosts(LAST)).toHaveLength(BLOG_POSTS.length);
  });

  it('never publishes an article before its date, on any date in the run', () => {
    // Walking every publication date catches an off-by-one at a boundary, which
    // a spot check on one date would not.
    for (const day of BLOG_POSTS.map((p) => p.publishedAt)) {
      for (const post of publishedPosts(day)) {
        expect(post.publishedAt <= day).toBe(true);
      }
    }
  });

  it('grows monotonically: an article never becomes unpublished', () => {
    const days = [...new Set(BLOG_POSTS.map((p) => p.publishedAt))].sort();
    let previous = 0;
    for (const day of days) {
      const count = publishedPosts(day).length;
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it('is overridden wholesale by showAll, for dev and preview builds', () => {
    expect(publishedPosts('2020-01-01', true)).toHaveLength(BLOG_POSTS.length);
    expect(isPublishedOn(BLOG_POSTS[BLOG_POSTS.length - 1], '2020-01-01', true)).toBe(true);
  });
});

describe('what is advertised and what is served', () => {
  /**
   * The exact fault this suite exists for. `publishedPosts` is what fills the
   * sitemap and llms.txt; `isPublishedOn` is what the app and the edge gate use.
   * If these two ever disagree the site advertises a URL it will not serve.
   */
  it('agree on every date in the run', () => {
    for (const day of BLOG_POSTS.map((p) => p.publishedAt)) {
      const advertised = new Set(publishedPosts(day).map((p) => p.slug));
      for (const post of BLOG_POSTS) {
        expect(isPublishedOn(post, day)).toBe(advertised.has(post.slug));
      }
    }
  });

  /**
   * Every article gets a static file on every build, so a scheduled one is
   * reachable by guessing unless something refuses it. That something is
   * middleware.ts, and this is the predicate it calls.
   */
  it('leaves a scheduled article unserved even though its file exists', () => {
    const scheduled = BLOG_POSTS.filter((p) => p.publishedAt > FIRST);
    expect(scheduled.length).toBeGreaterThan(0);
    for (const post of scheduled) {
      expect(isPublishedOn(post, FIRST)).toBe(false);
    }
  });
});

describe('the schedule itself', () => {
  it('gives every article a distinct slug and a distinct date', () => {
    expect(new Set(BLOG_POSTS.map((p) => p.slug)).size).toBe(BLOG_POSTS.length);
    expect(new Set(BLOG_POSTS.map((p) => p.publishedAt)).size).toBe(BLOG_POSTS.length);
  });

  it('writes every date as an ISO day, since the comparison is a string one', () => {
    for (const post of BLOG_POSTS) {
      expect(post.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('derives every path from the slug', () => {
    for (const post of BLOG_POSTS) {
      expect(postPath(post)).toBe(`/blog/${post.slug}`);
    }
  });
});
