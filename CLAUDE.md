# KeyTopia — agent notes

## Dev server: one per machine, always port 50675

Do NOT start a new dev server if one is already running. Multiple parallel
Vite servers eat all available memory on this machine.

- The dev server always lives at `http://localhost:50675` (pinned with
  `strictPort` in vite.config.ts, so a duplicate `npm run dev` fails fast
  instead of hopping ports).
- First, attach to the running server: `preview_start {name: "keytopia"}`
  (an attach-only config, it starts nothing).
- Only if attaching fails because nothing is listening, start one with
  `preview_start {name: "keytopia-fresh"}`.
- Never run `npm run dev` / `vite` via Bash.
- `keytopia-prod` serves the built output on port 4173 (`npm run preview`),
  for verifying prerendered pages only.

## The brand name lives in one file

`brand.config.json` at the repo root is the only place the product's name,
tagline, domain, URL and contact addresses are written. Read them through
`src/lib/brand.ts` (`BRAND`, `BRAND_TITLE`) or, in the SEO layer, through
`src/lib/seo/site.ts`. Never hardcode the name in a component, a script or a
meta tag; `index.html` uses `%BRAND_NAME%`-style tokens for the same reason.

A rename is `npm run rename -- --name "Newname" --domain newname.app`, then
`npm run icons`. The storage keys and database identifiers prefixed `keytopia`
are frozen data formats and must survive it. See docs/renaming.md.
