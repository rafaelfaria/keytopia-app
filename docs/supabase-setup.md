# Supabase — local first, then production

The rule this setup follows: **nothing reaches the hosted project until it has
worked locally.** A full Supabase stack (Postgres, auth, mail catcher, Studio)
runs in Docker on your machine, the schema lives in the repo as versioned
migrations, and shipping is one command that replays those same migrations
against production.

It already earned its keep: the first local run failed with `permission denied
for table profiles`. The RLS policies were correct, but the tables had no
`GRANT`, so Postgres rejected every request before it ever evaluated a policy.
That would have been a broken production deploy. The fix is at the bottom of the
initial migration.

Hosted project (production only): ref `xfthivblhhbhokcptygh`, region `us-west-2`
· https://supabase.com/dashboard/project/xfthivblhhbhokcptygh

---

## Day-to-day

```bash
npm run db:start     # boot the local stack (Docker must be running)
npm run dev          # the app, pointed at the local stack by .env.local
```

| Command | What it does |
| --- | --- |
| `npm run db:start` / `db:stop` | boot / shut down the local stack |
| `npm run db:status` | URLs and keys for the running stack |
| `npm run db:reset` | wipe the local DB and replay every migration — cheap, do it often |
| `npm run db:studio` | table browser at `127.0.0.1:54423` |
| `npm run db:mail` | **catches every auth email locally** — `127.0.0.1:54424` |
| `npm run db:diff -- <name>` | turn changes made in Studio into a new migration file |
| `npm run db:push` | apply pending migrations to the **hosted** project |

The mail catcher is why sign-in is fully testable offline: magic links land in
that inbox instead of a real one, so the whole flow works with no email
provider, no domain, and no OAuth client.

KeyTopia's ports are the Supabase defaults **+100** (API `54421`, DB `54422`,
Studio `54423`, mail `54424`) because another local Supabase project on this
machine already holds the standard `543xx` block. Both run at once.

---

## Changing the schema

Add a **new** migration; never edit one that has already run somewhere.

```bash
supabase migration new add_something   # supabase/migrations/<ts>_add_something.sql
npm run db:reset                       # replay from scratch to prove it applies cleanly
```

Or make the change in Studio and capture it with `npm run db:diff -- add_something`.

An applied migration is history. Rewriting one makes local and production
disagree in ways that surface only in production.

**Two gates, not one.** Any new table needs both an RLS policy *and* a grant to
`authenticated`. The policy decides which rows; the grant decides whether the
role may address the table at all. Miss the grant and you get a confusing
`permission denied` while the policy looks perfect.

---

## Google sign-in

One OAuth client serves both environments.

