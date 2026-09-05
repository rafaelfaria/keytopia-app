/**
 * Route-level head management for the SPA.
 *
 * Prerendered documents already ship with the correct head (see
 * scripts/prerender.mjs). This keeps it correct after a client-side
 * navigation, and gives JS-rendering crawlers the same tags they would have
 * got from the static file.
 */

import { useEffect } from 'react';
import { applyHead, buildHead, buildNoIndexHead } from './head';
import type { HeadExtras } from './jsonLd';
import { pageByPath, SITE_NAME } from './site';

/**
 * Drop into any public page: `<Seo path="/faq" />`.
 *
 * `extras` carries the facts a page can only know about itself — an article's
 * FAQ list and word count, which come from parsing its Markdown. It is
 * serialised into the dependency list rather than compared by reference,
 * because callers build the object inline on every render.
 */
export function Seo({ path, extras }: { path: string; extras?: HeadExtras }) {
  const fingerprint = extras ? JSON.stringify(extras) : '';
  useEffect(() => {
    const page = pageByPath(path);
    if (page) applyHead(buildHead(page, fingerprint ? JSON.parse(fingerprint) : undefined));
  }, [path, fingerprint]);
  return null;
}

/**
 * The app itself is private, per-device state — never indexable. robots.txt
 * disallows it, and this makes the directive explicit for any crawler that
 * reaches an app URL anyway (a shared link, for instance).
 */
export function useNoIndex(title?: string): void {
  useEffect(() => {
    applyHead(buildNoIndexHead(title ? `${title} · ${SITE_NAME}` : SITE_NAME));
  }, [title]);
}
