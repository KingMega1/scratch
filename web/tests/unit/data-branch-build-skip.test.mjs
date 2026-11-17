import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* P5-Run 11 Nov 2026: data branches (no web/) skip Vercel builds through a ROOT vercel.json. It must never exist next to web/. */
test('data-branch template is exactly the verified ignoreCommand', () => {
  const t = JSON.parse(fs.readFileSync('../ops/vercel/data-branch.vercel.json', 'utf8'));
  assert.deepEqual(Object.keys(t).sort(), ['$schema', 'ignoreCommand']);
  assert.equal(t.ignoreCommand, 'exit 0');
});

test('a branch that has web/ must not carry a root vercel.json (it would skip every build)', () => {
  assert.ok(fs.existsSync('package.json'), 'tests run from web/');
  assert.equal(fs.existsSync('../vercel.json'), false);
});

test('web/vercel.json keeps its diff-based ignoreCommand', () => {
  assert.equal(JSON.parse(fs.readFileSync('vercel.json', 'utf8')).ignoreCommand, 'git diff --quiet HEAD^ HEAD -- .');
});
