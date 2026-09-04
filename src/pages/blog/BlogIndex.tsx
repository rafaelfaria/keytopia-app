/**
 * /blog — the article index.
 *
 * Prerendered like every other public page, which sets one hard constraint: the
 * category filter is a *display* filter, never a fetch. Every live article is
 * in the markup on first paint, and choosing a category hides the rest. A
 * crawler with no JavaScript, and a reader whose JavaScript has not arrived
 * yet, both see the complete index.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../../components/public/SiteFooter';
import { SiteHeader } from '../../components/public/SiteHeader';
import { PublicHero } from '../../components/public/PublicHero';
import { usePublicMotion } from '../../components/public/usePublicMotion';
import { Seo } from '../../lib/seo/Seo';
import { LIVE_POSTS, SITE_NAME } from '../../lib/seo/site';
import { BLOG_CATEGORIES, postPath, type BlogCategory } from '../../lib/blog/posts';
import { INDEX_VARIANT, PostCard } from './shared';

type Filter = BlogCategory | 'All';

export default function BlogIndex() {
  usePublicMotion('/blog');
  const [filter, setFilter] = useState<Filter>('All');

  const posts = LIVE_POSTS;
  const [lead, ...rest] = posts;

  /** Only the categories that actually have a live article behind them. */
  const categories = useMemo(() => {
    const live = new Set(posts.map((p) => p.category));
    return BLOG_CATEGORIES.filter((c) => live.has(c));
  }, [posts]);

  const counts = useMemo(() => {
    const map = new Map<BlogCategory, number>();
    for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, [posts]);

  // Publication order, not newest-first: "Start here" is a reading order, and
  // the pillars were scheduled in the order they make sense to read.
  const pillars = posts.filter((p) => p.pillar).slice().sort((a, b) => a.day - b.day);

  return (
    <div className="pub-root blog-root" data-page="/blog">
      <Seo path="/blog" />
      <SiteHeader />

      <main className="pub-main" id="main">
        <PublicHero path="/blog" variant={INDEX_VARIANT}>
          <nav className="pub-crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link to="/">Home</Link></li>
              <li aria-current="page">Blog</li>
            </ol>
          </nav>
          <h1 className="pub-h1">Writing about learning to type</h1>
          <p className="pub-lede">
            Guides, honest benchmarks and the research behind typing practice. One new article a day,
            written to be useful whether or not you ever open {SITE_NAME}.
          </p>
        </PublicHero>

        <div className="pub-wrap">
          {posts.length === 0 ? (
            <p className="pub-intro">The first article publishes shortly. Check back soon.</p>
          ) : (
            <>
              {/* The pillar rail. Six or seven articles carry the clusters, and a
                  reader who lands on the index cold should meet those first
                  rather than whatever happened to publish this morning. */}
              {pillars.length > 0 && (
                <section className="blog-pillars" aria-labelledby="blog-pillars-h">
                  <h2 id="blog-pillars-h" className="blog-eyebrow">Start here</h2>
                  <div className="blog-pillar-grid">
                    {pillars.map((p) => (
                      <Link className="blog-pillar" to={postPath(p)} key={p.slug}>
                        <span className="blog-pillar-cat">{p.category}</span>
                        <strong>{p.title}</strong>
                        <span className="blog-pillar-note">{p.lede}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section className="blog-latest" aria-labelledby="blog-latest-h">
                <h2 id="blog-latest-h" className="blog-eyebrow">Latest</h2>
                <PostCard post={lead} featured />
              </section>

              <section className="blog-all" aria-labelledby="blog-all-h">
                <div className="blog-all-head">
                  <h2 id="blog-all-h" className="blog-eyebrow">
                    All articles <span className="blog-count">{posts.length}</span>
                  </h2>
                  <div className="blog-filters" role="group" aria-label="Filter articles by topic">
                    {(['All', ...categories] as Filter[]).map((c) => (
                      <button
                        type="button"
                        key={c}
                        className="blog-chip"
                        aria-pressed={filter === c}
                        onClick={() => setFilter(c)}
                      >
                        {c}
                        {c !== 'All' && <span className="blog-chip-n">{counts.get(c as BlogCategory)}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="blog-grid">
                  {rest.map((p) => (
                    // `hidden` rather than unmounting: the filter must not
                    // remove articles from the document, or a crawler that runs
                    // the JavaScript would index a partial index page.
                    <div key={p.slug} hidden={filter !== 'All' && p.category !== filter}>
                      <PostCard post={p} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="pub-cta-band">
                <h2>Reading is not practice</h2>
                <p>
                  Every article here ends with something to try. The fastest way to use any of it is to
                  measure where you are, then practise the keys that come back slowest.
                </p>
                <div className="pub-cta-row">
                  <Link className="btn btn-primary btn-big" to="/typing-test">Take the typing test</Link>
                  <Link className="btn btn-soft btn-big" to="/learn-to-type">Read the method</Link>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
