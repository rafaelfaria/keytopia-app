/**
 * The daily rebuild that keeps the blog drip honest.
 *
 * The blog publishes on a schedule: fifty-one articles, every other day, each
 * one live once its `publishedAt` date arrives. Two things read that schedule
 * and they run at different moments. middleware.ts generates sitemap.xml and
 * llms.txt per request, against the real date. The prerendered HTML in dist/ is
 * written once, by `scripts/prerender.mjs`, at build time.
 *
 * Nothing rebuilt the site on its own, so the second article's date arrived,
 * the sitemap started advertising its URL, and the static file behind it did
 * not exist. Repeat every second day until December.
 *
 * This endpoint asks Vercel to build again. `vercel.json` calls it just after
 * midnight UTC, which is the boundary `todayIso()` uses, so a new article's
 * static HTML exists within minutes of becoming published.
 *
 * Two environment variables, both set in the Vercel project:
 *
 *   DEPLOY_HOOK_URL  a Deploy Hook created under Settings → Git. Calling it
 *                    triggers a production build of the tracked branch.
 *   CRON_SECRET      Vercel sends this as a bearer token on cron invocations.
 *                    Without it the endpoint is a public rebuild button.
 */

export const config = { runtime: 'nodejs' };

export default async function handler(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const hook = process.env.DEPLOY_HOOK_URL;

  // Fail closed. An unset secret would otherwise mean "no check", and this
  // endpoint can spend build minutes.
  if (!secret) {
    return json(500, { ok: false, error: 'CRON_SECRET is not set. Refusing to run unauthenticated.' });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json(401, { ok: false, error: 'Unauthorized.' });
  }
  if (!hook) {
    return json(500, { ok: false, error: 'DEPLOY_HOOK_URL is not set.' });
  }

  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) {
    return json(502, { ok: false, error: `Deploy hook returned ${res.status}.` });
  }

  return json(200, { ok: true, triggered: new Date().toISOString() });
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
