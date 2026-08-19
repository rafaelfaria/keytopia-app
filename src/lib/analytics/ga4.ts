/**
 * Google Analytics 4.
 *
 * Nothing here loads gtag — that is GtagLoader's job. These are the typed
 * wrappers every call site uses, and they are all no-ops until the tag has
 * actually booted, so a caller never has to ask whether analytics is on.
 *
 * Two things are deliberate:
 *
 *  - Localhost never reports. Development would otherwise pollute the property
 *    with sessions nobody made, and a game under construction fires a lot of
 *    events.
 *  - Consent stays denied. KeyTopia's privacy page promises no analytics
 *    cookies and no cookie banner, so the tag runs in Consent Mode's cookieless
 *    form: aggregated pings, no client identifier, nothing stored on the
 *    device. `setAnalyticsConsent` exists for the day that changes, and until
 *    something calls it with `true` the promise on the privacy page holds.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** The property. Public by design — it identifies the stream, it is not a key. */
const DEFAULT_MEASUREMENT_ID = 'G-6YMD83TWD3';

export function getMeasurementId(): string {
  return import.meta.env.VITE_GA4_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID;
}

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Whether GA4 should run in this environment at all.
 *
 * Unlike {@link isGA4Ready} this does not require the script to have loaded, so
 * the loader can decide whether to inject it in the first place.
 *
 * VITE_GA4_ENABLED is a three-state override: `false` turns a deployed
 * environment off (a Vercel preview, say) without removing the tag, `true`
 * turns it on even on localhost so the wiring can be checked, and unset means
 * "on everywhere except localhost".
 */
export function isGA4Configured(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = import.meta.env.VITE_GA4_ENABLED;
  if (flag === 'false') return false;
  if (flag !== 'true' && isLocalhost(window.location.hostname)) return false;
  return !!getMeasurementId();
}

/** Configured, and gtag has finished loading. */
export function isGA4Ready(): boolean {
  return isGA4Configured() && typeof window.gtag === 'function';
}

/**
 * Report the page currently on screen.
 *
 * Sent by hand rather than by gtag's own page_view, because a client-side
 * router only ever loads one document: the automatic hit would describe the
 * landing URL forever, and on the prerendered pages it would fire before
 * src/lib/seo has applied the route's real title.
 */
export function pageview(): void {
  if (!isGA4Ready()) return;
  window.gtag?.('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: window.location.pathname + window.location.search,
  });
}

/** A custom event. Silently dropped when analytics is off. */
export function track(name: string, params?: Record<string, string | number | boolean>): void {
  if (!isGA4Ready()) return;
  window.gtag?.('event', name, {
    ...params,
    page_path: window.location.pathname,
  });
}

/** A click on something marked up with `data-ga-label`. */
export function trackClick(params: {
  label: string;
  component?: string;
  href?: string;
}): void {
  track('kt_click', {
    label: params.label,
    component: params.component || 'unknown',
    ...(params.href ? { link_url: params.href } : {}),
  });
}

/** How far down a page somebody read: 25, 50, 75 or 90. */
export function trackScrollDepth(percentScrolled: number): void {
  track('scroll_depth', { percent_scrolled: percentScrolled });
}

/**
 * Flip Consent Mode's analytics_storage.
 *
 * Unused today: see the note at the top of this file. A consent banner would
 * call this, and only then does GA4 set a cookie.
 */
export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
  });
}
