import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_URL = process.env.SITE_URL ?? 'https://lake-effect-brown.vercel.app';

const NAV_ITEMS: Array<[string, string, string]> = [
  ['residential.html', 'residential', 'Residential'],
  ['commercial.html', 'commercial', 'Commercial'],
  ['philosophy.html', 'philosophy', 'Philosophy'],
  ['about.html', 'about', 'About'],
];

export const PAGE_KEYS: Record<string, string> = {
  'residential.html': 'residential',
  'commercial.html': 'commercial',
  'philosophy.html': 'philosophy',
  'about.html': 'about',
  'project-lake-bluff-mcm.html': 'residential',
  'project-lake-bluff-historic.html': 'residential',
  'project-lake-forest-traditional.html': 'residential',
  'project-lake-forest-contemporary.html': 'residential',
  'project-pebble-beach.html': 'residential',
  'project-village-market.html': 'commercial',
};

const nav = (active: string | null): string => `<nav id="main-nav">
  <a class="nav-logo" href="./">
    <img src="logo.svg" alt="Lake Effect Architects" class="nav-logo-img" width="180" height="52">
  </a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
  <ul class="nav-links" id="nav-links">
${NAV_ITEMS.map(([href, key, label]) =>
  `    <li><a href="${href}" data-page="${key}"${key === active ? ' class="active" aria-current="page"' : ''}>${label}</a></li>`
).join('\n')}
  </ul>
  <a class="nav-cta" href="contact.html">Inquire</a>
</nav>`;

const footer = `<footer>
  <div class="footer-top">
    <div>
      <div class="footer-brand-name">Lake Effect<br>Architects</div>
      <p class="footer-tagline">Architecture for homes, clubs and commercial buildings on Chicago's North Shore. Lake Bluff, Illinois.</p>
    </div>
    <div>
      <div class="footer-col-title">Work</div>
      <ul class="footer-links">
        <li><a href="residential.html">Residential</a></li>
        <li><a href="commercial.html">Commercial</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Studio</div>
      <ul class="footer-links">
        <li><a href="about.html">About Us</a></li>
        <li><a href="philosophy.html">Design Philosophy</a></li>
        <li><a href="about.html#process">Process</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Contact</div>
      <ul class="footer-links">
        <li><a href="tel:8472344688">847.234.4688</a></li>
        <li><a href="mailto:rob@leffect.com">rob@leffect.com</a></li>
        <li><a href="contact.html">Start a project</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-copy">© 2026 Lake Effect Architects, Inc. &nbsp;·&nbsp; Lake Bluff, Illinois</p>
    <div class="footer-legal">
      <a href="privacy.html">Privacy</a>
      <a href="terms.html">Terms</a>
    </div>
  </div>
</footer>`;

const HEAD_LINKS = `  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Montserrat:wght@300;400;500;600&display=swap">`;


const TITLES: Record<string, string> = {
  'index.html': 'Lake Effect Architects',
  'residential.html': 'Residential',
  'commercial.html': 'Commercial',
  'philosophy.html': 'Philosophy',
  'about.html': 'About',
  'contact.html': 'Contact',
  'privacy.html': 'Privacy',
  'terms.html': 'Terms',
  '404.html': 'Not found',
  'project-lake-bluff-mcm.html': 'Ravine House',
  'project-pebble-beach.html': 'Del Monte Forest House',
  'project-lake-bluff-historic.html': 'Corner House',
  'project-lake-forest-traditional.html': 'Havenwood House',
  'project-lake-forest-contemporary.html': 'Meadow House',
  'project-village-market.html': 'Village Market Building',
};

const SHARE_IMAGES: Record<string, string> = {
  'index.html': 'assets/pebble-beach-contemporary/exterior-approach.jpg',
  'residential.html': 'assets/lake-bluff-mcm/exterior-entry-drive.jpg',
  'commercial.html': 'assets/village-market/share.jpg',
  'philosophy.html': 'assets/lake-bluff-mcm/living-dining-kitchen.jpg',
  'about.html': 'assets/lake-bluff-historic/exterior-front.jpg',
  'contact.html': 'assets/pebble-beach-contemporary/living-room-2.jpg',
  'privacy.html': 'assets/lake-bluff-mcm/exterior-entry-drive.jpg',
  'terms.html': 'assets/lake-bluff-mcm/exterior-entry-drive.jpg',
  '404.html': 'assets/lake-bluff-mcm/exterior-entry-drive.jpg',
  'project-lake-bluff-mcm.html': 'assets/lake-bluff-mcm/exterior-entry-drive.jpg',
  'project-pebble-beach.html': 'assets/pebble-beach-contemporary/exterior-approach.jpg',
  'project-lake-bluff-historic.html': 'assets/lake-bluff-historic/exterior-front.jpg',
  'project-village-market.html': 'assets/village-market/share.jpg',
  'project-lake-forest-traditional.html': 'assets/lake-forest-traditional/exterior-southeast.jpg',
  'project-lake-forest-contemporary.html': 'assets/lake-forest-contemporary/exterior-front.jpg',
};

