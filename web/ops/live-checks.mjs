// Read-only post-release checks for carindexed.com (P0 11 Nov 2026). ~15 single GETs; prints evidence, exits 1 on a failed check.
const B = 'https://carindexed.com';
let fail = 0;
const ok = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if (!pass) fail++; };
const get = (u, o = {}) => fetch(u, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 CarIndexed-live-check' }, signal: AbortSignal.timeout(20000), ...o });

// HTTPS: plain HTTP must redirect to HTTPS
{ const r = await get('http://carindexed.com/en'); ok('http->https', [301, 308].includes(r.status) && (r.headers.get('location') || '').startsWith('https://'), `${r.status} -> ${r.headers.get('location')}`); }
// AR / EN pages, security headers
for (const l of ['ar', 'en']) {
  const r = await get(`${B}/${l}`); const h = await r.text();
  ok(`/${l} 200`, r.status === 200, `${r.status} ${h.length} bytes x-vercel-cache=${r.headers.get('x-vercel-cache')}`);
  ok(`/${l} lang/dir`, h.includes(`<html lang="${l}"`) && h.includes(l === 'ar' ? 'dir="rtl"' : 'dir="ltr"'), '');
  ok(`/${l} canonical`, new RegExp(`<link rel="canonical" href="https://carindexed.com/${l}"`).test(h), (h.match(/<link rel="canonical"[^>]*>/) || ['none'])[0]);
  ok(`/${l} not noindex`, !/<meta name="robots" content="[^"]*noindex/.test(h), '');
  ok(`/${l} no inline 46KB css`, !/<style[^>]*>[\s\S]{20000,}?<\/style>/.test(h), '');
  for (const k of ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options']) {
    const v = r.headers.get(k); ok(`/${l} header ${k}`, !!v, (v || 'missing').slice(0, 90));
  }
}
// Indexing
{ const r = await get(`${B}/robots.txt`); const t = await r.text(); ok('robots 200', r.status === 200, t.replace(/\n/g, ' | ')); ok('robots Disallow /*?', /Disallow: \/\*\?/.test(t), ''); ok('robots sitemap', /Sitemap: https:\/\/carindexed\.com\/sitemap\.xml/.test(t), ''); }
{ const r = await get(`${B}/sitemap.xml`); const t = await r.text(); const n = (t.match(/<loc>/g) || []).length; ok('sitemap 200', r.status === 200 && n > 100, `${r.status} ${n} <loc>`); }
// Image freshness / caching: an optimised image and a static media file
{ const r = await get(`${B}/en`); const h = await r.text(); const m = h.match(/\/_next\/image\?url=([^"&]+)&amp;w=(\d+)&amp;q=(\d+)/);
  if (m) { const u = `${B}/_next/image?url=${m[1]}&w=${m[2]}&q=${m[3]}`; const i = await get(u, { headers: { accept: 'image/avif,image/webp,*/*' } });
    ok('optimised image 200', i.status === 200, `${i.status} ${i.headers.get('content-type')} cache-control=${i.headers.get('cache-control')} age=${i.headers.get('age')} x-vercel-cache=${i.headers.get('x-vercel-cache')}`);
    const src = decodeURIComponent(m[1]); const s = await get(B + src); ok('source media 200', s.status === 200, `${src} ${s.status} cache-control=${s.headers.get('cache-control')} last-modified=${s.headers.get('last-modified')}`);
  } else ok('optimised image found', false, 'no /_next/image on /en'); }
// Health binding
{ const r = await get(`${B}/api/health`); const j = await r.json(); ok('health', r.status === 200 && j.env === 'production' && j.recommendation?.integrity === true, JSON.stringify({ env: j.env, release: j.recommendation?.release, status: j.recommendation?.status })); }
console.log(`\n${fail ? fail + ' FAILED' : 'ALL PASS'}`); process.exit(fail ? 1 : 0);
