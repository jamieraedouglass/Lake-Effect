import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages as sitePages } from '../scripts/pages.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = sitePages();

let failures = 0;
let checks = 0;

function check(label: string, problems: string[]): void {
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

const read = (f: string): string => readFileSync(join(root, f), 'utf8');
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const FORBIDDEN = [
  'del ciervo', '3183',
  '673 maple', 'maple ave',
  '134 east center', '134 e. center', '134 e center', '134 center',
  'havenwood ln', 'havenwood lane', '950 havenwood', 'cunningham',
  'stable lane', 'stable ln', '550 stable',
  '216 e washington', '216 east washington', 'washington ave', 'washington avenue',
  '335 meadow lake', 'meadow lake lane', 'meadow lake', 'caldwell', 'conway farms',
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
    for (const m of html.matchAll(/(?:src|href)="\/?((?:assets|css|js|brand)\/[^"]+)"/g)) {
      if (!existsSync(join(root, m[1]))) problems.push(`${page} -> ${m[1]}`);
    }
    for (const m of html.matchAll(/src="\/?(js\/[\w.-]+|brand\/[\w.-]+)"/g)) {
      if (!existsSync(join(root, m[1]))) problems.push(`${page} -> ${m[1]}`);
    }
  }
  check('stylesheets, scripts and images resolve', problems);
}

{
  const js = read('js/components.js');
  const fromJs = new Set();
  for (const m of js.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach(c => fromJs.add(c));

  const selectorsIn = (file: string): Set<string> => {
    const set = new Set<string>();
    for (const m of stripComments(read(file)).matchAll(/\.([A-Za-z][\w-]*)/g)) set.add(m[1]);
    return set;
  };

  const problems = [];
  for (const page of pages) {
    const html = read(page);
    const sheets = [...html.matchAll(/href="\/?(css\/[^"]+\.css)"/g)].map(m => m[1]);
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
  {
  // A relative href works at the root and quietly 404s one directory down,
  // which is how the whole nav died when the project pages moved.
  const problems: string[] = [];
  for (const page of pages) {
    const html = read(page);
    const dir = dirname(page);
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = m[1] ?? '';
      if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(raw)) continue;
      const target = (raw.split('#')[0] ?? '').trim();
      if (!target || target.startsWith('/api/')) continue;
      const resolved = target.startsWith('/') ? target.slice(1) : join(dir, target);
      if (!existsSync(join(root, resolved))) problems.push(`${page}: ${raw} -> /${resolved}`);
    }
  }
  {
  // A script whose stylesheet is missing still runs, so nothing errors — the
  // feature just renders as unstyled fragments. Pair them explicitly.
  const problems: string[] = [];
  for (const page of pages) {
    const html = read(page);
    for (const m of html.matchAll(/src="\/js\/([\w-]+)\.js"/g)) {
      const name = m[1] ?? '';
      if (!existsSync(join(root, `css/${name}.css`))) continue;
      if (!html.includes(`/css/${name}.css`)) {
        problems.push(`${page}: loads js/${name}.js but not css/${name}.css`);
      }
    }
  }
  check('scripts ship with their stylesheets', problems);
}

check('links resolve from the page that carries them', problems);
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
    const title = html.match(/<title>([^<]*)<\/title>/);
    if (!title) problems.push(`${page}: no <title>`);
    else if (title[1].length > 32) problems.push(`${page}: title is ${title[1].length} chars, tabs truncate around 30`);
    if (!/rel="icon" type="image\/svg\+xml"/.test(html)) problems.push(`${page}: no svg favicon`);
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
  const files = [...pages, 'js/components.js', 'src/components.ts', 'README.md',
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
    for (const cls of ['project-hero-image', 'project-footer']) {
      if (!html.includes(`class="${cls}"`)) problems.push(`${page}: no .${cls} section`);
    }
    if (html.includes('class="project-body"') !== html.includes('class="project-facts"')) {
      problems.push(`${page}: has one of .project-body / .project-facts but not the other`);
    }
    if (!/<meta name="description"/.test(html)) problems.push(`${page}: no meta description`);
    const linked = [...html.matchAll(/href="\/?(css\/[^"]+\.css)"/g)].map(m => m[1]);
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
    for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = rule[1].trim();
      if (/^\.swatch-/.test(selector)) continue;
      for (const m of rule[2].matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        problems.push(`css/${f}: ${selector} hard-codes ${m[0]} — use a token from base.css`);
      }
    }
  }
  check('page stylesheets use palette tokens, not raw hex', problems);
}

