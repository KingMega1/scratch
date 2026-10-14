#!/usr/bin/env node
// Import a P2 catalogue serving release into the website, verbatim except for the media path namespace.
//   node scripts/import-p2-release.mjs <p2-root> <p2-commit>
// <p2-root> is a checkout/export of the P2 branch containing vehicle-data/views/catalogue-serving.release.json and
// vehicle-data/media/. P2 serves media at /media/{models,brands}/...; the website keeps P2 files under /media/p2/ so they
// never collide with the P5 media registry (/media/models/*). Only files referenced by the release are copied, byte-identical.
// Writes data/registry/catalogue-serving.release.json and data/registry/p2-import.manifest.json. Never edits vehicle truth.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

const [root, commit] = process.argv.slice(2);
if (!root || !/^[0-9a-f]{40}$/.test(commit ?? '')) throw Error('usage: import-p2-release.mjs <p2-root> <40-hex p2 commit>');
const sha = b => createHash('sha256').update(b).digest('hex');
const raw = readFileSync(join(root, 'vehicle-data/views/catalogue-serving.release.json'), 'utf8');
const text = raw.replace(/"\/media\/(models|brands)\//g, '"/media/p2/$1/');
const release = JSON.parse(text);

const files = new Set();
for (const e of release.entries) {
  const a = e.accepted ?? {};
  for (const x of [a.hero_image, a.logo, ...(a.gallery ?? [])]) if (x?.src) files.add(x.src);
}
const copied = [];
for (const src of [...files].sort()) {
  if (!/^\/media\/p2\/(models|brands)\/[\w./-]+\.(webp|png|svg|jpe?g)$/i.test(src) || src.includes('..')) throw Error('unsafe media path: ' + src);
  const from = join(root, 'vehicle-data', src.replace('/media/p2/', '/media/'));
  if (!existsSync(from)) throw Error('release references a file P2 did not deliver: ' + src);
  const to = join('public', src);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  const b = readFileSync(to);
  if (sha(b) !== sha(readFileSync(from))) throw Error('copy mismatch: ' + src);
  copied.push({ src, bytes: b.length, sha256: sha(b) });
}
writeFileSync('data/registry/catalogue-serving.release.json', text);
const manifest = { p2_branch: 'claude/carindex-buyer-vehicle-data-97yinp', p2_commit: commit, release_id: release.release_id,
  release_sha256_as_served: sha(text), release_sha256_p2: sha(raw), path_rewrite: '/media/{models,brands}/ -> /media/p2/{models,brands}/',
  media_files: copied.length, media_bytes: copied.reduce((s, f) => s + f.bytes, 0), files: copied };
writeFileSync('data/registry/p2-import.manifest.json', JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({ release: release.release_id, counts: release.counts, media_files: copied.length, media_mb: +(manifest.media_bytes / 1e6).toFixed(1) }));