**Google Cloud Console** (https://console.cloud.google.com):

1. **APIs & Services → OAuth consent screen.** External. App name, support
   email, developer email. Scopes: `email` and `profile` only — at that level
   publishing needs no Google review.
2. Keep it in **Testing** and add your own address under *Test users* while
   trying it out; press *Publish app* when you want real users.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorised JavaScript origins:
     ```
     http://localhost:50675
     https://keytopia.app
     ```
   - Authorised redirect URIs — both, so one client covers dev and prod:
     ```
     http://127.0.0.1:54421/auth/v1/callback
     https://xfthivblhhbhokcptygh.supabase.co/auth/v1/callback
     ```
4. Copy the **Client ID** and **Client secret**.

**Locally:** put them in `supabase/.env.local` (gitignored):

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…
```

then set `enabled = true` under `[auth.external.google]` in
`supabase/config.toml` and run `npm run db:restart`.

**In production:** dashboard → Authentication → Providers → Google → enable,
paste the same two values.

The app renders whichever methods the project reports as enabled, so the Google
button appears by itself once this is on — no code change, no deploy.

---

## Auth emails — branded templates + Resend (2026-08-14)

Every email Supabase Auth can send now has a KeyTopia-branded template in
`supabase/templates/` — magic link, welcome/confirmation, invite, recovery,
email change, reauthentication OTP, and the two changed-notification emails.
Same dark card as the app, logo from the public storage bucket, and each
file's `<title>` is the subject line.

**Locally** they're wired in `config.toml` and land in Mailpit
(`npm run db:mail`) — nothing to configure.

**Production** is two scripts:

```bash
npm run deploy:templates   # push templates + subjects via the Management API
npm run setup:resend       # point auth SMTP at Resend
```

Both read `.env.local` and need `SUPABASE_ACCESS_TOKEN`
(https://supabase.com/dashboard/account/tokens).

**Resend, one-time dashboard work before `setup:resend`:**

1. Create an account at https://resend.com.
2. **Domains → Add Domain → `keytopia.app`**, add the SPF + DKIM records it
   shows at the DNS provider, wait for **Verified**.
3. **API Keys → Create API Key** ("Sending access" is enough) and put it in
   `.env.local` as `RESEND_API_KEY=re_…`.

The script verifies the domain status via Resend's API first, then PATCHes the
hosted project's SMTP settings (`smtp.resend.com:465`, sender
`KeyTopia <hello@keytopia.app>`, auth email rate limit 100/hour). Without this,
the built-in mailer sends a couple of emails per hour from a shared address —
enough to test, not enough to launch.

After running it, send yourself a magic link from the production site to
confirm delivery.

---

## Welcome email — edge function (2026-08-14)

The auth templates above never produce a welcome for KeyTopia's actual flows:
magic-link users only ever get the sign-in email, and Google users get nothing.
So the real welcome is a custom edge function,
`supabase/functions/notify-welcome-new-user`, sent through Resend the first
time an account is actually opened — not when a link is requested. It greets the user by first name
when the provider gives us one, and walks through how KeyTopia works in three
steps (profiles per kid, the journey map, sync).

**Idempotency** lives in `public.welcome_emails` (migration
`20260814000000_welcome_emails.sql`): the webhook fires more than once per user
(OAuth INSERT, first-sign-in UPDATE, retries), but only the first insert into
that table wins, so only one email sends. Service-role only, RLS on with no
policies.

**Anonymous sign-ins are OFF on the hosted project** (checked 2026-09-04:
`external_anonymous_users_enabled: false`), so the student "I have a class code"
door fails in production while everything else works. That is step 4b above,
and it has not been done.

**The gate is `last_sign_in_at`, and `enable_confirmations` had to go on
(fixed 2026-09-04).** The welcome used to fire on `email_confirmed_at`, which
sent it the moment someone typed an address rather than when they opened the
email. Changing the column was not enough, and the local stack is what proved
it: with **Confirm email** off, GoTrue autoconfirms, and asking for a link on a
new address produced three audit entries inside 15 milliseconds —

```
user_signedup → login → user_recovery_requested
```

— so `email_confirmed_at`, `last_sign_in_at` and a server-side session were all
in place before the email had even been queued. There was no later moment to
hang a welcome on, because with autoconfirm there is no confirmation event at
all.

So `[auth.email] enable_confirmations` is now **true**. Production was already
that way (`mailer_autoconfirm: false`), so this brings the local stack into line
with it rather than changing anything hosted — local was the outlier, which is
exactly why none of this was visible until the stack was running. The row is
INSERTed unconfirmed and inert; clicking the link or typing the code is what
confirms it, signs in, and fires the welcome. Existing users are already
confirmed, so the toggle locks nobody out — it only changes new signups.

`last_sign_in_at` stays the gate rather than `email_confirmed_at`: it is the
column that cannot be stamped by a signup alone, so it keeps meaning "this
account has been opened" even if the confirm toggle is ever flipped back.

Turning confirmations on has a second payoff that has nothing to do with email
timing: with it off, a stranger could bring a live, confirmed account into being
for an address that was not theirs. They could never get into it, but it
existed.

One consequence worth knowing: a brand-new address now receives the
**confirmation** template ("Welcome to KeyTopia! Confirm your email"), not
`magic_link`. Returning users still get `magic_link`. Both carry the six-digit
code, and `verifyCode` tries `type: 'email'` then `type: 'signup'`, so the
screen does not need to know which of the two it is holding.

**Deploying:**

```bash
npm run db:push                                    # the welcome_emails table
supabase functions deploy notify-welcome-new-user  # the function itself
supabase secrets set RESEND_API_KEY=re_...
```

(Optionally also `WELCOME_WEBHOOK_SECRET=<random string>` — an alternative
credential for callers that should not hold the service role key.)

**Then wire the webhook** (SQL editor, one time). The dashboard's Webhooks UI
only offers `public` tables, and this one must watch `auth.users`, so create
the triggers directly — it is exactly what the UI would generate anyway. Run in
the hosted project's SQL editor, replacing `SECRET_KEY` with an `sb_secret_...`
key from Project Settings → API Keys (that is why this lives here and not in a
migration — the key must not be committed). The new secret keys are not JWTs
and travel in the `apikey` header, never `Authorization: Bearer`. The function
verifies it against the auto-injected `SUPABASE_SECRET_KEYS`; it also still
accepts the legacy service role key as a bearer, or an
`x-welcome-secret: WELCOME_WEBHOOK_SECRET` header for callers that should not
hold a project key (local curl testing).

**What is actually on the hosted project today (checked 2026-09-04): neither of
these.** It carries a single dashboard-made trigger, `trigger-notify-welcome-new-user`,
`AFTER UPDATE ... FOR EACH ROW` with **no WHEN clause** — so the function is
invoked on every update to `auth.users`, which includes every sign-in, and only
the function's own gates stop the extra emails. There is no INSERT trigger at
all, so Google sign-ups are caught by the UPDATE that follows their INSERT
rather than by design. The `drop` list below therefore includes that name too;
without it you end up running three triggers instead of two.

```sql
-- Safe to run over the older pair, and over the dashboard-made trigger that is
-- what production actually had.
drop trigger if exists "trigger-notify-welcome-new-user" on auth.users;
drop trigger if exists welcome_email_on_signup on auth.users;
drop trigger if exists welcome_email_on_confirm on auth.users;
drop trigger if exists welcome_email_on_first_sign_in on auth.users;

-- Google sign-ups, where the row can arrive already confirmed AND signed in.
create trigger welcome_email_on_signup
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null and new.last_sign_in_at is not null)
  execute function supabase_functions.http_request(
    'https://xfthivblhhbhokcptygh.supabase.co/functions/v1/notify-welcome-new-user',
    'POST',
    '{"Content-Type":"application/json","apikey":"SECRET_KEY"}',
    '{}',
    '5000'
  );

