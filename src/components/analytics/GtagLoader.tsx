import React from 'react';
import { getMeasurementId, isGA4Configured } from '../../lib/analytics/ga4';
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
 * Consent Mode v2 defaults are set FIRST and stay denied — KeyTopia measures
 * cookielessly (see src/lib/analytics/ga4.ts). Ad signals are denied
 * permanently: there are no ads here and there never will be.
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
        analytics_storage: 'denied',
      });

      window.gtag('js', new Date());
      window.gtag('config', measurementId, { send_page_view: false });

      const script = document.createElement('script');
      script.id = 'gtag-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);

      setLoaded(true);
    });
  }, [loaded]);

  return loaded ? <GA4Client /> : null;
}
