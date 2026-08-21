import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = readdirSync(root).filter(f => f.endsWith('.html'));

let failures = 0;
let checks = 0;

function check(label, problems) {
  checks++;
  if (problems.length === 0) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`);
    for (const p of problems.slice(0, 12)) console.log(`         ${p}`);
    if (problems.length > 12) console.log(`         …and ${problems.length - 12} more`);
  }
}

const read = f => readFileSync(join(root, f), 'utf8');
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

const FORBIDDEN = [
  'del ciervo', '3183',
  '673 maple', 'maple ave',
  '134 east center', '134 e. center', '134 e center', '134 center',
  'p.o. box', 'po box 155',
];

console.log('\nLake Effect site checks\n');

{
  const problems = [];
  for (const page of pages) {
    const html = read(page);
    for (const m of html.matchAll(/href="([^"#][^"]*\.html)(?:#[^"]*)?"/g)) {
      if (!existsSync(join(root, m[1]))) problems.push(`${page} -> ${m[1]}`);
    }
  }
  check('internal links resolve', problems);
}

{
  const problems = [];
  for (const page of pages) {
    const html = read(page);
    for (const m of html.matchAll(/(?:src|href)="((?:assets|css)\/[^"]+)"/g)) {
      if (!existsSync(join(root, m[1]))) problems.push(`${page} -> ${m[1]}`);
    }
    for (const m of html.matchAll(/src="(components\.js|logo\.svg)"/g)) {
      if (!existsSync(join(root, m[1]))) problems.push(`${page} -> ${m[1]}`);
    }
  }
  check('stylesheets, scripts and images resolve', problems);
}

{
  const js = read('components.js');
  const fromJs = new Set();
  for (const m of js.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach(c => fromJs.add(c));

  const selectorsIn = file => {
    const set = new Set();
    for (const m of stripComments(read(file)).matchAll(/\.([A-Za-z][\w-]*)/g)) set.add(m[1]);
    return set;
  };

  const problems = [];
  for (const page of pages) {
    const html = read(page);
    const sheets = [...html.matchAll(/href="(css\/[^"]+\.css)"/g)].map(m => m[1]);
    const defined = new Set([...fromJs]);
    for (const s of sheets) for (const c of selectorsIn(s)) defined.add(c);

    const used = new Set();
    for (const m of html.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach(c => used.add(c));
    for (const src of [html, js]) {
      for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\('([\w-]+)'/g)) used.add(m[1]);
    }
    for (const c of fromJs) used.add(c);

    for (const c of used) if (!defined.has(c)) problems.push(`${page}: .${c} has no rule`);
  }
  check('every class used has a matching rule', problems);
}

{
  const problems = [];
  for (const page of pages) {
    const html = read(page);
    if (!/^<!DOCTYPE html>/i.test(html)) problems.push(`${page}: missing doctype`);
    if (!/<html lang="/.test(html)) problems.push(`${page}: <html> has no lang`);
    if (!/<meta name="viewport"/.test(html)) problems.push(`${page}: no viewport meta`);
    if (!/<title>/.test(html)) problems.push(`${page}: no <title>`);
    const h1s = [...html.matchAll(/<h1[\s>]/g)].length;
    if (h1s !== 1) problems.push(`${page}: ${h1s} <h1> elements, expected 1`);
    if (!/initPage\(/.test(html)) problems.push(`${page}: never calls initPage()`);
    if (/<style[\s>]/.test(html)) problems.push(`${page}: has an inline <style> block; page CSS belongs in css/`);
  }
  check('pages are structurally sound', problems);
}

{
  const problems = [];
  for (const page of pages) {
    for (const m of read(page).matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      if (!/\salt="/.test(tag)) problems.push(`${page}: <img> without alt — ${tag.slice(0, 70)}…`);
      else if (/\salt=""/.test(tag)) problems.push(`${page}: <img> with empty alt — ${tag.slice(0, 70)}…`);
    }
  }
  check('every image has alt text', problems);
}

{
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'source', 'track', 'wbr', 'path', 'circle', 'line', 'rect', 'polyline',
    'ellipse', 'text', 'use', 'stop']);
  const problems = [];
  for (const page of pages) {
    const html = read(page).replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    for (const m of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g)) {
      const [, closing, name, selfClose] = m;
      const tag = name.toLowerCase();
      if (VOID.has(tag) || selfClose) continue;
      if (!closing) stack.push(tag);
      else if (stack[stack.length - 1] === tag) stack.pop();
      else { problems.push(`${page}: </${tag}> closes <${stack[stack.length - 1] ?? 'nothing'}>`); break; }
    }
    if (stack.length) problems.push(`${page}: unclosed <${stack.join('>, <')}>`);
  }
  check('html tags are balanced', problems);
}

{
  const problems = [];
  const files = [...pages, 'components.js', 'README.md',
    ...readdirSync(join(root, 'css')).map(f => `css/${f}`)];
  for (const f of files) {
    const lower = read(f).toLowerCase();
    for (const term of FORBIDDEN) if (lower.includes(term)) problems.push(`${f} contains "${term}"`);
  }
  for (const entry of readdirSync(join(root, 'assets'))) {
    const full = join(root, 'assets', entry);
    const names = statSync(full).isDirectory()
      ? readdirSync(full).map(a => `${entry}/${a}`)
      : [entry];
    for (const name of names) {
      for (const term of FORBIDDEN) {
        if (name.toLowerCase().includes(term)) problems.push(`asset ${name}`);
      }
    }
  }
  check('no street addresses in content or filenames', problems);
}

{
  const problems = [];
  for (const page of pages.filter(p => p.startsWith('project-'))) {
    const html = read(page);
    for (const cls of ['project-hero-image', 'project-facts', 'project-body', 'project-footer']) {
      if (!html.includes(`class="${cls}"`)) problems.push(`${page}: no .${cls} section`);
    }
    if (!/<meta name="description"/.test(html)) problems.push(`${page}: no meta description`);
    const linked = [...html.matchAll(/href="(css\/[^"]+\.css)"/g)].map(m => m[1]);
    if (!linked.includes('css/project.css')) problems.push(`${page}: does not link css/project.css`);
  }
  check('project pages have the expected sections', problems);
}

{
  const html = read('residential.html');
  const filters = [...html.matchAll(/data-filter="([\w-]+)"/g)].map(m => m[1]).filter(f => f !== 'all');
  const cards = [...html.matchAll(/data-category="([\w-]+)"/g)].map(m => m[1]);
  const problems = [];
  for (const c of cards) if (!filters.includes(c)) problems.push(`card category "${c}" has no matching filter button`);
  if (cards.length === 0) problems.push('no project cards found');
  check('project categories match the filter buttons', problems);
}

{
  const problems = [];
  const files = readdirSync(join(root, 'css')).filter(f => f !== 'base.css');
  for (const f of files) {
    const css = stripComments(read(`css/${f}`));
    for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      problems.push(`css/${f}: hard-coded ${m[0]} — use a token from base.css`);
    }
  }
  check('page stylesheets use palette tokens, not raw hex', problems);
}

{
  const js = read('components.js');
  const navPages = [...js.matchAll(/data-page="([\w-]+)"/g)].map(m => m[1]);
  const problems = [];
  for (const page of pages) {
    const m = read(page).match(/initPage\('([\w-]+)'\)/);
    if (m && !navPages.includes(m[1])) problems.push(`${page}: initPage('${m[1]}') matches no nav item`);
  }
  for (const m of js.matchAll(/href="([\w-]+\.html)" data-page=/g)) {
    if (!existsSync(join(root, m[1]))) problems.push(`nav links to missing ${m[1]}`);
  }
  check('nav highlighting targets exist', problems);
}

{
  const problems = [];
  const indexPath = join(root, 'assets', 'site-index.json');
  if (!existsSync(indexPath)) {
    problems.push('assets/site-index.json missing — run `npm run build:index`');
  } else {
    const { sections } = JSON.parse(readFileSync(indexPath, 'utf8'));
    const pageSet = new Set(pages);
    for (const s of sections) {
      if (!pageSet.has(s.page)) { problems.push(`index references missing page ${s.page}`); continue; }
      if (!read(s.page).includes(`id="${s.anchor}"`)) {
        problems.push(`${s.href} — no element with that id`);
      }
      if (!s.text || s.text.length < 20) problems.push(`${s.href} — section text is empty`);
    }
    const covered = new Set(sections.map(s => s.page));
    for (const page of pages) if (!covered.has(page)) problems.push(`${page} contributes no sections`);
  }
  check('ask index resolves to real sections', problems);
}

{
  const problems = [];
  const indexPath = join(root, 'assets', 'site-index.json');
  if (existsSync(indexPath)) {
    const current = readFileSync(indexPath, 'utf8');
    const rebuilt = execFileSync(process.execPath, [join(root, 'scripts', 'build-index.mjs')], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (readFileSync(indexPath, 'utf8') !== current) {
      problems.push('site-index.json is stale — the pages changed since it was built');
      writeFileSync(indexPath, current);
    }
    void rebuilt;
  }
  check('ask index is up to date with the pages', problems);
}

console.log(`\n${checks - failures}/${checks} checks passed\n`);
process.exit(failures ? 1 : 0);
