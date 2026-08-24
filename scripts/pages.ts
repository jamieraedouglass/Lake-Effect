import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A file dropped in the root to prove ownership of the domain, such as Google's
 * site verification file, ends in .html without being a page. It has to be
 * served exactly as it arrived, so the build must not put a nav and a footer
 * through it and the tests must not hold it to what a page has to contain.
 */
function isPage(name: string): boolean {
  return readFileSync(join(root, name), 'utf8').toLowerCase().includes('<html');
}

export function pages(): string[] {
  const top = readdirSync(root).filter(name => name.endsWith('.html')).filter(isPage);
  const projectDir = join(root, 'projects');
  const nested = existsSync(projectDir)
    ? readdirSync(projectDir).filter(name => name.endsWith('.html')).map(name => `projects/${name}`)
    : [];
  return [...top, ...nested].sort();
}
