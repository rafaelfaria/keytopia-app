import React from 'react';
import { useLocation } from 'react-router-dom';
import { pageview, trackClick, trackScrollDepth } from '../../lib/analytics/ga4';

/**
 * What GA4 hears while somebody uses KeyTopia: one page_view per navigation,
 * scroll depth on the long public pages, and clicks on anything marked up with
 * `data-ga-label`.
 *
 * Mounted only once the tag is loaded, and rendered as a sibling AFTER the
 * routes: sibling effects run in mount order, so the page's own <Seo> has
 * already set document.title by the time the first page_view goes out.
 */
export function GA4Client() {
  const { pathname, search } = useLocation();

  // The search string is part of the identity of a page here: a race room code
  // and a shared challenge are different pages at the same path. The hash is
  // not — an in-page anchor is the same page, further down.
  React.useEffect(() => {
    pageview();
  }, [pathname, search]);

  // Scroll depth, reset per route. Only really meaningful on the guides and
  // the landing page; the app screens rarely scroll, which reads as a 0% page
  // rather than as noise.
  React.useEffect(() => {
    const seen = new Set<number>();
    let ticking = false;

    const measure = () => {
      ticking = false;
      const height = document.documentElement.scrollHeight;
      if (height <= window.innerHeight) return;
      const percent = Math.round(((window.scrollY + window.innerHeight) / height) * 100);
      for (const mark of [25, 50, 75, 90]) {
        if (percent >= mark && !seen.has(mark)) {
          seen.add(mark);
          trackScrollDepth(mark);
        }
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  // One delegated listener for the whole app, so marking a button up for
  // analytics is an attribute rather than a wrapper and a handler.
  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = (event.target as HTMLElement | null)?.closest?.('[data-ga-label]') as HTMLElement | null;
      if (!el) return;
      const anchor = el.tagName === 'A' ? (el as HTMLAnchorElement) : el.querySelector('a');
      trackClick({
        label: el.getAttribute('data-ga-label')!,
        component: el.getAttribute('data-ga-component') || undefined,
        href: anchor?.href,
      });
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
