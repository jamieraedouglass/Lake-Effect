import { writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from './build-chrome.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PRIORITY = {
  'index.html': '1.0',
  'residential.html': '0.9',
  'commercial.html': '0.8',
  'furniture.html': '0.8',
  'philosophy.html': '0.7',
  'about.html': '0.7',
  'contact.html': '0.7',
  'privacy.html': '0.2',
  'terms.html': '0.2',
};

const today = process.env.SITEMAP_DATE ?? new Date().toISOString().slice(0, 10);

const urls = readdirSync(root)
  .filter(f => f.endsWith('.html') && f !== '404.html')
  .sort()
  .map(page => {
    const loc = page === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${page.replace(/\.html$/, '')}`;
    const priority = PRIORITY[page] ?? '0.8';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
  });

writeFileSync(join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

console.log(`sitemap.xml · ${urls.length} urls`);
