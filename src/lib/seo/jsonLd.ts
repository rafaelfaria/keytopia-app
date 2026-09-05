/**
 * Shared JSON-LD (schema.org) builders for public pages.
 *
 * Centralises structured-data construction so every page emits consistent,
 * valid nodes with stable `@id`s that reference each other — the Organization
 * and WebSite nodes are declared once on the home page and referenced by `@id`
 * everywhere else, which is what lets a crawler treat the whole site as one
 * entity rather than a pile of unrelated pages.
 *
 * All URLs resolve through `absUrl` against `VITE_SITE_URL`, the same origin
 * used by the sitemap, robots.txt and llms.txt generators.
 */

import {
  SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_LOGO, SITE_OG_IMAGE, absUrl, ogImage,
  LIVE_POSTS, postForPath, type PublicPage, pageTitle,
} from './site';
import { TOOLS, TOOLS_BASE, toolByPath } from '../tools/registry';
import { TOOL_CONTENT, TOOLS_HUB_FAQS } from './toolsContent';
import { postPath } from '../blog/posts';
import {
  CORE_FEATURES, FAQS, GAMES, GLOSSARY, PRODUCT_PRICE, PRODUCT_SUMMARY,
  CURRICULUM, LEARN_GUIDE, METHOD_STEPS,
  type Faq, type GlossaryTerm,
} from './content';

export type JsonLd = Record<string, unknown>;

/**
 * Facts about a page that only its own component can supply.
 *
 * Everything else on a page's `<head>` is derivable from the registry. An
 * article's word count, reading time and FAQ list come from parsing its
 * Markdown, so the article route hands them down instead.
 */
export interface HeadExtras {
  faqs?: Faq[];
  words?: number;
  /** ISO 8601 duration, e.g. `PT7M`. */
  timeRequired?: string;
}

/** Stable node identities, so nodes can cross-reference instead of duplicating. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;
export const APP_ID = `${SITE_URL}/#webapp`;

export function organizationNode(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    logo: {
      '@type': 'ImageObject',
      url: absUrl(SITE_LOGO),
      width: 512,
      height: 512,
    },
  };
}

export function websiteNode(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * The product itself. `WebApplication` (a subtype of SoftwareApplication) is
 * the honest type: KeyTopia is a browser app, not a downloadable one.
 */
export function webApplicationNode(): JsonLd {
  return {
    '@type': 'WebApplication',
    '@id': APP_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: PRODUCT_SUMMARY,
    applicationCategory: 'EducationalApplication',
    applicationSubCategory: 'Typing Tutor',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript. Works in any modern browser.',
    inLanguage: 'en',
    isAccessibleForFree: true,
    publisher: { '@id': ORG_ID },
    image: absUrl(SITE_OG_IMAGE),
    offers: {
      '@type': 'Offer',
      price: PRODUCT_PRICE.price,
      priceCurrency: PRODUCT_PRICE.currency,
      availability: 'https://schema.org/InStock',
    },
    featureList: CORE_FEATURES.map((f) => f.name),
    // Accessibility metadata (schema.org a11y vocabulary) — genuinely supported.
    accessibilityFeature: [
      'highContrastDisplay',
      'largePrint',
      'readingOrder',
      'alternativeText',
      'displayTransformability',
      'audioDescription',
      'structuralNavigation',
    ],
    accessibilityHazard: ['noFlashingHazard', 'noSoundHazard', 'noMotionSimulationHazard'],
    accessibilityControl: ['fullKeyboardControl', 'fullMouseControl', 'fullTouchControl'],
    accessMode: ['textual', 'visual'],
  };
}

