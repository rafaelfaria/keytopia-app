import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import brand from './brand.config.json';

/**
 * index.html is the one HTML file written by hand rather than generated, so the
 * brand reaches it through tokens instead of literals: `%BRAND_NAME%`,
 * `%BRAND_TITLE%`, `%BRAND_TAGLINE%`, `%SITE_URL%`, `%BRAND_DOMAIN%`,
 * `%BRAND_THEME_COLOR%`. Renaming the product means editing
 * brand.config.json — the shell document follows, in dev and in the build,
 * and scripts/prerender.mjs then rewrites the per-route tags on top.
 */
function brandTokens(): PluginOption {
  const url = (process.env.VITE_SITE_URL || brand.url).replace(/\/+$/, '');
  const tokens: Record<string, string> = {
    BRAND_NAME: brand.name,
    BRAND_SHORT_NAME: brand.shortName,
    BRAND_TAGLINE: brand.tagline,
    BRAND_TITLE: `${brand.name}: ${brand.tagline}`,
    BRAND_DOMAIN: brand.domain,
    BRAND_THEME_COLOR: brand.themeColor,
    SITE_URL: url,
  };
  return {
    name: 'brand-tokens',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%([A-Z_]+)%/g, (m, key: string) => tokens[key] ?? m),
    },
  };
}

/**
 * `vite preview` applies its SPA fallback before looking for a directory index,
 * so /faq would serve the home document even though dist/faq/index.html exists.
 * Static hosts (Vercel, Netlify, Cloudflare Pages) check the filesystem first.
 * This makes local preview behave the same way, so the prerendered output is
 * actually verifiable before deploying.
 */
function servePrerendered(): PluginOption {
  return {
    name: 'serve-prerendered',
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '/').split('?')[0];
        if (path !== '/' && !path.includes('.')) {
          const file = join(process.cwd(), 'dist', path.replace(/\/$/, ''), 'index.html');
          if (existsSync(file)) req.url = `${path.replace(/\/$/, '')}/index.html`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), brandTokens(), servePrerendered()],
  // strictPort: one dev server per machine, always on 50675. If the port is
  // taken, a second `npm run dev` fails fast instead of silently starting a
  // duplicate on the next free port — attach to the running one instead.
  server: { port: Number(process.env.PORT) || 50675, strictPort: true },
  preview: { port: Number(process.env.PORT) || 4173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1800,
  },
});
