import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'site-index.json');
const OUT_MODULE = join(root, 'api', 'site-index.js');

const PAGE_TITLES = {
  'index.html': 'Home',
  'residential.html': 'Residential',
  'commercial.html': 'Commercial',
  'furniture.html': 'Furniture Design',
  'philosophy.html': 'Design Philosophy',
  'about.html': 'About the Studio',
  'contact.html': 'Contact',
  'project-lake-bluff-mcm.html': 'Project · Mid-Century Modern, Lake Bluff',
  'project-pebble-beach.html': 'Project · Contemporary, Pebble Beach',
  'project-lake-bluff-historic.html': 'Project · Traditional / Historic, Lake Bluff',
  'privacy.html': 'Privacy',
  'terms.html': 'Terms of Use',
};

const strip = html => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&(?:middot|#183);/g, '·')
  .replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const NOT_CONTENT = new Set([
  'contact-form', 'form-success', 'form-error', 'projects', 'projects-empty',
  'first-name', 'last-name', 'email', 'phone', 'project-type', 'location',
  'budget', 'message', 'nav-links', 'main-nav',
]);

const sections = [];

for (const page of readdirSync(root).filter(f => f.endsWith('.html') && f !== '404.html')) {
  const html = readFileSync(join(root, page), 'utf8');
  const start = html.indexOf('<main');
  const end = html.indexOf('</main>');
  const body = start === -1 ? html.slice(html.indexOf('<body>')) : html.slice(start, end);
  const blocks = body.matchAll(
    /<(section|div)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)(?=<(?:section|div) [^>]*\bid="|$)/g
  );

  for (const [, , id, inner] of blocks) {
    if (NOT_CONTENT.has(id)) continue;
    const headingMatch = inner.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/);
    const eyebrowMatch = inner.match(/class="(?:section-eyebrow|page-hero-eyebrow)"[^>]*>([\s\S]*?)</);
    const text = strip(inner);
    if (text.length < 40) continue;

    sections.push({
      page,
      pageTitle: PAGE_TITLES[page] ?? page,
      anchor: id,
      href: page === 'index.html' ? `./#${id}` : `${page}#${id}`,
      eyebrow: eyebrowMatch ? strip(eyebrowMatch[1]) : '',
      heading: headingMatch ? strip(headingMatch[1]) : '',
      text: text.slice(0, 1400),
    });
  }
}

const index = {
  builtFrom: Object.keys(PAGE_TITLES).length + ' pages',
  sections,
};

writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n');
writeFileSync(OUT_MODULE, `export const sections = ${JSON.stringify(sections, null, 2)};\n`);

const words = sections.reduce((n, s) => n + s.text.split(' ').length, 0);
console.log(`site-index.json · ${sections.length} sections, ~${words} words (~${Math.round(words * 1.4)} tokens)`);