/** BreadcrumbList from ordered {name, path} items. */
export function breadcrumbNode(items: { name: string; path: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}

/** The WebPage node every public page carries, wired to the site and org. */
export function webPageNode(page: PublicPage, extra: JsonLd = {}): JsonLd {
  // An article was published on its scheduled day, not on the day the site
  // launched, and a WebPage claiming otherwise contradicts its own BlogPosting.
  const post = page.group === 'Blog' ? postForPath(page.path) : undefined;
  return {
    '@type': post ? 'ItemPage' : 'WebPage',
    '@id': `${absUrl(page.path)}#webpage`,
    url: absUrl(page.path),
    name: pageTitle(page),
    description: page.description,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': APP_ID },
    inLanguage: 'en',
    primaryImageOfPage: { '@type': 'ImageObject', url: absUrl(ogImage(page)) },
    datePublished: post ? post.publishedAt : '2026-08-01',
    dateModified: page.lastModified,
    ...extra,
  };
}

export function faqNode(faqs: Faq[] = FAQS): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function glossaryNode(terms: GlossaryTerm[] = GLOSSARY): JsonLd {
  return {
    '@type': 'DefinedTermSet',
    '@id': `${absUrl('/typing-glossary')}#termset`,
    name: 'KeyTopia Typing Glossary',
    description: 'Definitions of typing and touch-typing terminology.',
    inLanguage: 'en',
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${absUrl('/typing-glossary')}#${t.slug}`,
      name: t.term,
      description: t.definition,
      inDefinedTermSet: { '@id': `${absUrl('/typing-glossary')}#termset` },
    })),
  };
}

/** The learn-to-type pillar page as an instructional article. */
export function guideArticleNode(page: PublicPage): JsonLd {
  return {
    '@type': 'Article',
    headline: page.title,
    description: page.description,
    articleSection: LEARN_GUIDE.map((s) => s.heading),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    datePublished: '2026-08-01',
    dateModified: page.lastModified,
    mainEntityOfPage: { '@id': `${absUrl(page.path)}#webpage` },
    image: absUrl(ogImage(page)),
    inLanguage: 'en',
  };
}

/**
 * The three-step method on the home page, as an Article.
 *
 * This was a HowTo. Google retired HowTo rich results in September 2023, so the
 * markup earned nothing and only added weight. On /learn-to-type the Article
 * from `guideArticleNode` already described the same three steps, so that page
 * simply lost the HowTo. The home page had no Article of its own, and deleting
 * the HowTo there would have left "Assess, Adapt, Advance" with no structured
 * description at all — hence this node, which keeps the steps machine-readable
 * for answer engines through a type that is still supported.
 */
export function methodArticleNode(page: PublicPage): JsonLd {
  return {
    '@type': 'Article',
    '@id': `${absUrl(page.path)}#article`,
    headline: 'KeyTopia learns you first',
    description: 'Assess your current typing, adapt practice to your own weak keys, then advance accuracy first and speed second.',
    articleSection: METHOD_STEPS.map((s) => s.name),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    datePublished: '2026-08-01',
    dateModified: page.lastModified,
    mainEntityOfPage: { '@id': `${absUrl(page.path)}#webpage` },
    image: absUrl(ogImage(page)),
    inLanguage: 'en',
  };
}

/** The curriculum as a Course with one CourseInstance-free syllabus section per world. */
export function courseNode(): JsonLd {
  return {
    '@type': 'Course',
    '@id': `${absUrl('/curriculum')}#course`,
    name: 'The KeyTopia Typing Curriculum',
    description: 'A 41-lesson touch-typing curriculum spanning nine regions and five worlds, from home-row anchors to symbols, code, rhythm and endurance.',
    provider: { '@id': ORG_ID },
    inLanguage: 'en',
    educationalLevel: 'Beginner to advanced',
    teaches: 'Touch typing',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: PRODUCT_PRICE.price,
      priceCurrency: PRODUCT_PRICE.currency,
      category: 'Free',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT15M',
    },
    syllabusSections: CURRICULUM.map((w, i) => ({
      '@type': 'Syllabus',
      position: i + 1,
      name: w.name,
      description: `${w.tagline}. Target: ${w.targetWpm} at ${w.targetAccuracy}.`,
    })),
  };
}

/** The seven games as an ItemList of VideoGame nodes. */
export function gamesListNode(): JsonLd {
  return {
    '@type': 'ItemList',
    name: 'KeyTopia typing games',
    numberOfItems: GAMES.length,
    itemListElement: GAMES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'VideoGame',
        name: g.name,
        description: g.description,
        genre: ['Educational', 'Typing'],
        gamePlatform: 'Web browser',
        // Every game is single-player: the rivals in Quill Duel and Survivor
        // Sprint are CPU-controlled, so claiming multiplayer would be false.
        playMode: 'SinglePlayer',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any (web browser)',
        isAccessibleForFree: true,
        publisher: { '@id': ORG_ID },
        url: absUrl('/typing-games'),
      },
    })),
  };
}

