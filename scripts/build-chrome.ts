import { readFileSync, writeFileSync } from 'node:fs';
import { pages as sitePages } from './pages.ts';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_URL = process.env.SITE_URL ?? 'https://www.leffect.com';

// Root-relative: project pages sit a directory down, and a bare
// 'residential.html' resolves to /projects/residential.html from there.
const NAV_ITEMS: Array<[string, string, string]> = [
  ['/residential.html', 'residential', 'Residential'],
  ['/commercial.html', 'commercial', 'Commercial'],
  ['/philosophy.html', 'philosophy', 'Philosophy'],
  ['/about.html', 'about', 'About'],
];

export const PAGE_KEYS: Record<string, string> = {
  'residential.html': 'residential',
  'commercial.html': 'commercial',
  'philosophy.html': 'philosophy',
  'about.html': 'about',
  'projects/ravine-residence.html': 'residential',
  'projects/center-avenue-house.html': 'residential',
  'projects/havenwood-residence.html': 'residential',
  'projects/woodland-meadow-residence.html': 'residential',
  'projects/del-monte-forest-residence.html': 'residential',
  'projects/cottage-residence.html': 'residential',
  'projects/links-residence.html': 'residential',
  'projects/forest-cove-residence.html': 'residential',
  'projects/village-market-building.html': 'commercial',
  'projects/village-commons.html': 'commercial',
};

const nav = (active: string | null): string => `<nav id="main-nav">
  <a class="nav-logo" href="/">
    <img src="/brand/logo.svg" alt="Lake Effect Architects" class="nav-logo-img" width="180" height="52">
  </a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
  <ul class="nav-links" id="nav-links">
${NAV_ITEMS.map(([href, key, label]) =>
  `    <li><a href="${href}" data-page="${key}"${key === active ? ' class="active" aria-current="page"' : ''}>${label}</a></li>`
).join('\n')}
  </ul>
  <a class="nav-cta" href="/contact.html">Inquire</a>
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
        <li><a href="/residential.html">Residential</a></li>
        <li><a href="/commercial.html">Commercial</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Studio</div>
      <ul class="footer-links">
        <li><a href="/about.html">About Us</a></li>
        <li><a href="/philosophy.html">Design Philosophy</a></li>
        <li><a href="/about.html#process">Process</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Contact</div>
      <ul class="footer-links">
        <li><a href="tel:8479871000">847.987.1000</a></li>
        <li><a href="mailto:rob@leffect.com">rob@leffect.com</a></li>
        <li><a href="/contact.html">Start a project</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-copy">© 2026 Lake Effect Architects, Inc. &nbsp;·&nbsp; Lake Bluff, Illinois<br>Licensed Architect, State of Illinois &nbsp;·&nbsp; License No. 001-014968</p>
    <div class="footer-legal">
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
    </div>
  </div>
</footer>`;

const HEAD_LINKS = `  <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png">
  <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
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
  'projects/ravine-residence.html': 'The Ravine Residence',
  'projects/del-monte-forest-residence.html': 'The Del Monte Forest Residence',
  'projects/center-avenue-house.html': 'The Center Avenue House',
  'projects/havenwood-residence.html': 'The Havenwood Residence',
  'projects/woodland-meadow-residence.html': 'The Woodland Meadow Residence',
  'projects/cottage-residence.html': 'The Cottage Residence',
  'projects/links-residence.html': 'The Links Residence',
  'projects/forest-cove-residence.html': 'The Forest Cove Residence',
  'projects/village-market-building.html': 'The Village Market Building',
  'projects/village-commons.html': 'The Village Commons',
};

const SHARE_IMAGES: Record<string, string> = {
  'index.html': 'assets/del-monte-forest-residence/exterior-approach.jpg',
  'residential.html': 'assets/ravine-residence/exterior-entry-drive.jpg',
  'commercial.html': 'assets/village-market-building/share.jpg',
  'philosophy.html': 'assets/ravine-residence/living-dining-kitchen.jpg',
  'about.html': 'assets/center-avenue-house/exterior-front.jpg',
  'contact.html': 'assets/del-monte-forest-residence/living-room-2.jpg',
  'privacy.html': 'assets/ravine-residence/exterior-entry-drive.jpg',
  'terms.html': 'assets/ravine-residence/exterior-entry-drive.jpg',
  '404.html': 'assets/ravine-residence/exterior-entry-drive.jpg',
  'projects/ravine-residence.html': 'assets/ravine-residence/exterior-entry-drive.jpg',
  'projects/del-monte-forest-residence.html': 'assets/del-monte-forest-residence/exterior-approach.jpg',
  'projects/center-avenue-house.html': 'assets/center-avenue-house/exterior-front.jpg',
  'projects/village-market-building.html': 'assets/village-market-building/share.jpg',
  'projects/village-commons.html': 'assets/village-commons/exterior-southwest.jpg',
  'projects/havenwood-residence.html': 'assets/havenwood-residence/exterior-southeast.jpg',
  'projects/woodland-meadow-residence.html': 'assets/woodland-meadow-residence/exterior-front.jpg',
  'projects/cottage-residence.html': 'assets/cottage-residence/exterior-front.jpg',
  'projects/links-residence.html': 'assets/links-residence/exterior-south.jpg',
  'projects/forest-cove-residence.html': 'assets/forest-cove-residence/exterior-front.jpg',
};

const SHARE_NAMES: Record<string, string> = {
  'index.html': 'Lake Effect Architects',
  '404.html': 'Page not found',
  'residential.html': 'Residential · Lake Effect Architects',
  'commercial.html': 'Commercial · Lake Effect Architects',
  'philosophy.html': 'Design Philosophy · Lake Effect Architects',
  'about.html': 'About the Studio · Lake Effect Architects',
  'contact.html': 'Contact · Lake Effect Architects',
  'privacy.html': 'Privacy · Lake Effect Architects',
  'terms.html': 'Terms · Lake Effect Architects',
  'projects/ravine-residence.html': 'The Ravine Residence, Lake Bluff · Lake Effect Architects',
  'projects/del-monte-forest-residence.html': 'The Del Monte Forest Residence, Pebble Beach · Lake Effect Architects',
  'projects/center-avenue-house.html': 'The Center Avenue House, Lake Bluff · Lake Effect Architects',
  'projects/village-market-building.html': 'The Village Market Building, Lake Bluff · Lake Effect Architects',
  'projects/village-commons.html': 'The Village Commons, Lake Bluff · Lake Effect Architects',
  'projects/havenwood-residence.html': 'The Havenwood Residence, Lake Forest · Lake Effect Architects',
  'projects/woodland-meadow-residence.html': 'The Woodland Meadow Residence, Lake Forest · Lake Effect Architects',
  'projects/cottage-residence.html': 'The Cottage Residence, Lake Bluff · Lake Effect Architects',
  'projects/links-residence.html': 'The Links Residence, Lake Forest · Lake Effect Architects',
  'projects/forest-cove-residence.html': 'The Forest Cove Residence, Lake Bluff · Lake Effect Architects',
};

// Hand-written structured data goes stale silently: it kept naming a logo at
// a path that no longer exists, on a domain that still serves the old site.
// Generated here so it moves with SITE_URL.
function structuredData(): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    additionalType: 'https://schema.org/ArchitecturalService',
    name: 'Lake Effect Architects, Inc.',
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/brand/logo.svg`,
    image: `${SITE_URL}/assets/del-monte-forest-residence/exterior-approach.jpg`,
    email: 'rob@leffect.com',
    telephone: '+1-847-987-1000',
    description: "Architecture for homes, clubs and commercial buildings on Chicago's North Shore.",
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lake Bluff',
      addressRegion: 'IL',
      addressCountry: 'US',
    },
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'North Shore, Chicago' },
      { '@type': 'AdministrativeArea', name: 'Lake County, Illinois' },
    ],
    knowsAbout: [
      'Residential architecture',
      'Historic renovation',
      'Commercial architecture',
      'Clubhouse architecture',
    ],
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '17:00',
    },
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

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

