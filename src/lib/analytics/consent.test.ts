import { describe, expect, it } from 'vitest';
import { CONSENT_REGIONS, inConsentRegion, parseStoredConsent } from './consent';

describe('consent regions', () => {
  it('covers the EU 27, the rest of the EEA, the UK and Switzerland', () => {
    expect(CONSENT_REGIONS).toHaveLength(32);
    expect(new Set(CONSENT_REGIONS).size).toBe(32);
    for (const c of ['DE', 'FR', 'PT', 'IE', 'IS', 'NO', 'LI', 'GB', 'CH']) {
      expect(inConsentRegion(c)).toBe(true);
    }
  });

  it('leaves the rest of the world to the granted default', () => {
    for (const c of ['US', 'BR', 'CA', 'AU', 'IN', 'JP']) {
      expect(inConsentRegion(c)).toBe(false);
    }
    expect(inConsentRegion(null)).toBe(false);
    expect(inConsentRegion(undefined)).toBe(false);
    expect(inConsentRegion('')).toBe(false);
  });

  it('ignores header casing', () => {
    expect(inConsentRegion('gb')).toBe(true);
  });
});

describe('stored consent', () => {
  it('reads only the two answers', () => {
    expect(parseStoredConsent(JSON.stringify({ analytics: 'granted', at: '2026-10-24' }))).toBe('granted');
    expect(parseStoredConsent(JSON.stringify({ analytics: 'denied' }))).toBe('denied');
    expect(parseStoredConsent(JSON.stringify({ analytics: 'maybe' }))).toBeNull();
    expect(parseStoredConsent('garbage')).toBeNull();
    expect(parseStoredConsent(null)).toBeNull();
  });
});
