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
