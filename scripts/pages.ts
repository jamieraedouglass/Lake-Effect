import { readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function pages(): string[] {
  const top = readdirSync(root).filter(name => name.endsWith('.html'));
  const projectDir = join(root, 'projects');
  const nested = existsSync(projectDir)
    ? readdirSync(projectDir).filter(name => name.endsWith('.html')).map(name => `projects/${name}`)
    : [];
  return [...top, ...nested].sort();
}
