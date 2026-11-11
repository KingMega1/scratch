import { test } from 'node:test';
import assert from 'node:assert/strict';
// Node >= 22.18 strips TS types natively; deploy-env.ts has no imports.
const { deployEnv, siteUrl, showDrafts } = await import('../../src/lib/deploy-env.ts');

function withEnv(vars, fn) {
  const keys = ['CI_ENV', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'NEXT_PUBLIC_SITE_URL'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, vars);
  try { fn(); } finally { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}

test('Vercel production without CI_ENV is production (indexable, no drafts)', () => withEnv({ VERCEL_ENV: 'production' }, () => {
  assert.equal(deployEnv(), 'production');
  assert.equal(showDrafts(), false);
}));
test('explicit CI_ENV wins; preview shows drafts', () => withEnv({ CI_ENV: 'preview', VERCEL_ENV: 'production' }, () => {
  assert.equal(deployEnv(), 'preview');
  assert.equal(showDrafts(), true);
}));
test('no env => local', () => withEnv({}, () => assert.equal(deployEnv(), 'local')));
test('production canonical origin never falls back to the per-deployment URL', () => withEnv({ VERCEL_ENV: 'production', VERCEL_URL: 'x-123.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'carindex.example' }, () => {
  assert.equal(siteUrl(), 'https://carindex.example');
}));
test('NEXT_PUBLIC_SITE_URL wins and is normalised', () => withEnv({ NEXT_PUBLIC_SITE_URL: 'https://carindex.example/' }, () => assert.equal(siteUrl(), 'https://carindex.example')));
