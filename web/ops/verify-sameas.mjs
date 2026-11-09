// Fetch each social profile candidate and report status + identifying page metadata (evidence for Organization.sameAs).
// Verified = final HTTP 200 AND the page's title/og metadata names CarIndexed (@carindexed). Prints JSON lines.
const urls = process.argv.slice(2);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const pick = (html, re) => { const m = re.exec(html); return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) : null; };
for (const url of urls) {
  const out = { url, status: null, final_url: null, title: null, og_title: null, og_url: null, og_description: null, identifies_carindexed: false, verified: false, error: null };
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'en' }, signal: AbortSignal.timeout(20000) });
    out.status = res.status; out.final_url = res.url;
    const html = await res.text();
    out.title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    out.og_title = pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
    out.og_url = pick(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']*)["']/i);
    out.og_description = pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
    const meta = [out.title, out.og_title, out.og_url].filter(Boolean).join(' | ').toLowerCase();
    out.identifies_carindexed = /carindexed/.test(meta);
    out.verified = res.status === 200 && out.identifies_carindexed && !/login|log in|sign in/i.test(out.title || '');
  } catch (e) { out.error = String(e && e.message || e); }
  console.log(JSON.stringify(out));
}
