/**
 * The cookie question.
 *
 * GA4 sets its cookie wherever analytics_storage is granted. Outside the UK,
 * the EEA and Switzerland that is the default; inside, the law wants a yes
 * first, so GtagLoader tells gtag to start denied there and this module decides
 * whether to ask, remembers the answer, and relays it.
 *
 * Two lists of regions exist on purpose. gtag resolves the visitor's region on
 * Google's side and applies the denied default by itself, which is what keeps
 * the cookie unset before anyone has answered. The browser cannot read that
 * decision back, so to know whether to *ask* it looks the country up at our
 * own edge (middleware.ts, /api/geo). The two can disagree at the margins, a
 * VPN say, and nothing breaks: the worst case is a question nobody needed.
 */

import { setAnalyticsConsent } from './ga4';

export type ConsentDecision = 'granted' | 'denied';

/**
 * The EU 27, the three other EEA states, the UK and Switzerland. ISO 3166-1
 * alpha-2, the form gtag's `region` and Vercel's x-vercel-ip-country both use.
 * The privacy page names these regions in words; change both or neither.
 */
export const CONSENT_REGIONS: readonly string[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
];

export function inConsentRegion(country: string | null | undefined): boolean {
  return !!country && CONSENT_REGIONS.includes(country.toUpperCase());
}

/** Frozen like every other `keytopia-*` key: a rename must not re-ask. */
const CONSENT_KEY = 'keytopia-consent-v1';

export function parseStoredConsent(raw: string | null): ConsentDecision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { analytics?: unknown };
    return parsed.analytics === 'granted' || parsed.analytics === 'denied' ? parsed.analytics : null;
  } catch {
    return null;
  }
}

export function readStoredConsent(): ConsentDecision | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return parseStoredConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

/** Remember the answer and tell gtag. Storage can be refused (private mode); the answer then lasts the page, which is still an answer. */
export function recordConsent(decision: ConsentDecision): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: decision, at: new Date().toISOString() }));
  } catch {
    /* see above */
  }
  setAnalyticsConsent(decision === 'granted');
}

/**
 * The visitor's country from our edge, or null when it cannot be known: the
 * Vite dev server and `vite preview` answer with index.html, another host has
 * no header, a request can fail.
 */
export async function lookupCountry(): Promise<string | null> {
  try {
    const res = await fetch('/api/geo', { credentials: 'omit', cache: 'no-store' });
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') || '').includes('application/json')) return null;
    const body = (await res.json()) as { country?: unknown };
    return typeof body.country === 'string' && body.country ? body.country : null;
  } catch {
    return null;
  }
}

/**
 * Ask when there is no answer yet and the visitor is, or may be, somewhere the
 * law wants one. Unknown counts as "may be": a question nobody needed costs a
 * click, while a visitor nobody could place would otherwise have no way to say
 * yes. It also means the prompt shows wherever /api/geo is absent, which is
 * how it gets looked at in development.
 */
export async function shouldAskForConsent(): Promise<boolean> {
  if (readStoredConsent()) return false;
  const country = await lookupCountry();
  return country === null || inConsentRegion(country);
}
