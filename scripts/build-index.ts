import { readFileSync, writeFileSync } from 'node:fs';
import type { Section } from '../api/_types.ts';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages as sitePages } from './pages.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'site-index.json');
const OUT_MODULE = join(root, 'api', '_site-index.ts');

const PAGE_TITLES: Record<string, string> = {
  'index.html': 'Home',
  'residential.html': 'Residential',
  'commercial.html': 'Commercial',
  'philosophy.html': 'Design Philosophy',
  'about.html': 'About the Studio',
  'contact.html': 'Contact',
  'projects/ravine-house.html': 'Project · Ravine House',
  'projects/del-monte-forest-house.html': 'Project · Del Monte Forest House',
  'projects/corner-house.html': 'Project · Corner House',
  'projects/havenwood-house.html': 'Project · Havenwood House',
  'projects/meadow-house.html': 'Project · Meadow House',
  'privacy.html': 'Privacy',
  'terms.html': 'Terms of Use',
};

const strip = (html: string): string => html
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

const sections: Section[] = [];

for (const page of sitePages().filter(f => f !== '404.html')) {
  const html = readFileSync(join(root, page), 'utf8');
  if (/\bTODO\b/.test(html)) continue;
  const start = html.indexOf('<main');
  const end = html.indexOf('</main>');
  const body = start === -1 ? html.slice(html.indexOf('<body>')) : html.slice(start, end);
  const blocks = body.matchAll(
    /<(section|div)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)(?=<(?:section|div) [^>]*\bid="|$)/g
  );

  for (const [, , id, inner] of blocks) {
    if (!id || !inner) continue;
    if (NOT_CONTENT.has(id)) continue;
    const headingMatch = inner.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/);
    const eyebrowMatch = inner.match(/class="(?:section-eyebrow|page-hero-eyebrow)"[^>]*>([\s\S]*?)</);
    const text = strip(inner);
    if (text.length < 40) continue;

    sections.push({
      page,
      pageTitle: PAGE_TITLES[page] ?? page,
      anchor: id,
      href: page === 'index.html' ? `/#${id}` : `/${page}#${id}`,
      eyebrow: strip(eyebrowMatch?.[1] ?? ''),
      heading: strip(headingMatch?.[1] ?? ''),
      text: text.slice(0, 1400),
    });
  }
}

const index = {
  builtFrom: Object.keys(PAGE_TITLES).length + ' pages',
  sections,
};

writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n');
writeFileSync(OUT_MODULE, `import type { Section } from './_types.ts';\n\nexport const sections: Section[] = ${JSON.stringify(sections, null, 2)};\n`);

const words = sections.reduce((n, s) => n + s.text.split(' ').length, 0);
console.log(`site-index.json · ${sections.length} sections, ~${words} words (~${Math.round(words * 1.4)} tokens)`);