-- Every other path, and every email sign-up: the row is INSERTed when the link
-- is requested and only signed into when the link is opened. The WHEN clause
-- matters twice over — it fires on the one UPDATE that first stamps
-- last_sign_in_at, and it keeps every later sign-in (which re-stamps the same
-- column) from invoking the function again.
create trigger welcome_email_on_first_sign_in
  after update on auth.users
  for each row
  when (old.last_sign_in_at is null and new.last_sign_in_at is not null)
  execute function supabase_functions.http_request(
    'https://xfthivblhhbhokcptygh.supabase.co/functions/v1/notify-welcome-new-user',
    'POST',
    '{"Content-Type":"application/json","apikey":"SECRET_KEY"}',
    '{}',
    '5000'
  );
```

`supabase_functions.http_request` posts the standard webhook payload (`type`,
`table`, `record`, `old_record`), which is the shape the function expects. The
WHEN clauses mean it is only invoked at the two moments that matter; the
`welcome_emails` table still guarantees once-per-user even if both fire.

**Testing without a webhook** (works locally with `supabase functions serve`):

```bash
curl -X POST http://127.0.0.1:54421/functions/v1/notify-welcome-new-user \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","schema":"auth","table":"users","record":{"id":"<uuid>","email":"you@example.com","email_confirmed_at":"2026-08-14T00:00:00Z","last_sign_in_at":"2026-08-14T00:00:00Z","raw_user_meta_data":{"name":"Rafael"}}}'
```

Drop `last_sign_in_at` from that payload and the function should answer
`{"ignored":true,"reason":"Account never signed in yet"}` — that is the
requested-but-never-opened case, and it must never send.

---

## Sign-in — two doors, and a code beside every link (2026-09-04)

`/signin` used to be one screen wearing the sign-up's clothes: "Start your
journey", an email box, and a link on its way, with no way to tell whether the
address was one we already knew. A returning parent could not find a door of
their own, and a typo made a second empty household instead of an error. It now
has two handles over the same passwordless mechanism:

- **Sign in** sends with `shouldCreateUser: false`, so an unknown address is
  answered with "no account uses that address yet" plus one tap to create it.
- **Start free** creates freely. `/signin?new=1` is that door;
  `/signin?mode=signin` is the other. With neither, the screen opens on
  whichever fits — `keytopia-seen-account` in localStorage records only that
  this browser has held a session at some point, never who.
- **Google leads** on both, above the email form: one tap beats a round trip
  through an inbox.

Every sign-in email now also carries `{{ .Token }}`, the six-digit OTP, beside
the link (`magic_link.html` and `confirmation.html`, so re-run
`npm run deploy:templates` after this change). The code is what lets the
sitting finish in the tab it started in, which is the one thing the link cannot
do: on a phone the link opens whichever browser the mail app prefers, and the
tab the parent was actually looking at stays signed out forever.

**Resending works now.** It could not before, for three reasons at once: the
"check your email" screen had no resend control at all (only "use a different
email", which threw the address away); the server refuses a repeat inside
`max_frequency` and answers with raw GoTrue prose about security purposes, so a
manual retry looked broken; and an account created when the first link went out
but never confirmed is, to the OTP endpoint, an existing user who may not sign
up again. `account.resendLink()` in `src/lib/account.ts` handles all three — it
holds the address, counts the 20s cooldown down in the button, and falls back
to `auth.resend({ type: 'signup' })`, the only endpoint that re-sends a pending
confirmation.

---

## Facebook — decided against (2026-08-13)

Not implemented, on purpose. Meta lists **Business Verification** as a hard
requirement for `email` and `public_profile` — the two most basic permissions
Facebook Login has — so there is no lightweight path: government ID or company
documents, a multi-day wait, an app review with a data-handling questionnaire,
and no localhost testing. That is a lot of friction for a third sign-in door
most parents would skip, when Google needs no review at all.

The code follows suit: `OAuthProvider` in `src/lib/account.ts` is Google only.
Reviving it later is a union member plus a button.

---

## Going to production

Only once the local flow works end to end.

1. **Link the repo to the hosted project** (once):
   ```bash
   supabase link --project-ref xfthivblhhbhokcptygh
   ```
2. **Push the schema** — replays the same migrations that have been running
   locally:
   ```bash
   npm run db:push
   ```
3. **Authentication → URL Configuration** in the dashboard:
   - Site URL: `https://keytopia.app`
   - Redirect URLs: `https://keytopia.app/auth/callback` and
     `https://*-keytopia.vercel.app/auth/callback` for preview deploys.
