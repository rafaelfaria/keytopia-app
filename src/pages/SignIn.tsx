import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { account, useAccount, hasAccountHistory, type AuthMode } from '../lib/account';
import { isSupabaseConfigured } from '../lib/supabase';
import { Btn } from '../components/ui';
import { Ic } from '../components/icons';
import { LogoMark } from '../components/Brand';
import { BRAND } from '../lib/brand';
import { EnterJourney, GoogleMark } from '../components/Account';

/**
 * The one door into KeyTopia proper — with two handles on it.
 *
 * The public pages (/typing-test, /typing-games, /learn-to-type) stay open to
 * everyone; an account starts the *journey*: saved progress, several explorers,
 * and the online features.
 *
 * Sign-in stays passwordless. What changed is that "create an account" and
 * "get back into mine" no longer look like the same act. They share one
 * mechanism, and the old screen showed only the create-shaped version of it,
 * so a parent who had been here a year met a page headed "Start your journey"
 * with nothing to say the address they typed was even known to us. A typo made
 * a second, empty household rather than an error.
 *
 *  - `signin` refuses to create an account, and says plainly when the address
 *    has none — with one tap to create it anyway.
 *  - `signup` is the "Start free" door and creates freely.
 *  - Google leads, because a returning parent's fastest route is one tap.
 *  - Every email carries a six-digit code beside the link, so the sitting can
 *    finish in the tab it started in. That is the one thing a link cannot do:
 *    on a phone it opens whichever browser the mail app prefers.
 *
 * The entrance stagger (`data-stagger`) is a CSS animation rather than GSAP for
 * two small reasons, neither of them correctness: the auth route stops pulling
 * in GSAP, and six nth-child delays need no effect, context or cleanup. It is
 * NOT that GSAP was unsafe here. That was the first theory, on the grounds that
 * `gsap.from({opacity: 0})` leaves content hidden until a script reveals it, but
 * CSS `fill-mode: both` holds the `from` state exactly the same way, and a
 * document that is not advancing its animations is not painting either, so
 * nobody is looking at the frozen frame. Both are fine. This one is just less
 * machinery.
 *
 * The layout is two columns because one column had become a stack of five
 * full-width controls and three rules, all shouting equally: Google, an email
 * field, a submit, a class-code button, and a hairline between each. Three
 * things fixed that. The choices live on the left at a readable measure, the
 * brand takes the right where it can move without being in the way, and the
 * class-code door — a minority path, for students — steps down from a
 * full-width button to a line in the footer, which removes a button and a rule
 * at once.
 */

/** Which handle to show first. Explicit query wins; otherwise ask the device. */
function initialMode(param: URLSearchParams): AuthMode {
  if (param.get('new') === '1') return 'signup';
  if (param.get('mode') === 'signin') return 'signin';
  // A browser that has held a session before is almost certainly a returning
  // parent, even though the session itself is gone (cleared, expired, logged
  // out). Guessing right saves them a click; guessing wrong costs one.
  return hasAccountHistory() ? 'signin' : 'signup';
}

/**
 * The right-hand panel: the mark, breathing, inside three slow orbits.
 *
 * Decorative in the strict sense — the brand and every action are stated in
 * the left column — so it is hidden from assistive tech entirely rather than
 * narrated. Everything here animates transform and opacity only, which keeps
 * it off the layout and paint paths; nothing animates width, height or any
 * property that would make the form beside it re-layout.
 */
function AuthArt() {
  return (
    <aside className="auth-art" aria-hidden="true">
      <div className="auth-art-glow" />
      <div className="auth-art-scene">
        <span className="auth-orbit auth-orbit-1" />
        <span className="auth-orbit auth-orbit-2" />
        <span className="auth-orbit auth-orbit-3" />
        <span className="auth-art-mark"><LogoMark size={124} idPrefix="authart" /></span>
        {/* The same three keycaps the welcome email opens with. */}
        <span className="auth-cap auth-cap-k">K</span>
        <span className="auth-cap auth-cap-e">E</span>
        <span className="auth-cap auth-cap-y">Y</span>
      </div>
      <p className="auth-art-line">{BRAND.tagline}</p>
    </aside>
  );
}

