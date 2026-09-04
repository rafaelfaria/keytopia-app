import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { account, useAccount, hasAccountHistory, type AuthMode } from '../lib/account';
import { isSupabaseConfigured } from '../lib/supabase';
import { Btn, Logo } from '../components/ui';
import { Ic } from '../components/icons';
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
 * mechanism, and the old screen showed only the create-shaped version of it:
 * a parent who had been here for a year met a page headed "Start your journey"
 * and a button offering to email them a link, with nothing to say the address
 * they typed was even known to us. A typo made a second, empty household
 * rather than an error. So:
 *
 *  - `signin` refuses to create an account, and says plainly when the address
 *    has none — with one tap to create it anyway.
 *  - `signup` is the "Start free" door and creates freely.
 *  - Google sits above the email form in both, because a returning parent's
 *    fastest route is one tap, not a round trip through their inbox.
 *  - Every email also carries a six-digit code, so the sitting can finish in
 *    the tab it started in. That is the one thing a link cannot do: on a phone
 *    it opens whichever browser the mail app prefers, and the tab the parent
 *    was actually looking at stays signed out.
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

export default function SignIn() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user, ready, busy, error, pending, noAccount, providers } = useAccount();
  const [mode, setMode] = useState<AuthMode>(() => initialMode(params));
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  /** Set the moment a student chooses the class-code door, read after sign-in. */
  const [joining, setJoining] = useState(false);
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
  // A student who came in through "I have a class code" carries that errand
  // through the handshake instead of being resumed into the app.
  if (user) return <EnterJourney next={joining ? '/join' : undefined} />;

  // A project with no Supabase configured would strand everyone at this screen,
  // so an unconfigured build falls through rather than bricking.
  if (!isSupabaseConfigured) return <Navigate to="/welcome" replace />;

  const swap = (to: AuthMode) => { setMode(to); account.reset(); };

  return (
    <div className="ob-page">
      <Link to="/" aria-label="Back to landing page"><Logo /></Link>
      <div className="signin-wrap">
        {pending ? (
          <div className="signin-sent">
            <span className="signin-sent-ic"><Ic n="mail" size={26} /></span>
            <h2>Check your email</h2>
            <p className="muted">
              We sent a sign-in link and a six-digit code to{' '}
              <strong>{pending.email}</strong>. Open the link, or type the code
              here to stay in this tab.
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
                /* No maxLength: it clips the *raw* value before the non-digit
                   strip below, so pasting "123 456" would land as "12345".
                   The slice in onChange is the only limit that counts. */
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
                type="button"
                className="linkish"
                disabled={Boolean(busy) || wait > 0}
                onClick={() => void account.resendLink()}
              >
                {busy === 'email'
                  ? 'Sending…'
                  : wait > 0
                    ? `Resend in ${wait}s`
                    : 'Send it again'}
              </button>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="linkish"
                onClick={() => { setCode(''); account.reset(); }}
              >
                Use a different email
              </button>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              Nothing arrived? Check the spam folder. Links and codes last an hour.
            </p>
          </div>
        ) : offline ? (
          <>
            <h1>{mode === 'signin' ? 'Welcome back' : 'Start your journey'}</h1>
            <div className="signin-offline">
            <p><Ic n="cloud-off" size={15} /> You're offline right now.</p>
            <p className="small muted">
              Signing in is the one thing that needs a connection. You can still
              use the <Link to="/typing-test">typing test</Link> and the
              {' '}<Link to="/typing-games">games</Link> while you wait.
            </p>
            </div>
          </>
        ) : (
          <>
            <h1>{mode === 'signin' ? 'Welcome back' : 'Start your journey'}</h1>
            <p className="muted">
              {mode === 'signin'
                ? 'Sign in and every explorer picks up exactly where they left off.'
                : "One account keeps every explorer's progress safe, on any device. It's free, and there's no password to remember."}
            </p>

            {/* Google first: for a returning parent this is one tap, where the
                email route is a round trip through another app. */}
            {providers?.google && (
              <>
                <button type="button" className="oauth-btn oauth-lead" disabled={Boolean(busy)} onClick={() => void account.signInWith('google')}>
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

            {/* The stricter door's escape hatch. Refusing to create an account
                is only kind if creating one is right here. */}
            {noAccount && (
              <div className="signin-noaccount">
                <p className="small">
                  No KeyTopia account uses that address yet.
                </p>
                <Btn kind="soft" disabled={Boolean(busy)} onClick={() => { setMode('signup'); void account.sendLink(email, 'signup'); }}>
                  Create one with {email.trim()}
                </Btn>
              </div>
            )}

            {/* The kid door (docs/classrooms-plan.md §5): a device-bound
                anonymous session, then straight to the class-code screen.
                No email, no password, nothing a child needs to invent. */}
            <div className="signin-or"><span>joining a class?</span></div>
            <button
              type="button" className="oauth-btn"
              disabled={Boolean(busy)}
              onClick={() => {
                setJoining(true);
                void account.signInAnonymously().then((ok) => { if (!ok) setJoining(false); });
              }}
            >
              <Ic n="key" size={16} />
              {busy === 'anon' ? 'Getting your seat ready…' : 'I have a class code'}
            </button>
            <p className="small muted" style={{ marginTop: 6 }}>
              For students at school. The code from your teacher is all you need.
            </p>
          </>
        )}

        {error && !noAccount && <p className="small" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</p>}
        {!ready && !offline && <p className="small muted" style={{ marginTop: 12 }}>Checking your session…</p>}

        {!pending && !offline && (
          <p className="small muted signin-swap">
            {mode === 'signin' ? (
              <>New to KeyTopia? <button type="button" className="linkish" onClick={() => swap('signup')}>Create a free account</button></>
            ) : (
              <>Already have an account? <button type="button" className="linkish" onClick={() => swap('signin')}>Sign in</button></>
            )}
          </p>
        )}

        <p className="small muted signin-foot">
          Just looking? The <Link to="/typing-test">typing test</Link> and{' '}
          <Link to="/typing-games">games</Link> need no account at all.
        </p>
        <Btn kind="ghost" onClick={() => nav('/')}>← Back to KeyTopia</Btn>
      </div>
    </div>
  );
}
