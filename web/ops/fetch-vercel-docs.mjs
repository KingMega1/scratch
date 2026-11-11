// Evidence fetch (P0 11 Nov 2026): print the sentences of Vercel's plan/limits docs that answer the incident questions.
// Read-only; run on a GitHub-hosted runner (the agent sandbox cannot reach vercel.com).
const pages = process.argv.slice(2);
const KEYS = /paus|resume|unpause|upgrad|\$\s?\d|per month|\/mo|per seat|per member|included|fast origin transfer|fast data transfer|function invocation|active cpu|isr (read|write)|edge request|image (optimi|transform)|spend management|hard limit|commercial|30.day|billing cycle|exceed/i;
for (const url of pages) {
  let text = '';
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0', 'accept-language': 'en' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const html = await res.text();
    console.log(`\n===== ${url} -> ${res.status} ${res.url} (${html.length} bytes)`);
    text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<\/(p|li|h\d|tr|td|th|div)>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ');
  } catch (e) { console.log(`\n===== ${url} -> ERROR ${e.message}`); continue; }
  const seen = new Set();
  for (const line of text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 600)) {
    if (KEYS.test(line) && !seen.has(line)) { seen.add(line); console.log('  · ' + line); }
  }
}