/** The free typing test, described as its own tool. */
export function typingTestNode(page: PublicPage): JsonLd {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${absUrl(page.path)}#tool`,
    name: 'Free Typing Test',
    description: page.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (web browser)',
    url: absUrl(page.path),
    isAccessibleForFree: true,
    publisher: { '@id': ORG_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

// ── The free tools ─────────────────────────────────────────────────────────

export const TOOLS_ID = `${SITE_URL}/tools#suite`;

/**
 * The suite as an ItemList, on the hub only.
 *
 * `ItemList` rather than a pile of loose `SoftwareApplication` nodes: the hub
 * is a directory of eight things, and describing it as one list with eight
 * members is what it actually is. Each member is a real `SoftwareApplication`
 * with its own canonical URL, so a crawler that only reads the hub still learns
 * every tool exists and where it lives.
 */
export function toolsSuiteNode(): JsonLd {
  return {
    '@type': 'ItemList',
    '@id': TOOLS_ID,
    name: `${SITE_NAME} free typing tools`,
    description: 'Eight free in-browser typing tools sharing one typing engine and one definition of words per minute.',
    numberOfItems: TOOLS.length,
    itemListOrder: 'https://schema.org/ItemListUnordered',
    itemListElement: TOOLS.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absUrl(t.path),
      item: {
        '@type': 'SoftwareApplication',
        '@id': `${absUrl(t.path)}#tool`,
        name: t.name,
        description: t.blurb,
        url: absUrl(t.path),
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any (web browser)',
        isAccessibleForFree: true,
        publisher: { '@id': ORG_ID },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    })),
  };
}

/**
 * One tool, on its own page.
 *
 * `SoftwareApplication` is the honest type for something that runs and produces
 * a result. It deliberately carries no `aggregateRating`: nobody has rated
 * these, and inventing a rating to win a star in a search result is exactly the
 * kind of structured data that is both a lie and a manual action waiting to
 * happen.
 */
