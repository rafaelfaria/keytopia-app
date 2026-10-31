import React from 'react';
import { Link } from 'react-router-dom';
import { recordConsent, shouldAskForConsent } from '../../lib/analytics/consent';
import { pageview } from '../../lib/analytics/ga4';

/**
 * The cookie question, asked once.
 *
 * Shown only where the law wants a yes before an analytics cookie (see
 * consent.ts for the regions and the lookup) and only until it is answered.
 * It never takes focus: a learner may be mid-sentence in a lesson, and a
 * prompt that steals the next keystroke is a bug in a typing tutor. A card in
 * the corner rather than a bar, so the keyboard stays visible behind it.
 *
 * Mounted by GtagLoader once gtag exists, so an answer always has somewhere
 * to go. Client-only by construction: nothing renders until an effect says so,
 * which also keeps the prerendered pages free of it.
 */
export function ConsentPrompt() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    shouldAskForConsent().then((ask) => {
      if (!cancelled && ask) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const answer = (granted: boolean) => {
    recordConsent(granted ? 'granted' : 'denied');
    setOpen(false);
    // The page already on screen was reported as an unconsented ping, which
    // GA4 does not count. Report it again now that it may.
    if (granted) pageview();
  };

  return (
    <aside className="consent" aria-label="Cookie choice">
      <p>
        May our visit counter set one cookie? It holds a random number so a returning
        visitor is not counted as a new one, and nothing about who you are.{' '}
        <Link to="/privacy">How we count visits</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-primary" onClick={() => answer(true)}>
          Allow
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => answer(false)}>
          No thanks
        </button>
      </div>
    </aside>
  );
}
