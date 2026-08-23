# Renaming the product

The name lives in exactly one file: [`brand.config.json`](../brand.config.json).
Everything the machine reads resolves from there. Everything a human reads is
swept by one script. The things that cannot be swept, because they live in other
companies' dashboards, are the checklist at the bottom.

## The three layers

**1. Config.** `brand.config.json` holds the name, short name, tagline, slug,
domain, URL, theme colour, contact addresses and the Supabase project id.

**2. Code that reads the config.** Nothing below hardcodes the name:

| Where | Reads it through |
| --- | --- |
| App and public pages | `src/lib/brand.ts` (`BRAND`, `BRAND_TITLE`) |
| SEO, sitemap, llms.txt, JSON-LD | `src/lib/seo/site.ts`, which re-exports `BRAND` |
| Legal contact address | `LEGAL_CONTACT` in `src/lib/seo/content.ts` |
| `index.html` shell | `%BRAND_NAME%` / `%BRAND_TITLE%` / `%SITE_URL%` tokens, filled by the `brandTokens()` plugin in `vite.config.ts` |
| Web app manifest, favicons, `og.png` | `scripts/gen-icons.mjs` |
| Per-page social cards | `scripts/gen-og.mjs`; `public/og.svg` carries `{{BRAND_NAME}}` / `{{BRAND_TAGLINE}}` placeholders |
| Auth email subjects, Resend sender | `scripts/deploy-email-templates.sh`, `scripts/setup-resend.sh` |

Note that `src/components/Brand.tsx` exports `BRAND_COLORS`, the logo palette.
That is artwork, not identity, and it survives a rename on its own terms.

**3. Prose.** Marketing copy, legal pages, email templates, comments and docs
name the product in the middle of sentences, where a constant would only make
the writing worse. `scripts/rename-brand.mjs` rewrites those.

## Doing it

```bash
node scripts/rename-brand.mjs --name "Newname" --domain newname.app --dry
```

Read the file list, then run it again without `--dry`. It updates
`brand.config.json` last, so a dry run always compares against the current name.

Then:

```bash
npm run icons && npm run build
```

`npm run icons` restamps the favicons, the manifest and `og.png` from the new
config. The build regenerates the prerendered HTML, the sitemap, `robots.txt`,
`llms.txt` and every per-page OG card.

## What must never be renamed

These are data formats, not names. They exist on other people's machines and in
the production database, and changing one silently orphans real data. The rename
script masks them and leaves them alone:

- localStorage keys: `keytopia-v1`, `keytopia-auth`, `keytopia-sync-v1`,
  `keytopia-last-profile-v1`, `keytopia-anon-v1`, `keytopia-board-scope`,
  `keytopia-arena-scope`, `keytopia-arena-period`
- the daily-challenge seed `keytopia-daily-` in `src/lib/challenge.ts`, which
  decides which puzzle everyone gets today
- the JWT claim `keytopia_alias` and everything already applied under
  `supabase/migrations/`

If one of them genuinely has to move, write a carry-forward migration rather
than an edit. `src/lib/store.ts` has the pattern from the last rename: read the
old key, write the new one, leave the old one in place.

## Outside the repository

The script cannot reach any of this. Do it in roughly this order, and keep the
old domain redirecting for at least a year.

- [ ] Register the new domain.
- [ ] Vercel: add the domain to the project, make it primary, keep the old one
      as a 308 redirect. Rename the project if you want the dashboard tidy.
- [ ] Set `VITE_SITE_URL` to the new origin in the Vercel environment (all three
      environments) and in `.env.local`.
- [ ] Resend: add and verify the new sending domain, then `npm run setup:resend`
      to repoint Supabase SMTP at it.
- [ ] Supabase: update Site URL and the redirect allow-list in Auth settings,
      set `SITE_URL` and `RESEND_FROM_EMAIL` on the `notify-welcome-new-user`
      function, then `npm run deploy:templates` and `npm run deploy:functions`.
      The `project_id` in `supabase/config.toml` is local-only; the hosted
      project ref does not change.
- [ ] Google Search Console: add the new property, submit the new sitemap, and
      use the Change of Address tool from the old property.
- [ ] GA4: update the data stream URL. The measurement id stays.
- [ ] Bing / IndexNow: `npm run seo:ping` after the first deploy on the new
      domain, and check the IndexNow key file is served from it.
- [ ] Anywhere the old name is written by a human: the GitHub repo name, the app
      store listings if they ever exist, and the social handles.
