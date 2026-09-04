/**
 * /blog/:slug — one article.
 *
 * The prose is Markdown, parsed to an AST once and then used four ways: the
 * rendered body, the contents list beside it, the FAQ structured data in the
 * head, and the article's entry in llms-full.txt. There is no second copy of
 * anything, so nothing can drift.
 *
 * The contents list comes before the article in the markup and stays there in
 * every layout — a left column on a wide screen, a block above the prose on a
 * phone. That matches the pattern the guide pages already use, and it keeps the
 * visual order and the reading order the same, which a contents list placed
 * beside the article by `order` alone would not.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { SiteFooter } from '../../components/public/SiteFooter';
import { SiteHeader } from '../../components/public/SiteHeader';
import { PublicHero } from '../../components/public/PublicHero';
import { usePublicMotion } from '../../components/public/usePublicMotion';
import { Seo } from '../../lib/seo/Seo';
import { renderBlocks } from '../../lib/blog/markdown';
import { postPath } from '../../lib/blog/posts';
import {
  articleBySlug, neighbours, pillarFor, relatedPosts, resolveArticleHref,
} from '../../lib/blog/registry';
import { CategoryTag, formatDate, heroVariantFor } from './shared';

export default function BlogPost() {
  const { slug = '' } = useParams();
  const article = articleBySlug(slug);
  if (!article) return <Navigate to="/blog" replace />;
  return <Article key={slug} slug={slug} />;
}

/**
 * Split out so the hooks below sit after the redirect above.
 *
 * `key={slug}` on the caller is what resets the reading progress and the active
 * heading when a reader follows an in-article link to another article: without
 * it React reuses this component and the progress bar keeps the old scroll.
 */
function Article({ slug }: { slug: string }) {
  const article = articleBySlug(slug)!;
  const { post, blocks, toc, faqs, minutes, words, date } = article;
  const path = postPath(post);

  usePublicMotion(path);
  const progressRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(toc[0]?.id ?? '');

  /**
   * Reading progress, written straight to a custom property.
   *
   * Deliberately not React state: this fires on every scroll frame, and a
   * setState per frame would re-render the whole article. The bar is presentation
   * only, so `aria-hidden` on the element is the honest thing rather than
   * announcing a percentage nobody asked for.
   */
  useEffect(() => {
    const bar = progressRef.current;
    const body = bodyRef.current;
    if (!bar || !body) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const top = body.offsetTop;
      const span = Math.max(1, body.offsetHeight - window.innerHeight * 0.45);
      const p = Math.min(1, Math.max(0, (window.scrollY - top + window.innerHeight * 0.35) / span));
      bar.style.setProperty('--p', String(p));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [slug]);

  /** Which section the reader is in, for the contents list. */
  useEffect(() => {
    if (!toc.length) return;
    const headings = toc
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!headings.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      // A band across the upper third: a heading counts as "current" once it
      // has reached the reading line, not when it first peeks over the fold.
      { rootMargin: '-88px 0px -66% 0px', threshold: 0 },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [slug, toc]);

  const related = relatedPosts(post);
  const pillar = pillarFor(post);
  const { prev, next } = neighbours(post);

  return (
    <div className="pub-root blog-root blog-article-root" data-page={path}>
      <Seo path={path} extras={{ faqs, words, timeRequired: `PT${minutes}M` }} />
      <SiteHeader />
      <div className="blog-progress" ref={progressRef} aria-hidden><i /></div>

      <main className="pub-main" id="main">
        <PublicHero path={path} variant={heroVariantFor(post.category)}>
          <nav className="pub-crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li aria-current="page">{post.category}</li>
            </ol>
          </nav>
          <h1 className="pub-h1">{post.title}</h1>
          <p className="pub-lede">{post.lede}</p>
          <p className="blog-byline">
            <CategoryTag category={post.category} />
            <time dateTime={date}>{formatDate(date)}</time>
            <span aria-hidden>·</span>
            <span>{minutes} min read</span>
          </p>
        </PublicHero>

        <div className="pub-wrap">
          <div className="blog-layout" data-toc={toc.length > 2 ? '1' : '0'}>
            {toc.length > 2 && (
              <aside className="blog-aside" aria-label="On this page">
                <nav className="blog-toc">
                  <strong>On this page</strong>
                  <ol>
                    {toc.map((h) => (
                      <li key={h.id}>
                        <a href={`#${h.id}`} aria-current={active === h.id ? 'true' : undefined}>
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
            )}

            <article className="blog-body" ref={bodyRef}>
              {pillar && (
                <p className="blog-parent">
                  Part of our guide to{' '}
                  <Link to={postPath(pillar)}>{pillar.title.replace(/:.*$/, '')}</Link>.
                </p>
              )}
              {renderBlocks(blocks, { resolveHref: resolveArticleHref })}

              <section className="blog-try">
                <h2>Try it now</h2>
                <p>
                  Nothing here becomes a habit by being read. Take two minutes, measure where you
                  actually are, and let the result decide what you practise next.
                </p>
                <div className="pub-cta-row">
                  <Link className="btn btn-primary" to="/typing-test">Test your typing speed</Link>
                  <Link className="btn btn-soft" to="/adaptive-practice">Practise your weak keys</Link>
                </div>
              </section>
            </article>

          </div>

          {related.length > 0 && (
            <section className="pub-next" aria-labelledby="blog-related">
              <h2 id="blog-related">Keep reading</h2>
              <div className="pub-next-grid">
                {related.map((r) => (
                  <Link className="pub-next-card" to={postPath(r)} key={r.slug}>
                    <strong>{r.title}</strong>
                    <span>{r.lede}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <nav className="blog-seq" aria-label="More articles">
            {prev
              ? (
                <Link className="blog-seq-link" to={postPath(prev)} rel="prev">
                  <span>Previous</span>
                  <strong>{prev.title}</strong>
                </Link>
              )
              : <span />}
            {next && (
              <Link className="blog-seq-link blog-seq-next" to={postPath(next)} rel="next">
                <span>Next</span>
                <strong>{next.title}</strong>
              </Link>
            )}
          </nav>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
