import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, authRedirectTo, SUPABASE_URL, SUPABASE_KEY } from './supabase';

/**
 * The *account* layer — deliberately separate from src/lib/auth.ts.
 *
 * Two different ideas share the word "sign in" in KeyTopia, and conflating them
 * would break the product:
 *
 *   auth.ts     the ACTIVE LEARNER. A household has several (kids + grown-ups);
 *               switching between them is one tap and no password. This is what
 *               /who drives.
 *
 *   account.ts  the HOUSEHOLD ACCOUNT in Supabase (this file). One grown-up
 *               signs in with Google or an email link, and that account *owns*
 *               the profiles. Children never sign in themselves, which is what
 *               keeps kid emails out of the product.
 *
 * The journey requires an account; the public pages (/typing-test and friends)
 * require none. A profile can never exist outside an account, which is what
 * stops "whose progress is this?" from ever being a question. Local-first
 * storage still applies underneath: writes go to localStorage and sync behind,
 * so only this sign-in handshake ever needs a connection.
 */

/**
 * Only Google today. Facebook was dropped on 2026-08-13: its two most basic
 * permissions (`email`, `public_profile`) both require Meta business
 * verification plus app review, which is a lot of friction for a third door
 * few parents would use. Adding a provider back is this union plus a button —
 * the enabled-provider probe below does the rest.
 */
export type OAuthProvider = 'google';

/**
 * Which door the visitor came through. Passwordless sign-in has one mechanism
 * and two very different meanings, and conflating them is what made the old
 * single screen feel wrong to a returning parent: typing an address they had
 * used for a year looked identical to signing up, and a typo in it silently
 * created a second, empty household instead of saying "no account here".
 *
 *   'signin'  the account must already exist (`shouldCreateUser: false`).
 *   'signup'  create it if it doesn't.
 */
export type AuthMode = 'signin' | 'signup';

/**
 * A sign-in email that has gone out and is waiting to be used. It lives in the
 * store, not in the screen's state, so the resend button, the code box and the
 * cooldown all read the same address and the same clock.
 */
export interface PendingLink {
  email: string;
  mode: AuthMode;
  /**
   * Epoch ms before which the server will refuse another send. Mirrors
   * `max_frequency` in supabase/config.toml; counting it down here is the
   * difference between a resend button that works and one that returns raw
   * GoTrue prose about security purposes.
   */
  nextSendAt: number;
}

/** Keep in step with `[auth.email] max_frequency` in supabase/config.toml. */
export const RESEND_COOLDOWN_MS = 20_000;

/**
 * "This browser has held an account before." Written the first time a session
 * appears and never cleared — signing out is exactly the case it exists for.
 *
 * It carries no identity, only the fact that one existed, and its whole job is
 * to open /signin on the right handle: a returning parent meets "Welcome back"
 * instead of a sign-up page. Guessing wrong costs one click either way, so it
 * fails silently in a browser that refuses storage.
 */
const SEEN_KEY = 'keytopia-seen-account';

export function hasAccountHistory(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberAccountHistory(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private mode, or storage denied. The default door is still a working one.
  }
}

interface AccountState {
  /** null = signed out. undefined-ish `ready:false` = we haven't checked yet. */
  user: User | null;
  /** False only during the first session lookup at boot. Never gates the UI. */
  ready: boolean;
  /**
   * Which sign-in method is mid-handshake, or null. Not a bare boolean: the
   * buttons share this state, and a boolean made clicking Google put the *email*
   * button into its "Sending…" state.
   */
  busy: 'google' | 'email' | 'anon' | 'code' | null;
  /** Human-readable problem from the last attempt, or null. */
  error: string | null;
  /** The email that has been sent and not yet used, or null. */
  pending: PendingLink | null;
  /**
   * True only when the last attempt failed because that address has no account
   * yet. The UI turns it into a one-tap "create one instead", so the stricter
   * sign-in door costs a genuinely new visitor nothing.
   */
  noAccount: boolean;
  /**
   * Which sign-in methods the project actually has switched on, or null until
   * we've asked. The UI renders from this rather than from a hardcoded list:
   * a provider that isn't enabled would bounce the user to a raw JSON error
   * page on Supabase, and enabling one in the dashboard should light up the
   * button here with no code change.
   */
  providers: { google: boolean; email: boolean } | null;
}