export default function SignIn() {
  const [params] = useSearchParams();
  const { user, ready, busy, error, pending, noAccount, providers } = useAccount();
  const [mode, setMode] = useState<AuthMode>(() => initialMode(params));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  /** Seconds left before the server will accept another send. 0 = ready. */
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // The resend cooldown, ticking. Supabase enforces it server-side and answers
  // a too-early request with prose about security purposes; counting it down
  // here means the button is simply unavailable until it would work.
  useEffect(() => {
    if (!pending) { setWait(0); return; }
    const tick = () => setWait(Math.max(0, Math.ceil((pending.nextSendAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [pending]);

  // The code box is the point of this screen once the email is out.
  useEffect(() => { if (pending) codeRef.current?.focus(); }, [pending]);

  // Already signed in — resume the last explorer, or go wherever they belong.
  if (user) return <EnterJourney />;

  // A project with no Supabase configured would strand everyone at this screen,
  // so an unconfigured build falls through rather than bricking.
  if (!isSupabaseConfigured) return <Navigate to="/welcome" replace />;

  const swap = (to: AuthMode) => { setMode(to); account.reset(); };

  return (
    <div className="auth-root">
      <div className="auth-grid">
        <div className="auth-col">
          <div className="auth-panel">
            <Link to="/" className="auth-brand" aria-label={`${BRAND.name} home`}>
              <LogoMark size={30} idPrefix="authbrand" flat />
              <span>{BRAND.name}</span>
            </Link>

            {pending ? (
              <div data-stagger>
                <span className="signin-sent-ic"><Ic n="mail" size={24} /></span>
                <h1>Check your email</h1>
                <p className="auth-sub">
                  Link and six-digit code sent to <strong>{pending.email}</strong>.
                </p>

                <form
                  className="signin-code"
                  onSubmit={(e) => { e.preventDefault(); if (code.length === 6) void account.verifyCode(code); }}
                >
                  <input
                    ref={codeRef}
                    className="ob-input code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    aria-label="Six-digit code from the email"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setCode(digits);
                      if (error) account.clearError();
                    }}
                  />
                  <Btn type="submit" big disabled={Boolean(busy) || code.length !== 6}>
                    {busy === 'code' ? 'Checking…' : 'Sign in with code'}
                  </Btn>
                </form>

                <div className="signin-sent-alt">
                  <button
                    type="button" className="linkish"
                    disabled={Boolean(busy) || wait > 0}
                    onClick={() => void account.resendLink()}
                  >
                    {busy === 'email' ? 'Sending…' : wait > 0 ? `Resend in ${wait}s` : 'Send it again'}
                  </button>
                  <span aria-hidden>·</span>
                  <button type="button" className="linkish" onClick={() => { setCode(''); account.reset(); }}>
                    Use a different email
                  </button>
                </div>
              </div>
            ) : offline ? (
              <div data-stagger>
                <h1>{mode === 'signin' ? 'Welcome back' : 'Start your journey'}</h1>
                <div className="signin-offline">
                  <p><Ic n="cloud-off" size={15} /> You're offline right now.</p>
                  <p className="small muted">
                    Signing in is the one thing that needs a connection. You can
                    still use the <Link to="/typing-test">typing test</Link> and
                    the <Link to="/typing-games">games</Link> while you wait.
                  </p>
                </div>
              </div>
            ) : (
              <div data-stagger>
                <h1>{mode === 'signin' ? 'Welcome back' : 'Start your journey'}</h1>
                {/* Google first: for a returning parent this is one tap, where
                    the email route is a round trip through another app. */}
                {providers?.google && (
                  <>
                    <button type="button" className="oauth-btn" disabled={Boolean(busy)} onClick={() => void account.signInWith('google')}>
                      <GoogleMark />
                      {busy === 'google' ? 'Taking you to Google…' : 'Continue with Google'}
                    </button>
                    <div className="signin-or"><span>or with your email</span></div>
                  </>
                )}

                <form
                  className="signin-form"
                  onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) void account.sendLink(email, mode); }}
                >
                  <label className="small muted" htmlFor="si-email">Your email</label>
                  <input
                    id="si-email" className="ob-input" type="email" autoComplete="email"
                    placeholder="you@example.com" value={email}
                    onChange={(e) => { setEmail(e.target.value); account.clearError(); }}
                  />
                  <Btn type="submit" big disabled={Boolean(busy) || !email.includes('@')}>
                    {busy === 'email' ? 'Sending…' : mode === 'signin' ? 'Email me a sign-in link' : 'Create my account'}
                  </Btn>
                </form>

                {/* The stricter door's escape hatch. Refusing to create an
                    account is only kind if creating one is right here. */}
                {noAccount && (
                  <div className="signin-noaccount">
                    <p className="small">No {BRAND.name} account uses that address yet.</p>
                    <Btn kind="soft" disabled={Boolean(busy)} onClick={() => { setMode('signup'); void account.sendLink(email, 'signup'); }}>
                      Create one with {email.trim()}
                    </Btn>
                  </div>
                )}

                <p className="small muted signin-swap">
                  {mode === 'signin' ? (
                    <>New to {BRAND.name}? <button type="button" className="linkish" onClick={() => swap('signup')}>Create a free account</button></>
                  ) : (
                    <>Already have an account? <button type="button" className="linkish" onClick={() => swap('signin')}>Sign in</button></>
                  )}
                </p>
              </div>
            )}

            {error && !noAccount && <p className="small auth-err">{error}</p>}
            {!ready && !offline && <p className="small muted auth-note">Checking your session…</p>}

          </div>
        </div>

        <AuthArt />
      </div>
    </div>
  );
}
