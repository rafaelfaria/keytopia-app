/**
 * The brand, in one place.
 *
 * Every name, domain, URL and address the product shows or sends resolves
 * through here, and every value here comes from `brand.config.json` at the
 * repository root. Renaming the product is: edit that JSON, run
 * `npm run rename`, work through docs/renaming.md.
 *
 * Imported by the browser bundle, the SSR prerender and the Node build
 * scripts, so it must stay free of browser globals.
 *
 * What must NOT change on a rename lives under `frozen` in the JSON: storage
 * keys and database identifiers that already exist on other people's machines.
 * See STORAGE_PREFIX below.
 */

import config from '../../brand.config.json';

export interface Brand {
  /** Display name, in the product's own casing. Used in copy and titles. */
  name: string;
  /** Short form for cramped surfaces (PWA launcher, tab strip). */
  shortName: string;
  /** Lower-case, as it appears mid-sentence after the name. */
  tagline: string;
  /** Lower-case, no spaces. Package name, project ids, file names. */
  slug: string;
  /** Bare apex domain, no scheme. */
  domain: string;
  /** Canonical origin, no trailing slash. */
  url: string;
  themeColor: string;
  email: {
    /** Privacy and terms contact. */
    legal: string;
    /** From-address for transactional mail. */
    sender: string;
    senderName: string;
  };
  supabase: { projectId: string };
}

export const BRAND: Brand = config as Brand;

/** `KeyTopia: every keyboard is a world` — the full one-line identity. */
export const BRAND_TITLE = `${BRAND.name}: ${BRAND.tagline}`;

/**
 * FROZEN. The prefix on every localStorage key the app has ever written.
 *
 * This is deliberately not derived from BRAND.slug: it is a data format, not a
 * name. A returning typist's profiles, settings and history live under it, and
 * a rename that changed it would silently look like a wiped device. It only
 * ever moves behind an explicit carry-forward migration — src/lib/store.ts has
 * the pattern, written when the product was called Typerra.
 */
export const STORAGE_PREFIX = config.frozen.storagePrefix;