4. **Enable Google** with the same client ID and secret.
4b. **Enable anonymous sign-ins** — Authentication → Sign In / Up → Anonymous.
   `config.toml` only switches this on locally; without the dashboard toggle the
   student "I have a class code" door fails in production while everything else
   works. See the classroom section below for why that door exists.
5. **Vercel → Settings → Environment Variables** (Production, Preview, Development):

   | Name | Value |
   | --- | --- |
   | `VITE_SITE_URL` | `https://keytopia.app` |
   | `VITE_SUPABASE_URL` | `https://xfthivblhhbhokcptygh.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the hosted project's publishable key |

   Then redeploy — Vite inlines these at build time, so a running deployment
   will not pick them up on its own. Never add the **secret** key: it would ship
   inside the JavaScript bundle and bypass every row-level security policy.

---

## What was verified locally (2026-08-13)

All of the following passed against the local stack, signed in as
`parent@keytopia.test` via a magic link caught in Mailpit:

- **Upload.** An existing local profile became rows on first sign-in: 1
  `profiles`, 20 `sessions`, 7 `lesson_progress`, 7 `badges`, 3 `records`, with
  `owner` bound to the auth user.
- **Restore.** Clearing `keytopia-v1` entirely and reloading brought the profile
  back from the server — name, 1738 xp, 20 sessions, 7 lessons, 7 badges. This
  is the second-device path.
- **Incremental sync.** Renaming the profile and changing the theme pushed
  within seconds, with correct per-section `touched` stamps.
- **Isolation.** Querying as the owning account returns 1 profile and 20
  sessions; as a different account, 0 and 0; as a signed-out visitor,
  `permission denied`.

Worth re-running after any schema change — the last two are the ones that
matter, and the only ones that are expensive to discover in production.

---

## Classroom (2026-08-15)

`20260814121000_classrooms.sql` adds KeyTopia Classroom (docs/classrooms-plan.md
§1–4): `classes`, `class_members`, `assignments`, `class_daily_scores`, the
`class_roster` / `my_classes` views and the `join_class` / `claim_slot` /
`create_slot` RPCs. Client code lives in `src/lib/classroom.ts` and nothing else
imports the classroom tables.

Three decisions in that migration are load-bearing:

- **`profiles.days` became a `day_minutes` table.** A teacher reading practice
  minutes is now a row policy instead of a jsonb carve-out. `syncSupabase.ts`
  pushes recent days as rows; merge stays per-day max.
- **Anonymous accounts may join a class, never own one.** A RESTRICTIVE policy
  on `classes` requires a non-anonymous JWT to insert. Anonymous sign-ins are
  what let a student join with no email, and `authenticated` therefore no longer
  means "a household that signed up" anywhere in this schema.
- **Teacher visibility is two SELECT policies**, on `lesson_progress` and
  `day_minutes` only — never `profiles` (settings/key_stats) or `sessions`
  (timelines/keyAgg). Deleting a `class_members` row severs the read instantly.

**Verify after any change to it:**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/classroom_rls.sql
```

