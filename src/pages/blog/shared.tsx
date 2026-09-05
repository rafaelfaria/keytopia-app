/**
 * The pieces both blog routes need.
 *
 * SSR-safe: the prerenderer renders these in Node, so nothing here may touch a
 * browser global at module scope.
 */

import { Link } from 'react-router-dom';
import type { HeroVariant } from '../../components/public/PublicHero';
import {
  CATEGORY_HUES, postPath, type BlogCategory, type BlogPost,
} from '../../lib/blog/posts';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "4 September 2026".
 *
 * Written out rather than handed to `Intl.DateTimeFormat`, which resolves
 * against the host's locale: the prerenderer runs in Node on a build machine
 * and the reader's browser does not, so the same article would carry two
 * different dates in the static HTML and after the app takes over.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * The hero formation for a category.
 *
 * Chosen for what the cluster is about rather than for variety: the reading
 * line for technique, a moving stream for the speed and benchmark articles, a
 * scattered field for the children's writing, terraces for the school pages.
 */
const FORMATIONS: Record<BlogCategory, HeroVariant['formation']> = {
  'Touch typing': 'reading',
  'Speed & tests': 'stream',
  'Kids & parents': 'scatter',
  'Students & schools': 'terrace',
  'Adults & work': 'wave',
  Science: 'wave',
  'Keyboards & ergonomics': 'calm',
};

export function heroVariantFor(category: BlogCategory): HeroVariant {
  return { formation: FORMATIONS[category], ...CATEGORY_HUES[category] };
}

/** The blog index's own hero: the reading line, in the brand's two colours. */
export const INDEX_VARIANT: HeroVariant = {
  formation: 'reading',
  hue: '#14d8c4',
  hue2: '#8b7cff',
};

export function CategoryTag({ category }: { category: BlogCategory }) {
  return <span className="blog-tag" data-cat={category}>{category}</span>;
}

/** The card used on the index and in the "keep reading" rails. */
export function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const date = post.publishedAt;
  return (
    <article className={featured ? 'blog-card blog-card-lead' : 'blog-card'}>
      <div className="blog-card-top">
        <CategoryTag category={post.category} />
        {post.pillar && <span className="blog-pill">Pillar guide</span>}
      </div>
      <h3 className="blog-card-title">
        {/* The whole card is not a link: a card-sized hit area swallows the
            category filter chips behind it and reads as one enormous link to a
            screen reader. The title is the link, and the card lifts with it. */}
        <Link to={postPath(post)}>{post.title}</Link>
      </h3>
      <p className="blog-card-lede">{post.lede}</p>
      <p className="blog-card-meta">
        <time dateTime={date}>{formatDate(date)}</time>
        <span aria-hidden>·</span>
        <span>{post.readingMinutes} min read</span>
      </p>
    </article>
  );
}
