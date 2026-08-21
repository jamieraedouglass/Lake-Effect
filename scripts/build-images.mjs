import { readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');

export const SMALL_WIDTH = 800;
const MIN_SOURCE_WIDTH = 900;

export const smallName = src =>
  src.replace(/(\.[a-z]+)$/i, `-${SMALL_WIDTH}$1`);

function widthOf(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', file], { encoding: 'utf8' });
  return Number(out.match(/pixelWidth: (\d+)/)?.[1] ?? 0);
}

export function listOriginals() {
  const files = [];
  for (const dir of readdirSync(assets)) {
    const full = join(assets, dir);
    if (!statSync(full).isDirectory()) continue;
    for (const name of readdirSync(full)) {
      if (name.includes(`-${SMALL_WIDTH}.`)) continue;
      if (!/\.(jpg|jpeg|png)$/i.test(name)) continue;
      files.push(`assets/${dir}/${name}`);
    }
  }
  return files.sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
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

  const mb = n => (n / 1048576).toFixed(1);
  console.log(`${made} small variants written, ${skipped} originals already small enough`);
  console.log(`originals ${mb(before)} MB · ${SMALL_WIDTH}px versions ${mb(after)} MB`);
}