{
  const problems = [];
  const canonicalNav = read('index.html').match(/<nav id="main-nav">[\s\S]*?<\/nav>/);
  if (!canonicalNav) throw new Error('index.html has no nav to compare against');
  const canonical = canonicalNav[0];
  const navHrefs = [...canonical.matchAll(/href="([\w./-]+\.html)"/g)].map(m => m[1]);
  const navKeys = [...canonical.matchAll(/data-page="([\w-]+)"/g)].map(m => m[1]);

  for (const href of navHrefs) {
    if (!existsSync(join(root, href))) problems.push(`nav links to missing ${href}`);
  }

  for (const page of pages) {
    const html = read(page);
    const nav = html.match(/<nav id="main-nav">[\s\S]*?<\/nav>/);
    if (!nav) { problems.push(`${page}: no nav in the markup`); continue; }
    const stripped = nav[0].replace(/ class="active" aria-current="page"/g, '');
    if (stripped !== canonical.replace(/ class="active" aria-current="page"/g, '')) {
      problems.push(`${page}: nav has drifted — run npm run build:chrome`);
    }
    const active = [...nav[0].matchAll(/data-page="([\w-]+)"[^>]*class="active"/g)].map(m => m[1]);
    if (active.length > 1) problems.push(`${page}: ${active.length} nav items marked active`);
    if (active.length && !navKeys.includes(active[0])) {
      problems.push(`${page}: active item "${active[0]}" is not a nav item`);
    }
    if (!html.includes('<footer>')) problems.push(`${page}: no footer in the markup`);
  }
  check('nav and footer are in the markup and in sync', problems);
}

{
  const problems = [];
  const indexPath = join(root, 'assets', 'site-index.json');
  if (!existsSync(indexPath)) {
    problems.push('assets/site-index.json missing — run `npm run build:index`');
  } else {
    const { sections } = JSON.parse(readFileSync(indexPath, 'utf8'));
    const pageSet = new Set(pages);
    for (const s of sections as Array<Record<string, string>>) {
      if (!pageSet.has(s.page)) { problems.push(`index references missing page ${s.page}`); continue; }
      if (!read(s.page).includes(`id="${s.anchor}"`)) {
        problems.push(`${s.href} — no element with that id`);
      }
      if (!s.text || s.text.length < 20) problems.push(`${s.href} — section text is empty`);
    }
    const covered = new Set(sections.map((s: { page: string }) => s.page));
    for (const page of pages) {
      if (page === '404.html' || /\bTODO\b/.test(read(page))) continue;
      if (!covered.has(page)) problems.push(`${page} contributes no sections`);
    }
  }
  check('ask index resolves to real sections', problems);
}

