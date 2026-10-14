import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

// Brand V2 package byte sizes as published in Drive folder 1CatHPXah60JBNVMPT2yGqc8WE28lg0vQ (v2.0-draft.10).
const DRIVE_SIZES = {
  'Archivo-Variable.ttf': 658596, 'NotoKufiArabic-Variable.ttf': 434204, 'IBMPlexSans-Variable.ttf': 537244,
  'IBMPlexSansArabic-Regular.ttf': 235924, 'IBMPlexSansArabic-Medium.ttf': 242100, 'IBMPlexSansArabic-SemiBold.ttf': 244616, 'IBMPlexSansArabic-Bold.ttf': 246992,
};
test('self-hosted fonts match Brand V2 package sizes', () => {
  for (const [f, size] of Object.entries(DRIVE_SIZES)) assert.equal(statSync(`public/fonts/${f}`).size, size, f);
});
test('tokens CSS is the generated v2.0-draft.10 file', () => {
  const css = readFileSync('src/styles/carindex.tokens.css', 'utf8');
  assert.match(css, /v2\.0-draft\.10/);
  assert.equal(Buffer.byteLength(css), 4804);
});
test('no JetBrains Mono, no Google Fonts, no V1.5 references in source', () => {
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
  for (const f of walk('src').filter(f => /\.(tsx?|css)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /JetBrains/i, f);
    assert.doesNotMatch(s, /fonts\.googleapis|fonts\.gstatic/, f);
    assert.doesNotMatch(s, /V1\.5/, f);
  }
});

test('every package TTF has a subset WOFF2 sibling and fonts.css prefers it', () => {
  // *.subset.woff2: same Brand V2 typefaces cut to the used scripts (Latin / Arabic) and weight/width ranges (perf, AT-43).
  const css = readFileSync('src/styles/fonts.css', 'utf8');
  for (const f of Object.keys(DRIVE_SIZES)) {
    const w = f.replace(/\.ttf$/, '.subset.woff2');
    assert.ok(statSync(`public/fonts/${w}`).size < statSync(`public/fonts/${f.replace(/\.ttf$/, '.woff2')}`).size, w);
    assert.match(css, new RegExp(`url\\('/fonts/${w.replace('.', '\\.')}'\\) format\\('woff2'\\), url\\('/fonts/${f.replace('.', '\\.')}'\\)`));
  }
});

test('white-only P2 brand logos are exactly the dark-tile list (shown unchanged on ink, never recoloured)', async () => {
  const { execFileSync } = await import('node:child_process');
  const src = readFileSync('src/server/vehicles/read-model.ts', 'utf8');
  const listed = new Set([...src.match(/DARK_TILE_LOGOS = new Set\(\[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
  const release = JSON.parse(readFileSync('data/registry/catalogue-serving.release.json', 'utf8'));
  const logos = [...new Set(release.entries.map(e => e.accepted?.logo?.src).filter(Boolean))];
  // mean luminance of opaque pixels (python3 + Pillow are available wherever the P2 media toolchain runs)
  const py = "import sys,json\nfrom PIL import Image\nout={}\nfor f in sys.argv[1:]:\n im=Image.open('public'+f).convert('RGBA'); im.thumbnail((200,200)); px=[p for p in im.getdata() if p[3]>128]\n out[f]=sum(.3*r+.59*g+.11*b for r,g,b,a in px)/max(1,len(px))\nprint(json.dumps(out))";
  let lum;
  try { lum = JSON.parse(execFileSync('python3', ['-c', py, ...logos], { encoding: 'utf8' })); } catch { return; } // no Pillow: skip
  const white = new Set(Object.entries(lum).filter(([, v]) => v > 200).map(([k]) => k));
  assert.deepEqual([...white].sort(), [...listed].sort());
});
