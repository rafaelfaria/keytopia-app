/**
 * Rasterises the brand SVGs in public/ into every icon size a site needs, and
 * writes the web app manifest.
 *
 * The name, tagline and colours come from brand.config.json, and public/og.svg
 * carries `{{BRAND_NAME}}` / `{{BRAND_TAGLINE}}` placeholders rather than
 * literals, so a rename does not need any of this edited.
 *
 * Run with: npm run icons
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const brand = JSON.parse(await readFile(path.resolve('brand.config.json'), 'utf8'));
const fillBrand = (svg) =>
  svg
    .replace(/\{\{BRAND_NAME\}\}/g, brand.name)
    .replace(/\{\{BRAND_TAGLINE\}\}/g, brand.tagline.charAt(0).toUpperCase() + brand.tagline.slice(1));

const PUB = path.resolve('public');
const src = (f) => readFile(path.join(PUB, f));
const out = (f) => path.join(PUB, f);

const png = async (svgFile, size, file, height) =>
  sharp(await src(svgFile), { density: 384 })
    .resize(size, height ?? size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out(file));

const jobs = [
  // transparent marks
  ['favicon-tiny.svg', 16, 'favicon-16x16.png'],
  ['favicon-tiny.svg', 32, 'favicon-32x32.png'],
  ['favicon-tiny.svg', 48, 'favicon-48x48.png'],
  ['favicon.svg', 96, 'favicon-96x96.png'],
  ['favicon.svg', 512, 'logo-512.png'],
  // PWA / platform icons (solid background)
  ['icon-maskable.svg', 192, 'icon-192.png'],
  ['icon-maskable.svg', 512, 'icon-512.png'],
  ['icon-maskable.svg', 512, 'icon-maskable-512.png'],
  ['icon-apple.svg', 180, 'apple-touch-icon.png'],
  ['icon-apple.svg', 270, 'mstile-270.png'],
];

for (const [svgFile, size, file] of jobs) {
  await png(svgFile, size, file);
  console.log(`  ${file.padEnd(26)} ${size}×${size}`);
}

// social card
await sharp(Buffer.from(fillBrand(await src('og.svg').then((b) => b.toString('utf8')))), { density: 192 }).resize(1200, 630).png({ compressionLevel: 9 }).toFile(out('og.png'));
console.log('  og.png                     1200×630');

// multi-resolution .ico for legacy browsers / bookmarks
const ico = await pngToIco([out('favicon-16x16.png'), out('favicon-32x32.png'), out('favicon-48x48.png')]);
await writeFile(out('favicon.ico'), ico);
console.log('  favicon.ico                16/32/48');

// web app manifest
await writeFile(out('site.webmanifest'), `${JSON.stringify({
  // `id` is what app stores and browsers use to identify an installed PWA
  // across start_url changes — omitting it makes an install look like a new app.
  id: '/',
  name: `${brand.name}: ${brand.tagline}`,
  short_name: brand.shortName,
  description: 'Learn to type beautifully: adaptive lessons, original games, races and deep analytics for every age.',
  start_url: '/app',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui', 'browser'],
  orientation: 'any',
  lang: 'en',
  dir: 'ltr',
  background_color: brand.themeColor,
  theme_color: brand.themeColor,
  categories: ['education', 'games', 'productivity'],
  icons: [
    { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
    { src: '/icon-192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
    { src: '/icon-512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
    { src: '/icon-maskable-512.png', type: 'image/png', sizes: '512x512', purpose: 'maskable' },
  ],
  // Long-press / jump-list entries on the installed icon.
  shortcuts: [
    { name: 'Continue training', short_name: 'Train', url: '/app' },
    { name: 'Free typing test', short_name: 'Test', url: '/typing-test' },
    { name: 'Learn to type', short_name: 'Learn', url: '/learn-to-type' },
  ],
}, null, 2)}\n`);
console.log('  site.webmanifest');
