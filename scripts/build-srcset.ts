import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages as sitePages } from './pages.ts';
import { SMALL_WIDTH, smallName } from './build-images.ts';
import { avifName } from './build-avif.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SIZES: Array<[RegExp, string]> = [
  [/class="project-hero-image"/, '100vw'],
  [/<figure class="[^"]*\bfull\b[^"]*">/, '100vw'],
  [/<figure class="[^"]*\btall\b[^"]*">/, '(max-width: 860px) 100vw, 50vw'],
  [/<figure>/, '(max-width: 860px) 100vw, 50vw'],
  [/class="proj-img-inner"/, '(max-width: 860px) 100vw, 50vw'],
  [/class="comm-img-inner"/, '(max-width: 860px) 100vw, 50vw'],
  [/class="work-image-inner"/, '(max-width: 860px) 100vw, 66vw'],
  [/class="work-side-image-inner"/, '(max-width: 860px) 100vw, 33vw'],
  [/class="hero-image"/, '(max-width: 860px) 100vw, 50vw'],
  // Half the band, and capped at 560px by .approach-drawing.
  [/class="approach-drawing"/, '(max-width: 860px) 100vw, 560px'],
];

function sizesFor(html: string, imgStart: number, tag: string, planSizes: string): string | null {
  const own = tag.match(/class="([^"]*)"/)?.[1] ?? '';
  if (/\bhero-image\b/.test(own)) return '(max-width: 860px) 100vw, 50vw';
  // Capped by .studio-portrait rather than by a share of the column.
  if (/\bstudio-portrait\b/.test(own)) return '(max-width: 860px) 180px, 240px';
  if (/plan-image/.test(html.slice(Math.max(0, imgStart - 120), imgStart))) return planSizes;

  const before = html.slice(Math.max(0, imgStart - 600), imgStart);
  let best: string | null = null;
  let bestAt = -1;
  for (const [pattern, value] of SIZES) {
    const matches = [...before.matchAll(new RegExp(pattern.source, 'g'))];
    const final = matches[matches.length - 1];
    if (!final) continue;
    const at = final.index;
    if (at > bestAt) {
      bestAt = at;
      best = value;
    }
  }
  return best;
}

const pages = sitePages();
let touched = 0;
let tagged = 0;
let withAvif = 0;
const missing: string[] = [];

for (const page of pages) {
  const path = join(root, page);
  const original = readFileSync(path, 'utf8');
  let s = original;
  const planSizes = original.includes('class="plans one"')
    ? '(max-width: 860px) 100vw, 900px'
    : '(max-width: 860px) 100vw, 50vw';

  // Unwrap first, or a second build nests one <picture> inside another.
  s = s.replace(/<picture>\s*<source[^>]*>\s*/g, '').replace(/\s*<\/picture>/g, '');
  s = s.replace(/\n?\s*srcset="[^"]*"/g, '').replace(/\n?\s*sizes="[^"]*"/g, '');

  s = s.replace(/<img\b[^>]*>/g, (tag, offset) => {
    const src = tag.match(/src="\/?(assets\/[^"]+)"/)?.[1];
    if (!src) return tag;

    const small = smallName(src);
    if (!existsSync(join(root, small))) return tag;

    const sizes = sizesFor(s, offset, tag, planSizes);
    if (!sizes) {
      missing.push(`${page}: ${src}`);
      return tag;
    }

    const width = Number(tag.match(/width="(\d+)"/)?.[1] ?? 0);
    if (!width) return tag;

    tagged++;
    const jpeg = tag.replace(/>$/,
      `\n           srcset="/${small} ${SMALL_WIDTH}w, /${src} ${width}w"\n           sizes="${sizes}">`);

    // AVIF where it exists, with the jpeg left as the fallback. A browser that
    // cannot read AVIF ignores the source and takes the img, which is exactly
    // what shipped before this existed.
    const avifFull = avifName(src);
    const avifSmall = avifName(small);
    if (!existsSync(join(root, avifFull)) || !existsSync(join(root, avifSmall))) return jpeg;
    withAvif++;
    return `<picture>\n          <source type="image/avif"\n           srcset="/${avifSmall} ${SMALL_WIDTH}w, /${avifFull} ${width}w"\n           sizes="${sizes}">\n          ${jpeg}\n        </picture>`;
  });

  // The hero is the largest paint on the page, so tell the browser about it
  // before the parser reaches the markup. Preload exactly what <picture> picks.
  s = s.replace(/\n?  <link rel="preload" as="image"[^>]*>/g, '');
  const hero = s.match(/<picture>\s*<source type="image\/avif"\s*\n\s*srcset="([^"]+)"\s*\n\s*sizes="([^"]+)"/);
  if (hero) {
    const tag = `  <link rel="preload" as="image" imagesrcset="${hero[1]}" imagesizes="${hero[2]}" type="image/avif">`;
    s = s.replace('  <link rel="stylesheet" href="/css/base.css">',
      `${tag}\n  <link rel="stylesheet" href="/css/base.css">`);
  }

  if (s !== original) {
    writeFileSync(path, s);
    touched++;
  }
}

console.log(`srcset on ${tagged} images (${withAvif} with avif) across ${touched} pages`);
if (missing.length) {
  console.log('no sizes rule matched:');
  for (const m of missing) console.log(`  ${m}`);
  process.exit(1);
}