const SHARE_NAMES: Record<string, string> = {
  'index.html': 'Lake Effect Architects',
  '404.html': 'Page not found',
  'residential.html': 'Residential — Lake Effect Architects',
  'commercial.html': 'Commercial — Lake Effect Architects',
  'philosophy.html': 'Design Philosophy — Lake Effect Architects',
  'about.html': 'About the Studio — Lake Effect Architects',
  'contact.html': 'Contact — Lake Effect Architects',
  'privacy.html': 'Privacy — Lake Effect Architects',
  'terms.html': 'Terms — Lake Effect Architects',
  'project-lake-bluff-mcm.html': 'Ravine House, Lake Bluff — Lake Effect Architects',
  'project-pebble-beach.html': 'Del Monte Forest House, Pebble Beach — Lake Effect Architects',
  'project-lake-bluff-historic.html': 'Corner House, Lake Bluff — Lake Effect Architects',
  'project-village-market.html': 'Village Market Building — Lake Effect Architects',
  'project-lake-forest-traditional.html': 'Havenwood House, Lake Forest — Lake Effect Architects',
  'project-lake-forest-contemporary.html': 'Meadow House, Lake Forest — Lake Effect Architects',
};

const escapeAttr = (v: string): string => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function shareTags(page: string, canonical: string, description: string): string {
  const image = SHARE_IMAGES[page];
  if (!image) return '';
  const title = SHARE_NAMES[page] ?? 'Lake Effect Architects';
  const absolute = `${SITE_URL}/${image}`;
  return [
    `  <meta property="og:type" content="${page === 'index.html' ? 'website' : 'article'}">`,
    `  <meta property="og:site_name" content="Lake Effect Architects">`,
    `  <meta property="og:title" content="${escapeAttr(title)}">`,
    `  <meta property="og:description" content="${escapeAttr(description)}">`,
    `  <meta property="og:url" content="${canonical}">`,
    `  <meta property="og:image" content="${absolute}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeAttr(title)}">`,
    `  <meta name="twitter:description" content="${escapeAttr(description)}">`,
    `  <meta name="twitter:image" content="${absolute}">`,
  ].join('\n');
}

const SKIP_LINK = '<a class="skip-link" href="#main">Skip to content</a>';

const NOSCRIPT = `<noscript>
  <p class="noscript-note">This site works without JavaScript, but the project filter and the Ask panel need it.</p>
</noscript>`;

export function build(): { pages: number; changed: number } {
  const pages = readdirSync(root).filter(f => f.endsWith('.html'));
  let changed = 0;

  for (const page of pages) {
    const path = join(root, page);
    const original = readFileSync(path, 'utf8');
    let s = original;

    const canonical = page === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${page.replace(/\.html$/, '')}`;
    const indexable = page !== '404.html' && !/\bTODO\b/.test(original);

    s = s.replace(/\n?  <meta property="og:[^>]*>/g, '')
         .replace(/\n?  <meta name="twitter:[^>]*>/g, '')
         .replace(/\n?  <link rel="icon"[^>]*>/g, '')
         .replace(/\n?  <link rel="apple-touch-icon"[^>]*>/g, '')
         .replace(/\n?  <link rel="preconnect"[^>]*>/g, '')
         .replace(/\n?  <link rel="stylesheet" href="https:\/\/fonts[^>]*>/g, '')
         .replace(/\n?  <link rel="canonical"[^>]*>/g, '');

    if (TITLES[page]) {
      s = s.replace(/<title>[^<]*<\/title>/, `<title>${TITLES[page]}</title>`);
    }

    const description = s.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const share = shareTags(page, canonical, description);

    s = s.replace('  <link rel="stylesheet" href="css/base.css">',
      `${indexable ? `  <link rel="canonical" href="${canonical}">\n` : ''}${share ? share + '\n' : ''}${HEAD_LINKS}\n  <link rel="stylesheet" href="css/base.css">`);

    s = s.replace(/<nav id="main-nav">[\s\S]*?<\/nav>\n?/, '');
    s = s.replace(/<footer>[\s\S]*?<\/footer>\n?/, '');
    s = s.replace(/<a class="skip-link"[^>]*>.*?<\/a>\n?/, '');
    s = s.replace(/<noscript>[\s\S]*?<\/noscript>\n?/, '');
    s = s.replace(/<main id="main"[^>]*>\n?/, '').replace(/\n?<\/main>\n?/, '\n');

    s = s.replace('<body>\n\n',
      `<body>\n\n${SKIP_LINK}\n${nav(PAGE_KEYS[page] ?? null)}\n\n<main id="main" tabindex="-1">\n`);
    s = s.replace('<script src="js/ask.js"></script>',
      `</main>\n\n${NOSCRIPT}\n\n${footer}\n\n<script src="js/ask.js"></script>`);
    if (!s.includes('js/lightbox.js')) {
      s = s.replace('<script src="js/components.js"></script>',
        '<script src="js/lightbox.js"></script>\n<script src="js/components.js"></script>');
    }
    if (!s.includes('css/lightbox.css')) {
      s = s.replace('  <link rel="stylesheet" href="css/base.css">',
        '  <link rel="stylesheet" href="css/base.css">\n  <link rel="stylesheet" href="css/lightbox.css">');
    }

    if (s !== original) {
      writeFileSync(path, s);
      changed++;
    }
  }
  return { pages: pages.length, changed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { pages, changed } = build();
  console.log(`chrome synced into ${changed} of ${pages} pages`);
}
