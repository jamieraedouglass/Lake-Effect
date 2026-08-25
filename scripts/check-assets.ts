/**
 * Lists files under assets/ that nothing refers to.
 *
 * Photographs arrive in batches and not all of them make the page, so it is
 * easy to leave a few megabytes of unused originals behind. This finds them.
 *
 * It is deliberately not part of `npm test`. An unused file is untidy, not
 * broken, and a build that refuses to run over untidiness is a build people
 * learn to work around.
 *
 * Run it with `npm run check:assets`. It only ever reports; deleting is a
 * decision for a person, because a photograph that is unused today may be the
 * one someone is about to write a caption for.
 */

import { readFileSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Anywhere a filename could reasonably be mentioned. src/ and js/ matter as
// much as the pages: the Ask panel fetches site-index.json from there when the
// endpoint is unavailable, and a scan that skipped them would call it an orphan.
const SEARCHED = ['.', 'projects', 'css', 'src', 'js', 'api', 'scripts'];

let haystack = '';
for (const dir of SEARCHED) {
  for (const file of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (!file.isFile()) continue;
    if (!/\.(html|css|ts|js|json|xml|txt)$/.test(file.name)) continue;
    haystack += readFileSync(join(root, dir, file.name), 'utf8');
  }
}

const orphans: Array<{ path: string; bytes: number }> = [];
let referenced = 0;

for (const file of walk(join(root, 'assets'))) {
  const rel = relative(root, file);
  // A -800 variant and an .avif twin are generated from an original, so they
  // are in use whenever it is. Checking them on their own name would report
  // every generated file as an orphan.
  const original = rel.replace(/-800(?=\.)/, '').replace(/\.avif$/, '.jpg');
  const named = [rel, `/${rel}`, original, `/${original}`].some(n => haystack.includes(n));
  if (named) referenced++;
  else orphans.push({ path: rel, bytes: statSync(file).size });
}

console.log('');
console.log(`  ${referenced} files referenced, ${orphans.length} not`);
if (orphans.length > 0) {
  console.log('');
  let total = 0;
  for (const o of orphans.sort((a, b) => b.bytes - a.bytes)) {
    total += o.bytes;
    console.log(`     ${o.path}  (${Math.round(o.bytes / 1024)} KB)`);
  }
  console.log('');
  console.log(`  ${(total / 1_048_576).toFixed(1)} MB unreferenced. Delete only what nobody is about to use.`);
}
console.log('');
