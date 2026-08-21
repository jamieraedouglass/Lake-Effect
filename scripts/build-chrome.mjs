import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_URL = 'https://leffect.com';

const NAV_ITEMS = [
  ['residential.html', 'residential', 'Residential'],
  ['commercial.html', 'commercial', 'Commercial'],
  ['furniture.html', 'furniture', 'Furniture'],
  ['philosophy.html', 'philosophy', 'Philosophy'],
  ['about.html', 'about', 'About'],
];

export const PAGE_KEYS = {
  'residential.html': 'residential',
  'commercial.html': 'commercial',
  'furniture.html': 'furniture',
  'philosophy.html': 'philosophy',
  'about.html': 'about',
  'project-lake-bluff-mcm.html': 'residential',
  'project-pebble-beach.html': 'residential',
  'project-lake-bluff-historic.html': 'residential',
};

const nav = active => `<nav id="main-nav">
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
      <p class="footer-tagline">Architecture and furniture design for homes, clubs and commercial buildings on Chicago's North Shore. Lake Bluff, Illinois.</p>
    </div>
    <div>
      <div class="footer-col-title">Work</div>
      <ul class="footer-links">
        <li><a href="residential.html">Residential</a></li>
        <li><a href="commercial.html">Commercial</a></li>
        <li><a href="furniture.html">Furniture Design</a></li>
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


const TITLES = {
  'index.html': 'Lake Effect Architects',
  'residential.html': 'Residential',
  'commercial.html': 'Commercial',
  'furniture.html': 'Furniture',
  'philosophy.html': 'Philosophy',
  'about.html': 'About',
  'contact.html': 'Contact',
  'privacy.html': 'Privacy',
  'terms.html': 'Terms',
  '404.html': 'Not found',
  'project-lake-bluff-mcm.html': 'Mid-Century Modern, Lake Bluff',
  'project-pebble-beach.html': 'Contemporary, Pebble Beach',
  'project-lake-bluff-historic.html': 'Traditional, Lake Bluff',
};

const SKIP_LINK = '<a class="skip-link" href="#main">Skip to content</a>';

const NOSCRIPT = `<noscript>
  <p class="noscript-note">This site works without JavaScript, but the project filter and the Ask panel need it.</p>
</noscript>`;

export function build() {
  const pages = readdirSync(root).filter(f => f.endsWith('.html'));
  let changed = 0;

  for (const page of pages) {
    const path = join(root, page);
    const original = readFileSync(path, 'utf8');
    let s = original;

    const canonical = page === 'index.html' ? `${SITE_URL}/` : `${SITE_URL}/${page.replace(/\.html$/, '')}`;
    const indexable = page !== '404.html' && !/\bTODO\b/.test(original);

    s = s.replace(/\n?  <link rel="icon"[^>]*>/g, '')
         .replace(/\n?  <link rel="apple-touch-icon"[^>]*>/g, '')
         .replace(/\n?  <link rel="preconnect"[^>]*>/g, '')
         .replace(/\n?  <link rel="stylesheet" href="https:\/\/fonts[^>]*>/g, '')
         .replace(/\n?  <link rel="canonical"[^>]*>/g, '');

    if (TITLES[page]) {
      s = s.replace(/<title>[^<]*<\/title>/, `<title>${TITLES[page]}</title>`);
    }

    s = s.replace('  <link rel="stylesheet" href="css/base.css">',
      `${indexable ? `  <link rel="canonical" href="${canonical}">\n` : ''}${HEAD_LINKS}\n  <link rel="stylesheet" href="css/base.css">`);

    s = s.replace(/<nav id="main-nav">[\s\S]*?<\/nav>\n?/, '');
    s = s.replace(/<footer>[\s\S]*?<\/footer>\n?/, '');
    s = s.replace(/<a class="skip-link"[^>]*>.*?<\/a>\n?/, '');
    s = s.replace(/<noscript>[\s\S]*?<\/noscript>\n?/, '');
    s = s.replace(/<main id="main"[^>]*>\n?/, '').replace(/\n?<\/main>\n?/, '\n');

    s = s.replace('<body>\n\n',
      `<body>\n\n${SKIP_LINK}\n${nav(PAGE_KEYS[page] ?? null)}\n\n<main id="main" tabindex="-1">\n`);
    s = s.replace('<script src="ask.js"></script>',
      `</main>\n\n${NOSCRIPT}\n\n${footer}\n\n<script src="ask.js"></script>`);

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