const ANALYTICS = '<script defer src="/_vercel/insights/script.js"></script>';

const NOSCRIPT = `<noscript>
  <p class="noscript-note">This site works without JavaScript, but the project filter and the Ask panel need it.</p>
</noscript>`;

export function build(): { pages: number; changed: number } {
  const pages = sitePages();
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
         .replace(/\n?  <link rel="canonical"[^>]*>/g, '')
         .replace(/\n?<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    if (TITLES[page]) {
      s = s.replace(/<title>[^<]*<\/title>/, `<title>${TITLES[page]}</title>`);
    }

    const description = s.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const share = shareTags(page, canonical, description);

    s = s.replace('  <link rel="stylesheet" href="/css/base.css">',
      `${indexable ? `  <link rel="canonical" href="${canonical}">\n` : ''}${share ? share + '\n' : ''}${HEAD_LINKS}\n  <link rel="stylesheet" href="/css/base.css">`);

    if (page === 'index.html') {
      s = s.replace('</head>', `${structuredData()}\n</head>`);
    }

    // Each of these is put back below with blank lines around it, so the strip
    // has to take the blank lines with it. Taking only one newline left a spare
    // behind every build, and the seams crept a line further apart each time.
    s = s.replace(/<nav id="main-nav">[\s\S]*?<\/nav>\n*/, '');
    s = s.replace(/<footer>[\s\S]*?<\/footer>\n*/, '');
    s = s.replace(/<a class="skip-link"[^>]*>.*?<\/a>\n*/, '');
    s = s.replace(/<noscript>[\s\S]*?<\/noscript>\n*/, '');
    s = s.replace(/<main id="main"[^>]*>\n*/, '').replace(/\n*<\/main>\n*/, '\n');

    s = s.replace('<body>\n\n',
      `<body>\n\n${SKIP_LINK}\n${nav(PAGE_KEYS[page] ?? null)}\n\n<main id="main" tabindex="-1">\n`);
    s = s.replace(/\n?<script defer src="\/_vercel\/insights\/script\.js"><\/script>/g, '');
    s = s.replace('</body>', `${ANALYTICS}\n</body>`);

    s = s.replace('<script src="/js/ask.js"></script>',
      `</main>\n\n${NOSCRIPT}\n\n${footer}\n\n<script src="/js/ask.js"></script>`);
    if (!s.includes('/js/lightbox.js')) {
      s = s.replace('<script src="/js/components.js"></script>',
        '<script src="/js/lightbox.js"></script>\n<script src="/js/components.js"></script>');
    }
    // ask.js ships on every page; without its stylesheet the launcher collapses
    // to a few static pixels at the foot of the document and cannot be reached.
    if (s.includes('/js/ask.js') && !s.includes('/css/ask.css')) {
      s = s.replace('  <link rel="stylesheet" href="/css/base.css">',
        '  <link rel="stylesheet" href="/css/base.css">\n  <link rel="stylesheet" href="/css/ask.css">');
    }

    if (!s.includes('/css/lightbox.css')) {
      s = s.replace('  <link rel="stylesheet" href="/css/base.css">',
        '  <link rel="stylesheet" href="/css/base.css">\n  <link rel="stylesheet" href="/css/lightbox.css">');
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
