import React from 'react';
import { getMeasurementId, isGA4Configured } from '../../lib/analytics/ga4';
import { CONSENT_REGIONS, readStoredConsent } from '../../lib/analytics/consent';
import { ConsentPrompt } from './ConsentPrompt';
import { GA4Client } from './GA4Client';

/**
 * Load gtag, once, out of the way.
 *
 * The script is injected during an idle callback rather than from a tag in
 * index.html, so it cannot compete with the bundle for the first paint: a
 * typing game that drops frames while a measurement library parses is a game
 * that feels broken. Everything it needs to know is queued on dataLayer before
 * the library arrives, so nothing is lost by loading late.
 *
 * Consent Mode v2 defaults are set FIRST. Ad signals are denied permanently:
 * there are no ads here and there never will be. analytics_storage is granted
 * by default and denied in the regions whose law wants a yes before an
 * analytics cookie (the UK, the EEA and Switzerland). gtag resolves the
 * visitor's region on Google's side and the more specific setting wins, so the
 * order of the two defaults does not matter. A stored answer to the cookie
 * question is replayed as an update before the first hit, so a visitor who
 * said yes last week is counted from their first page today.
 *
 * `send_page_view: false` because GA4Client reports every route instead.
 */
type IdleWindow = Window & {
  requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function whenIdle(callback: () => void): () => void {
  const w = window as IdleWindow;
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(callback, { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 1000);
  return () => window.clearTimeout(id);
}

/**
 * GA4's own default is two years. Thirteen months is the longest a cookie may
 * live under the strictest European guidance, and nothing here needs longer:
 * the question is whether a visitor came back, not whether they came back in
 * 2028.
 */
const THIRTEEN_MONTHS_S = 395 * 24 * 60 * 60;

export function GtagLoader() {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (loaded || !isGA4Configured()) return;

    return whenIdle(() => {
      const measurementId = getMeasurementId();

      window.dataLayer = window.dataLayer || [];
      // The canonical shim: it pushes the `arguments` object itself, which is
      // what gtag.js reads back. An array would not survive the handover.
      window.gtag = window.gtag || function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer?.push(arguments);
      };

      window.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
      });
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        region: [...CONSENT_REGIONS],
      });
      const stored = readStoredConsent();
      if (stored) window.gtag('consent', 'update', { analytics_storage: stored });

      window.gtag('js', new Date());
      window.gtag('config', measurementId, {
        send_page_view: false,
        cookie_expires: THIRTEEN_MONTHS_S,
      });

      const script = document.createElement('script');
      script.id = 'gtag-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);

      setLoaded(true);
    });
  }, [loaded]);

  if (!loaded) return null;
  return (
    <>
      <GA4Client />
      <ConsentPrompt />
    </>
  );
}