export const useAccount = create<AccountState>(() => ({
  user: null,
  ready: !isSupabaseConfigured,
  busy: null,
  error: null,
  pending: null,
  noAccount: false,
  providers: null,
}));

const set = useAccount.setState;

/**
 * Ask the project which providers are live. This is a public, unauthenticated
 * endpoint (the same data the hosted Supabase UI reads) and it is cheap, so it
 * runs once at boot alongside the session lookup.
 */
async function loadProviders(): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    const json = (await res.json()) as { external?: Record<string, boolean> };
    const ext = json.external ?? {};
    set({ providers: { google: !!ext.google, email: ext.email !== false } });
  } catch {
    // Offline at boot: assume nothing is available rather than offering a
    // button that would strand the user. It resolves on the next load.
    set({ providers: { google: false, email: false } });
  }
}

/**
 * The address has no account, so the sign-in door refused to invent one.
 * GoTrue words this three different ways depending on version and endpoint.
 */
function isNoAccount(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('signups not allowed')
    || m.includes('otp_disabled')
    || m.includes('user not found');
}

/** Turn Supabase's error text into something a parent can act on. */
function readable(message: string, provider?: string): string {
  const m = message.toLowerCase();
  // Ordered before the generic checks below: every one of these is a case a
  // user can actually fix, and the raw text for each reads like a stack trace.
  if (m.includes('security purposes')) {
    return 'That link only just went out. Give it a few seconds before asking for another.';
  }
  if (m.includes('expired')) {
    return 'That code has expired. Ask for a fresh one below.';
  }
  if (m.includes('invalid') && (m.includes('token') || m.includes('otp') || m.includes('code'))) {
    return "That code doesn't match. Check the six digits and try again.";
  }
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return `${provider ? provider[0].toUpperCase() + provider.slice(1) : 'That'} sign-in isn't switched on for this project yet.`;
  }
  if (m.includes('redirect')) return 'This address is not in the allowed redirect list for the project.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many attempts just now. Give it a minute.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No connection right now. Your progress is saved on this device either way.';
  return message;
}

