import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');

/**
 * Photographs need a higher quality than drawings. At the same setting a
 * kitchen measures around 36 dB and a floor plan around 45, because line work
 * on white has far less for the encoder to lose. Two settings rather than a
 * compromise that is wrong for both.
 */
const PHOTO_QUALITY = 70;
const DRAWING_QUALITY = 58;
const isDrawing = (name: string): boolean => /plan|elevation|before|after/.test(name);

export function avifName(src: string): string {
  return src.replace(/\.(jpe?g|png)$/i, '.avif');
}

/** Every image we ship, both the full size and the 800px variant. */
export function sources(): string[] {
  const found: string[] = [];
  for (const dir of readdirSync(assets)) {
    const full = join(assets, dir);
    if (!statSync(full).isDirectory()) continue;
    for (const name of readdirSync(full)) {
      if (!/\.(jpe?g|png)$/i.test(name)) continue;
      if (name === 'share.jpg') continue;   // social scrapers want the jpeg
      found.push(`assets/${dir}/${name}`);
    }
  }
  return found.sort();
}

async function main(): Promise<void> {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    console.log('avif · sharp is not installed, skipping (committed files are used)');
    return;
  }

  let written = 0;
  let skipped = 0;
  for (const src of sources()) {
    const out = avifName(src);
    if (existsSync(join(root, out))) {
      const a = statSync(join(root, src)).mtimeMs;
      const b = statSync(join(root, out)).mtimeMs;
      if (b >= a) { skipped++; continue; }
    }
    const quality = isDrawing(src) ? DRAWING_QUALITY : PHOTO_QUALITY;
    await sharp(join(root, src)).avif({ quality, effort: 4 }).toFile(join(root, out));
    written++;
  }
  console.log(`avif · ${written} written, ${skipped} already current`);
}

await main();
