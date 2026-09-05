/**
 * The "Free tools" menu in the header.
 *
 * Eight tools behind one nav link is one click too many for the thing the site
 * most wants people to try, so the link opens a panel listing all of them.
 *
 * Hover is an enhancement here, never the mechanism. The guidance is blunt
 * about this and it is right: hover does not exist on a touchscreen and cannot
 * be reached from a keyboard, so anything that only opens on hover is broken
 * for a large share of visitors. Four ways in, then:
 *
 *   - Pointing at it with a mouse opens it. Guarded on `pointerType`, because
 *     a touch that emits a synthetic mouseenter would otherwise leave a panel
 *     stuck open with no way to dismiss it.
 *   - Tabbing into it opens it, and tabbing out closes it. The links inside are
 *     in the natural tab order.
 *   - The chevron is a real button with `aria-expanded`, which is what a touch
 *     user taps and what a screen reader announces.
 *   - "Free tools" itself stays an ordinary link to /tools, so the panel is
 *     never the only route to the content. On a phone, where the whole nav is
 *     hidden, the footer carries the same eight links on every page.
 *
 * The panel is in the DOM at all times and hidden with `hidden` rather than
 * conditionally rendered, so its links are in the prerendered HTML and part of
 * the crawlable link graph rather than appearing only after a hover that a
 * crawler will never perform.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CATEGORIES, TOOLS_BASE, toolsIn } from '../../lib/tools/registry';

const MENU_ID = 'site-head-tools-menu';

/** Long enough to cross the gap to the panel, short enough not to feel stuck. */
const CLOSE_DELAY_MS = 140;

export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  /**
   * Whether the reader has explicitly dismissed the panel while focus is still
   * inside the group.
   *
   * Escape has to return focus to the trigger, or a keyboard user is stranded
   * at the top of the document. But focusing the trigger fires the group's own
   * focus handler, which opens the panel, so Escape closed it and instantly
   * reopened it: a menu that could not be dismissed from the keyboard at all.
   *
   * The first fix was a flag cleared on the next tick, which worked only
   * because `.focus()` fires its event synchronously. That is true, and it is
   * still a bad thing to depend on. This instead holds the dismissal until
   * something happens that means a fresh intent: focus leaving the group, a
   * click on the chevron, or a mouse arriving. Escape then does what Escape
   * means everywhere else, and does not care what order any of it fires in.
   */
  const dismissed = useRef(false);
  const { pathname } = useLocation();

  const cancelClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
  }, []);

  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  // Navigating away closes it. Without this, following a link inside the panel
  // leaves the panel hanging over the page it just took you to.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      dismissed.current = true;
      setOpen(false);
      wrapRef.current?.querySelector<HTMLButtonElement>('.site-head-caret')?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div
      className={`site-head-tools${open ? ' is-open' : ''}`}
      ref={wrapRef}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        // A mouse arriving is a fresh intent, so it clears an earlier dismissal.
        dismissed.current = false;
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') closeSoon(); }}
      onFocus={() => {
        if (dismissed.current) return;
        cancelClose();
        setOpen(true);
      }}
      onBlur={(e) => {
        // `relatedTarget` is where focus is going. Staying inside the group is
        // not leaving it, which is what moving between the panel's own links is.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        dismissed.current = false;
        setOpen(false);
      }}
    >
      <NavLink to={TOOLS_BASE} className={({ isActive }) => (isActive ? 'is-on' : undefined)}>
        Free tools
      </NavLink>

      <button
        type="button"
        className="site-head-caret"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label={open ? 'Hide the list of free tools' : 'Show the list of free tools'}
        onClick={() => {
          dismissed.current = false;
          cancelClose();
          setOpen((v) => !v);
        }}
      >
        <svg viewBox="0 0 12 8" width="11" height="8" aria-hidden focusable="false">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="site-head-menu" id={MENU_ID} hidden={!open}>
        <div className="site-head-menu-inner">
          {CATEGORIES.map((cat) => (
            <div className="site-head-menu-col" key={cat.id}>
              <strong>{cat.title}</strong>
              {toolsIn(cat.id).map((t) => (
                <Link to={t.path} key={t.path}>
                  <span>{t.name}</span>
                  <em>{t.outcome}</em>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <Link className="site-head-menu-all" to={TOOLS_BASE}>
          All eight tools, and what each one is for
        </Link>
      </div>
    </div>
  );
}