export const account = {
  /** The signed-in account's user id, or null. Used as `owner` for synced rows. */
  userId(): string | null {
    return useAccount.getState().user?.id ?? null;
  },

  /** Redirects the whole tab to the provider; resolves only on failure. */
  async signInWith(provider: OAuthProvider): Promise<void> {
    if (!supabase) return;
    set({ busy: provider, error: null, noAccount: false, pending: null });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectTo(),
        // Ask for a refresh token so returning users are not bounced to the
        // provider every hour.
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) set({ busy: null, error: readable(error.message, provider) });
    // On success the browser navigates away, so `busy` is deliberately left set:
    // the button stays in its pending state until the page unloads.
  },

  /**
   * A device-bound account with no email, no password and no PII — the kid
   * class-join door (docs/classrooms-plan.md §5). Honest limitation, stated in
   * the UI too: it lives in this browser, so a cleared browser loses the link
   * (local progress survives locally; the teacher removes the stale seat and
   * the kid rejoins). Server-side it may join classes but never own one.
   */
  async signInAnonymously(): Promise<boolean> {
    if (!supabase) return false;
    set({ busy: 'anon', error: null, noAccount: false, pending: null });
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      set({ busy: null, error: readable(error?.message ?? 'Could not start a class session.') });
      return false;
    }
    set({ busy: null });
    return true;
  },

  /**
   * Passwordless email. No password to forget, and none for us to store.
   *
   * `mode` is the whole difference between the two doors: signing in will not
   * create an account, so a mistyped address says so instead of quietly
   * starting an empty second household that the family never finds again.
   */
  async sendLink(email: string, mode: AuthMode): Promise<void> {
    if (!supabase) return;
    const address = email.trim();
    set({ busy: 'email', error: null, noAccount: false, pending: null });
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authRedirectTo(), shouldCreateUser: mode === 'signup' },
    });
    if (!error) {
      set({
        busy: null,
        error: null,
        noAccount: false,
        pending: { email: address, mode, nextSendAt: Date.now() + RESEND_COOLDOWN_MS },
      });
      return;
    }
    if (mode === 'signin' && isNoAccount(error.message)) {
      set({ busy: null, noAccount: true, error: `We couldn't find an account for ${address}.` });
      return;
    }
    set({ busy: null, error: readable(error.message) });
  },

  /**
   * Send the same link to the same address again.
   *
   * Three things make this more than a second `sendLink`, and missing all
   * three is why asking for another link used to do nothing at all:
   *
   *  - The screen had no resend control. The only way back was "use a
   *    different email", which threw the address away.
   *  - The server refuses a repeat inside `max_frequency`. The cooldown is
   *    enforced here first so the button is honest about when it will work.
   *  - An account created when the first link went out but never confirmed is,
   *    to the OTP endpoint, an existing user who may not sign up again. That
   *    case falls through to the dedicated resend endpoint, the only one that
   *    re-sends a pending confirmation.
   */
  async resendLink(): Promise<void> {
    const pending = useAccount.getState().pending;
    if (!supabase || !pending || Date.now() < pending.nextSendAt) return;
    set({ busy: 'email', error: null });

    const sent = () => set({
      busy: null,
      error: null,
      pending: { ...pending, nextSendAt: Date.now() + RESEND_COOLDOWN_MS },
    });

    const { error } = await supabase.auth.signInWithOtp({
      email: pending.email,
      options: { emailRedirectTo: authRedirectTo(), shouldCreateUser: pending.mode === 'signup' },
    });
    if (!error) { sent(); return; }

    if (isNoAccount(error.message)) {
      const retry = await supabase.auth.resend({
        type: 'signup',
        email: pending.email,
        options: { emailRedirectTo: authRedirectTo() },
      });
      if (!retry.error) { sent(); return; }
      set({ busy: null, error: readable(retry.error.message) });
      return;
    }
    set({ busy: null, error: readable(error.message) });
  },

  /**
   * The same email carries a six-digit code beside the link. Typing it here
   * finishes the sign-in in the tab the visitor started in, which is the one
   * case the link genuinely cannot serve: on a phone the link opens whichever
   * browser the mail app prefers, leaving the original tab signed out forever.
   */
  async verifyCode(code: string): Promise<boolean> {
    const pending = useAccount.getState().pending;
    if (!supabase || !pending) return false;
    set({ busy: 'code', error: null });
    const token = code.replace(/\D/g, '');
    // 'email' is the generic email OTP and covers a returning user's magic
    // link. A brand-new account's first code is a *signup* confirmation, which
    // some GoTrue versions will only verify under that name, so it is the
    // second attempt rather than a separate branch — the screen cannot know
    // which of the two it is holding, and does not need to.
    let { data, error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'email' });
    if (error && !data.session) {
      const retry = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'signup' });
      if (retry.data.session) ({ data, error } = retry);
    }
    if (error || !data.session) {
      set({ busy: null, error: readable(error?.message ?? 'That code did not work.') });
      return false;
    }
    // watchAccount's listener applies the session; clearing the waiting state
    // here stops a back-navigation landing on "check your email" again.
    set({ busy: null, error: null, pending: null, noAccount: false });
    return true;
  },

  /**
   * Sign the household out. Cached profiles stay in localStorage rather than
   * being wiped: they belong to this account, and keeping them means signing
   * back in restores everything instantly and works offline. They are hidden
   * from anyone else (see visibleProfileIds in syncEngine).
   */
  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null, error: null, pending: null, noAccount: false });
  },

  /** Dismiss the last problem. The sent email, if any, is still valid. */
  clearError(): void {
    set({ error: null, noAccount: false });
  },

  /** Back to the form: forget the sent link and start over with an address. */
  reset(): void {
    set({ error: null, noAccount: false, pending: null });
  },
};

/**
 * Start listening for session changes. Called once at boot, after first paint —
 * the local store has already rendered by then, so a returning user never waits
 * on this (the instant bar, plan §8).
 *
 * `onChange` fires with the user on sign-in and null on sign-out; the sync
 * engine subscribes to it.
 */
export function watchAccount(onChange: (user: User | null) => void): () => void {
  if (!supabase) return () => {};

  const apply = (session: Session | null) => {
    const user = session?.user ?? null;
    const prev = useAccount.getState().user;
    if (user) rememberAccountHistory();
    set({ user, ready: true, busy: null });
    if (prev?.id !== user?.id) onChange(user);
  };

  // getSession reads the persisted token synchronously-ish from localStorage and
  // refreshes in the background, so this settles fast and offline.
  void supabase.auth.getSession().then(({ data }) => apply(data.session));
  void loadProviders();

  const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
  return () => data.subscription.unsubscribe();
}
