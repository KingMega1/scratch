import { test, expect } from './fixtures';
import { createHash } from 'node:crypto';

const assets = {
  '/brand/carindexed-logo-ink.svg': '034aa7ca41fc15aa5295eaba2902eeb709ae2a2fe906c6f969c046170172bce4',
  '/brand/carindexed-logo-white-yellow.svg': 'fd16445a07ce1e40cc394059628a88fc507a3769b39acb77090391b9faf088f3',
  '/brand/carindexed-favicon.svg': '945e77fea425736b86e1a73a0428ceb954993ff6ae7e2d4145061ac0d4b186d9',
  '/brand/carindexed-app-icon.svg': '471264adfd83d4cc90c3e3c06cb729bd86939c82bf1812223e6ae46cbc67f2ef',
};

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: V2.1 exact assets and branded customer journeys`, async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    for (const [src, sha] of Object.entries(assets)) {
      const response = await request.get(src);
      expect(response.status(), src).toBe(200);
      expect(createHash('sha256').update(await response.body()).digest('hex'), src).toBe(sha);
    }
    for (const route of ['', '/cars/kia-sportage', '/compare?ids=arcfox-t1,arcfox-alpha-t5', '/find-my-car']) {
      await page.goto(`/${locale}${route}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('.gh-logo img')).toHaveAttribute('src', '/brand/carindexed-logo-ink.svg');
      await expect(page.locator('.gh-logo img')).toHaveAttribute('alt', 'CarIndexed');
      await expect(page.locator('.gf-brand img')).toHaveAttribute('src', '/brand/carindexed-logo-white-yellow.svg');
      await expect(page.locator('footer')).toContainText(locale === 'ar' ? 'كار إندكسد' : 'CarIndexed');
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brand/carindexed-favicon.svg');
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/brand/carindexed-app-icon.svg');
      for (const img of await page.locator('.gh-logo img,.gf-brand img').all())
        expect(await img.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      if (process.env.SMOKE_SCREENSHOTS === '1') {
        const screen = route === '' ? 'home' : route.startsWith('/cars/') ? 'detail' : route.startsWith('/compare') ? 'compare' : 'find-my-car';
        // Exercise normal scrolling so browser-native lazy images are actually requested.
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(200, innerHeight * .8)) {
            window.scrollTo(0, y);
            await new Promise(resolve => setTimeout(resolve, 180));
          }
        });
        for (const img of await page.locator('img').all()) {
          await img.scrollIntoViewIfNeeded();
          await expect(img).toHaveJSProperty('complete', true);
          expect(await img.evaluate(el => (el as HTMLImageElement).naturalWidth), 'image must load after normal scrolling').toBeGreaterThan(0);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `test-results/screens/brand-v21/${locale}-${testInfo.project.name}-${screen}.png`, fullPage: true });
      }
    }
  });
}
