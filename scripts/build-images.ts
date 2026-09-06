import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');

export const SMALL_WIDTH = 800;
const MIN_SOURCE_WIDTH = 900;

export const smallName = (src: string): string =>
  src.replace(/(\.[a-z]+)$/i, `-${SMALL_WIDTH}$1`);

function haveSips(): boolean {
  try {
    execFileSync('sips', ['--help'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * The size a JPEG or PNG declares in its own header.
 *
 * Worth reading rather than assuming, because `sips -Z` fits the longest edge:
 * a portrait original comes back about 600px wide, not 800. Anything that
 * quotes a width to a browser has to take it off the file.
 */
export function pixelSize(file: string): { width: number; height: number } | null {
  const d = readFileSync(file);
  // PNG carries width and height in the IHDR box, at a fixed offset.
  if (d.length > 24 && d.readUInt32BE(0) === 0x89504e47) {
    return { width: d.readUInt32BE(16), height: d.readUInt32BE(20) };
  }
  let i = 2;
  while (i + 9 < d.length) {
    if (d[i] !== 0xff) { i++; continue; }
    const marker = d[i + 1] ?? 0;
    // Start-of-frame markers carry the dimensions; SOI, EOI and RSTn have no length.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: d.readUInt16BE(i + 5), width: d.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    i += 2 + d.readUInt16BE(i + 2);
  }
  return null;
}

function widthOf(file: string): number {
  return pixelSize(file)?.width ?? 0;
}

export function listOriginals(): string[] {
  const files: string[] = [];
  for (const dir of readdirSync(assets)) {
    const full = join(assets, dir);
    if (!statSync(full).isDirectory()) continue;
    for (const name of readdirSync(full)) {
      if (name.includes(`-${SMALL_WIDTH}.`) || name === 'share.jpg') continue;
      if (!/\.(jpg|jpeg|png)$/i.test(name)) continue;
      files.push(`assets/${dir}/${name}`);
    }
  }
  return files.sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!haveSips()) {
    console.log('sips not available on this platform; leaving the committed image set alone');
    process.exit(0);
  }

  let made = 0, skipped = 0;
  let before = 0, after = 0;

  for (const rel of listOriginals()) {
    const src = join(root, rel);
    const width = widthOf(src);
    before += statSync(src).size;

    if (width < MIN_SOURCE_WIDTH) {
      skipped++;
      continue;
    }

    const out = join(root, smallName(rel));
    if (!existsSync(out)) {
      const ext = extname(src).toLowerCase();
      const format = ext === '.png' ? 'png' : 'jpeg';
      const args = ['-Z', String(SMALL_WIDTH), '-s', 'format', format];
      if (format === 'jpeg') args.push('-s', 'formatOptions', 'normal');
      execFileSync('sips', [...args, src, '--out', out], { stdio: 'ignore' });
      made++;
    }
    after += statSync(out).size;
  }

  const mb = (n: number): string => (n / 1048576).toFixed(1);
  console.log(`${made} small variants written, ${skipped} originals already small enough`);
  console.log(`originals ${mb(before)} MB · ${SMALL_WIDTH}px versions ${mb(after)} MB`);
}