export function toolNode(page: PublicPage): JsonLd {
  const tool = toolByPath(page.path);
  if (!tool) return {};
  return {
    '@type': 'SoftwareApplication',
    '@id': `${absUrl(page.path)}#tool`,
    name: page.label,
    description: page.description,
    url: absUrl(page.path),
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Typing tool',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript. Works in any modern browser.',
    inLanguage: 'en',
    isAccessibleForFree: true,
    isPartOf: { '@id': TOOLS_ID },
    publisher: { '@id': ORG_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    // Only the claims that are true of every tool here. A tool needing a
    // physical keyboard is still fully keyboard-controllable, which is the
    // property this vocabulary is describing.
    accessibilityControl: ['fullKeyboardControl', 'fullMouseControl'],
    accessMode: ['textual', 'visual'],
  };
}

// ── The blog ───────────────────────────────────────────────────────────────

export const BLOG_ID = `${SITE_URL}/blog#blog`;

/** The blog itself, so its articles have a parent publication to belong to. */
export function blogNode(page: PublicPage): JsonLd {
  return {
    '@type': 'Blog',
    '@id': BLOG_ID,
    name: `${SITE_NAME} Typing Blog`,
    url: absUrl('/blog'),
    description: page.description,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    blogPost: LIVE_POSTS.slice(0, 20).map((p) => ({
      '@type': 'BlogPosting',
      '@id': `${absUrl(postPath(p))}#article`,
      headline: p.title,
      url: absUrl(postPath(p)),
      datePublished: p.publishedAt,
    })),
  };
}

/**
 * One article.
 *
 * `wordCount` and the FAQ list are passed in rather than read here, because
 * both come from parsing the article's Markdown and this module is on the
 * critical path for every page on the site — importing seventy thousand words
 * of prose to render a `<head>` would be a poor trade.
 */
export function blogPostingNode(page: PublicPage, extra: HeadExtras = {}): JsonLd {
  const post = postForPath(page.path);
  if (!post) return {};
  const published = post.publishedAt;
  return {
    '@type': 'BlogPosting',
    '@id': `${absUrl(page.path)}#article`,
    headline: post.title,
    alternativeHeadline: post.seoTitle,
    description: post.description,
    url: absUrl(page.path),
    datePublished: published,
    dateModified: published,
    // The publication is the author. Attributing fifty articles to an invented
    // person would be a fabricated credential, which is exactly the kind of
    // thing E-E-A-T is meant to catch.
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@id': `${absUrl(page.path)}#webpage` },
    isPartOf: { '@id': BLOG_ID },
    image: absUrl(ogImage(page)),
    inLanguage: 'en',
    articleSection: post.category,
    keywords: [post.primaryKeyword, ...post.secondaryKeywords].join(', '),
    about: { '@id': APP_ID },
    ...(extra.words ? { wordCount: extra.words } : {}),
    ...(extra.timeRequired ? { timeRequired: extra.timeRequired } : {}),
  };
}

/** Wrap nodes into a single `@graph` document — one script tag per page. */
export function graph(nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/**
 * The complete JSON-LD graph for a given route. Every page carries the
 * Organization, WebSite, WebApplication and its own WebPage + breadcrumbs;
 * page-specific nodes are added on top.
 */
export function jsonLdForPath(page: PublicPage, opts: HeadExtras = {}): JsonLd {
  const base: JsonLd[] = [organizationNode(), websiteNode(), webApplicationNode()];

  // An article sits two levels down, so its trail runs through the blog rather
  // than jumping straight back to the home page.
  const trail = page.group === 'Blog'
    ? [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: page.label, path: page.path }]
    // A tool sits under the hub, so its trail runs through /tools rather than
    // jumping straight back to the home page. Same reasoning as an article.
    : page.path.startsWith('/tools/')
      ? [{ name: 'Home', path: '/' }, { name: 'Free tools', path: TOOLS_BASE }, { name: page.label, path: page.path }]
      : [{ name: 'Home', path: '/' }, { name: page.label, path: page.path }];
  const crumbs = page.path === '/' ? [] : [breadcrumbNode(trail)];

  const extra: JsonLd[] = [];

  if (page.group === 'Blog') {
    extra.push(blogPostingNode(page, opts));
    if (opts.faqs?.length) extra.push(faqNode(opts.faqs));
    return graph([...base, webPageNode(page), ...crumbs, ...extra]);
  }
  if (page.path === '/blog') {
    extra.push(blogNode(page));
    return graph([...base, webPageNode(page), ...crumbs, ...extra]);
  }

  // The tools are matched as a group rather than as nine switch arms: they all
  // carry the same node shapes, and the hub additionally lists the suite.
  if (page.path === TOOLS_BASE) {
    return graph([
      ...base, webPageNode(page), ...crumbs,
      toolsSuiteNode(), faqNode(TOOLS_HUB_FAQS),
    ]);
  }
  if (toolByPath(page.path)) {
    const faqs = TOOL_CONTENT[page.path]?.faqs ?? [];
    return graph([
      ...base, webPageNode(page), ...crumbs,
      toolNode(page),
      ...(faqs.length ? [faqNode(faqs)] : []),
    ]);
  }

  switch (page.path) {
    case '/':
      extra.push(faqNode(FAQS.slice(0, 6)), methodArticleNode(page));
      break;
    case '/typing-test':
      extra.push(typingTestNode(page));
      break;
    case '/learn-to-type':
      extra.push(guideArticleNode(page));
      break;
    case '/curriculum':
      extra.push(courseNode());
      break;
    case '/typing-games':
      extra.push(gamesListNode());
      break;
    case '/faq':
      extra.push(faqNode());
      break;
    case '/typing-glossary':
      extra.push(glossaryNode());
      break;
    default:
      break;
  }

  return graph([...base, webPageNode(page), ...crumbs, ...extra]);
}

/** Safe embedding inside a <script> tag (prevents `</script>` breakout). */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