{
  const problems = [];
  const indexPath = join(root, 'assets', 'site-index.json');
  if (existsSync(indexPath)) {
    const current = readFileSync(indexPath, 'utf8');
    const rebuilt = execFileSync(process.execPath, [join(root, 'scripts', 'build-index.ts')], {
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

{
  const inMarkup = new Set();
  for (const f of [...pages, 'js/ask.js', 'js/lightbox.js', 'js/components.js']) {
    const src = read(f);
    for (const m of src.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach(c => inMarkup.add(c));
    for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\('([\w-]+)'/g)) inMarkup.add(m[1]);
    for (const m of src.matchAll(/className\s*=\s*[`'"]([^`'"]*)[`'"]/g)) {
      m[1].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean).forEach(c => inMarkup.add(c));
    }
  }
  const STATE = new Set(['active', 'open', 'is-open', 'wide', 'full', 'tall', 'one',
    'ask-pending', 'ask-msg-you', 'ask-msg-studio']);

  const problems = [];
  for (const f of readdirSync(join(root, 'css'))) {
    const css = stripComments(read(`css/${f}`));
    const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => m[1]));
    for (const c of defined) {
      if (!inMarkup.has(c) && !STATE.has(c)) problems.push(`css/${f}: .${c} matches no markup`);
    }
  }
  check('no dead css rules', problems);
}

{
  const problems = [];
  for (const page of pages) {
    for (const tag of read(page).matchAll(/<img\b[^>]*>/g)) {
      const src = tag[0].match(/src="\/?(assets\/[^"]+)"/)?.[1];
      if (!src) continue;
      const width = Number(tag[0].match(/width="(\d+)"/)?.[1] ?? 0);
      if (!/\ssrcset="/.test(tag[0])) {
        if (width && width > 800) problems.push(`${page}: ${src} is ${width}px wide with no srcset`);
        continue;
      }
      if (!/\ssizes="/.test(tag[0])) problems.push(`${page}: ${src} has srcset but no sizes`);
      for (const candidate of tag[0].matchAll(/\/?(assets\/[^\s"]+)\s+\d+w/g)) {
        if (!existsSync(join(root, candidate[1]))) problems.push(`${page}: srcset points at missing ${candidate[1]}`);
      }
    }
  }
  check('responsive images resolve', problems);
}

{
  const problems = [];
  const drafts = pages.filter(p => /\bTODO\b/.test(read(p)));

  for (const draft of drafts) {
    if (!/<meta name="robots" content="noindex">/.test(read(draft))) {
      problems.push(`${draft} still has TODOs but is not noindex`);
    }
    for (const page of pages) {
      if (page === draft) continue;
      if (new RegExp(`href="${draft}(#[^"]*)?"`).test(read(page))) {
        problems.push(`${page} links to ${draft}, which still has TODOs in it`);
      }
    }
    const index = JSON.parse(readFileSync(join(root, 'assets', 'site-index.json'), 'utf8'));
    if (index.sections.some((s: { page: string }) => s.page === draft)) {
      problems.push(`${draft} is in the Ask index while it still has TODOs`);
    }
  }
  check('unfinished pages are not linked or indexed', problems);
}

{
  const problems = [];
  for (const page of pages) {
    const html = read(page);
    if (/\bTODO\b/.test(html)) continue;

    const image = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
    if (!image) { problems.push(`${page}: no og:image, so a shared link shows no picture`); continue; }

    if (!image.startsWith('http')) problems.push(`${page}: og:image is not an absolute URL`);
    if (/share\.jpg$/.test(image) === false && /-800\./.test(image)) {
      problems.push(`${page}: og:image uses the small variant`);
    }
    const local = image.replace(/^https?:\/\/[^/]+\//, '');
    if (!existsSync(join(root, local))) problems.push(`${page}: og:image points at missing ${local}`);

    for (const tag of ['og:title', 'og:description', 'og:url', 'twitter:card']) {
      const attr = tag.startsWith('og:') ? 'property' : 'name';
      if (!new RegExp(`<meta ${attr}="${tag}" content="[^"]+"`).test(html)) {
        problems.push(`${page}: missing ${tag}`);
      }
    }
  }
  check('shared links carry a picture and a title', problems);
}

{
  const problems = [];
  const stale = [
    'first project on the new site',
    'is the only project',
  ];
  const projectCount = pages.filter(p => p.startsWith('project-')).length;
  for (const page of pages) {
    const html = read(page);
    for (const claim of stale) {
      if (html.toLowerCase().includes(claim)) {
        problems.push(`${page} still says "${claim}" but there are ${projectCount} project pages`);
      }
    }
  }
  check('no copy that outlived what it described', problems);
}

console.log(`\n${checks - failures}/${checks} checks passed\n`);
process.exit(failures ? 1 : 0);
