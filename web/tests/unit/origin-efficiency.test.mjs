import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/* P0 11 Nov 2026 (Vercel Hobby paused on Fast Origin Transfer): guards for the origin-efficiency settings. */
const read = p => fs.readFileSync(p, 'utf8');

test('middleware runs only for pages (locale routing, /admin), never for static files, the API or Next internals', () => {
  const src = read('src/middleware.ts');
  const m = /matcher:\s*\['([^']+)'\]/.exec(src); assert.ok(m, 'matcher present');
  const re = new RegExp('^' + m[1].replace(/\\\\/g, '\\') + '$');
  for (const p of ['/', '/ar', '/en/cars/kia-sportage', '/ar/market/catalog', '/admin', '/admin/x', '/spare-parts', '/cars'])
    assert.ok(re.test(p), `middleware must run for ${p}`);
  for (const p of ['/media/p2/models/kia-sportage.webp', '/fonts/Archivo-Variable.subset.woff2', '/brand/carindexed-logo-ink.svg', '/api/v1/recommendation',
    '/api/health', '/_next/static/chunks/a.js', '/_next/image', '/robots.txt', '/sitemap.xml', '/favicon.ico'])
    assert.ok(!re.test(p), `middleware must NOT run for ${p}`);
});

test('robots: production blocks query-string variants (all canonicalise to clean URLs) but keeps pages and images crawlable', () => {
  const src = read('src/app/robots.ts');
  assert.match(src, /disallow: \['\/api\/', '\/admin', '\/\*\?'\]/);
  assert.match(src, /allow: \['\/', '\/_next\/image'\]/);
  assert.match(read('src/lib/seo.ts'), /canonical: `\/\$\{locale\}\$\{path\}`/); // canonicals never carry a query
});

test('next.config: CSS not inlined into every HTML response; optimised images cached 7 days', () => {
  const cfg = read('next.config.ts');
  assert.doesNotMatch(cfg, /inlineCss:\s*true/);
  assert.match(cfg, /minimumCacheTTL: 604800/);
});

test('link prefetch: off everywhere except the five header nav links (prefetch storms were ~85% of origin bytes per visit)', () => {
  const files = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') && files.push(p); } };
  walk('src');
  const bad = [];
  for (const f of files) {
    if (f.endsWith(path.join('components', 'Header.tsx'))) continue;
    const s = read(f);
    for (const m of s.matchAll(/<Link\b[^>]*>/g)) if (!/prefetch=\{false\}/.test(m[0])) bad.push(`${f}: ${m[0].slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('Vercel: builds skipped for commits that do not touch web/; deployed/live smoke stay deployment checks', () => {
  assert.equal(JSON.parse(read('vercel.json')).ignoreCommand, 'git diff --quiet HEAD^ HEAD -- .');
  for (const wf of ['../.github/workflows/web-smoke-deployed.yml', '../.github/workflows/web-smoke-live.yml']) {
    const s = read(wf);
    const cmd = s.split('\n').filter(l => /npx playwright test/.test(l) && !/production-only/.test(l));
    assert.ok(cmd.length === 1, wf);
    assert.match(cmd[0], /--project=desktop/); assert.match(cmd[0], /complete catalogue and every detail page\|no WCAG A\/AA violations/);
  }
});
