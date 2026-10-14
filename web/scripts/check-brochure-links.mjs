#!/usr/bin/env node
// Report-only: is every P2-accepted brochure link reachable by a signed-out customer?
// Drive copies count as public only if they answer 200 without redirecting to a Google sign-in page.
// Output: ci-evidence/brochure-links.json (CI artifact). Promoting a Drive URL into data/registry/brochure-drive-public.json
// is a separate, reviewed commit.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const release = JSON.parse(readFileSync('data/registry/catalogue-serving.release.json', 'utf8'));
const links = release.entries.flatMap(e => (e.accepted?.brochures ?? []).map(b => ({ p1_id: e.p1_id, url: b.url })));
const out = [];
for (const l of links) {
  const r = { ...l, status: null, final_url: null, signin: false, content_type: null, error: null };
  try {
    const res = await fetch(l.url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 CarIndex-link-check' }, signal: AbortSignal.timeout(30000) });
    Object.assign(r, { status: res.status, final_url: res.url, content_type: res.headers.get('content-type') });
    r.signin = /accounts\.google\.com|ServiceLogin/.test(res.url);
    await res.body?.cancel();
  } catch (e) { r.error = String(e).slice(0, 200); }
  r.public = r.status === 200 && !r.signin;
  out.push(r);
}
mkdirSync('ci-evidence', { recursive: true });
writeFileSync('ci-evidence/brochure-links.json', JSON.stringify({ checked_at: new Date().toISOString(), total: out.length,
  public: out.filter(x => x.public).length, drive_public: out.filter(x => x.public && x.url.includes('drive.google.com')).map(x => x.url), links: out }, null, 1));
console.log(JSON.stringify({ total: out.length, public: out.filter(x => x.public).length, not_public: out.filter(x => !x.public).map(x => `${x.p1_id} ${x.status} ${x.signin ? 'signin' : ''} ${x.url}`) }, null, 1));
