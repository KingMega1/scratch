import { test as base } from '@playwright/test';
export * from '@playwright/test';

/* Self-hosted image optimiser workaround — local `next start` only (the CI smoke server); deployed runs (SMOKE_BASE_URL on
   Vercel) are untouched and keep exercising the real /_next/image service.
   Why: Next's self-hosted optimiser fetches the source image through the requesting client's response. If that client
   disconnects (a test navigates away mid-load) the request never settles, and the response cache makes every later request
   for the same image/width/format wait on it — until the server restarts. Pages showing such an image then never fire
   'load', and once 6 of them hang, Chromium queues everything else for the host (fonts, scripts). Reproduced on next 15.5.27
   and 15.5.28 (CI runs 41616848227, 41654157190). Smoke tests check markup and the image file each card references, not the
   optimiser's re-encoding, so the browser is served the referenced original from /media: identical HTML, no optimiser calls. */
const LOCAL = !process.env.SMOKE_BASE_URL || /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(process.env.SMOKE_BASE_URL);
export const test = base.extend({
  page: async ({ page }, use) => {
    if (LOCAL) {
      await page.route(/\/_next\/image\?/, async route => {
        const u = new URL(route.request().url()), src = u.searchParams.get('url');
        if (!src || !src.startsWith('/') || src.startsWith('//')) return route.continue();
        try { await route.fulfill({ response: await route.fetch({ url: u.origin + src }) }); }
        catch { /* page closed while an image was in flight (end of test): nothing left to serve */ }
      });
    }
    await use(page);
    if (LOCAL) await page.unrouteAll({ behavior: 'ignoreErrors' });
  },
});

/* GET without following redirects, past Vercel's preview-protection hop: with the bypass headers set, Vercel's first answer
   is its own 307 back to the SAME path (it sets the bypass cookie). Only that self-redirect is skipped (the request context
   now holds the cookie); the application's redirect is then returned unchanged, status and Location intact. */
export async function getNoFollow(request: import('@playwright/test').APIRequestContext, path: string) {
  let res = await request.get(path, { maxRedirects: 0 });
  for (let i = 0; i < 2 && [302, 307].includes(res.status()); i++) {
    const loc = res.headers()['location'] || '';
    const samePath = new URL(loc, 'http://x').pathname === new URL(path, 'http://x').pathname && !!res.headers()['set-cookie'];
    if (!samePath) break;
    res = await request.get(path, { maxRedirects: 0 });
  }
  return res;
}