It simulates teacher / student / stranger / anonymous JWTs, asserts ~35 rules,
and rolls everything back — safe to run any time, against the local stack only.

One trap it exists to catch: policies evaluate their subqueries **as the
requester**, so a policy that reads a table the requester cannot see silently
yields NULL rather than failing. That is why `hideBoard` is checked through the
security-definer `class_board_hidden()` helper — an inline `select … from
classes` disabled the gate entirely and the suite caught it.

## Things worth knowing later

- **`.env.local` overrides `.env` for local builds**, including `npm run build`.
  It points at the local stack, so a local production build writes localhost
  URLs into the sitemap. Vercel's own env vars are what count for real deploys.
- **The local anon key is a fixed demo credential** — identical on every machine
  and worthless outside your laptop. Only the hosted key matters.
- **Deleting a profile** removes it locally but leaves the server rows. Add a
  server-side delete before schools use this.
- **Partial profile pushes must UPDATE, not UPSERT.** Postgres builds the
  candidate tuple for `insert … on conflict` and checks NOT NULL *before*
  resolving the conflict, so an upsert that omits `profile` fails with 23502
  even though the row exists. Every diff that isn't a profile edit — finishing a
  lesson, a practice run — is that case, which is why `pushChanges` branches on
  whether the changeset carries the profile section. Renaming a profile was the
  one manual test that happened to include it, so this hid for a while.
- **The `misc` jsonb column** absorbs new `ProfileData` fields automatically, so
  most feature work needs no migration at all.
- **Sessions are capped at 400 locally** but grow without limit on the server —
  the durability half of plan §8, item 5.
