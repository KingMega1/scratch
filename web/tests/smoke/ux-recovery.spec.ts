import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/* AT-43 UX & visual recovery (2026-10-13) acceptance checks, EN/AR, desktop/mobile. */
const media = JSON.parse(readFileSync('data/registry/media-verified.json', 'utf8')) as { entries: { site_slug: string; src: string }[] };
const logos = JSON.parse(readFileSync('data/registry/brand-logos.json', 'utf8')) as { brands: Record<string, unknown> };
const release = JSON.parse(readFileSync('data/registry/catalogue-serving.release.json', 'utf8')) as { entries: { site_slug: string }[] };

for (const l of ['en', 'ar'] as const) {
  test(`${l}: homepage has no internal coverage statistics or methodology block`, async ({ page }) => {
    await page.goto(`/${l}`);
    const body = page.locator('main');
    for (const re of [/models on sale/i, /with official prices/i, /How we check a price/i, /Market now/i, /موديل معروض/, /بأسعار رسمية/, /إزاي بنتأكد من السعر/, /السوق دلوقتي/, /Search \d+ models/i, /دوّر في \d+ موديل/])
      await expect(body).not.toContainText(re);
    await expect(body).toContainText(l === 'ar' ? 'أسعار السيارات' : 'Car prices');
    await expect(page.locator('.hero .proof')).toHaveCount(0);
  });

  test(`${l}: fuel terminology uses the canonical labels`, async ({ page }) => {
    await page.goto(`/${l}/market/catalog`);
    const labels = await page.locator('[data-fuel]').allTextContents();
    const allowed = l === 'ar' ? ['بنزين', 'ديزل', 'هجين', 'هجين قابل للشحن', 'كهرباء بمدى ممتد', 'كهرباء'] : ['Petrol', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Range-extended electric', 'Electric'];
    expect(labels.length).toBeGreaterThan(2);
    for (const x of labels) expect(allowed).toContain(x.trim());
    for (const path of ['', '/cars', '/market', '/market/catalog', '/cars/kia-sportage', '/compare?ids=kia-sportage,hyundai-tucson'])
      expect(await (await page.request.get(`/${l}${path}`)).text(), path).not.toMatch(/موتور تقليدي|Combustion \(ICE\)/);
  });

  test(`${l}: brands A–Z with verified logos only`, async ({ page }) => {
    await page.goto(`/${l}/market`);
    const names = await page.locator('.brand-grid .brand-chip b').allTextContents();
    expect(names.length).toBeGreaterThan(50);
    const col = new Intl.Collator(l === 'ar' ? 'ar' : 'en', { sensitivity: 'base' });
    expect(names).toEqual([...names].sort((a, b) => col.compare(a, b)));
    const shown = await page.locator('.brand-grid [data-brand-logo]').evaluateAll(els => els.map(e => e.getAttribute('data-brand-logo')));
    expect(shown.length).toBe(Object.keys(logos.brands).length);
    for (const id of shown) expect(Object.keys(logos.brands)).toContain(id);
    await expect(page.locator('.brand-grid img')).toHaveCount(0); // no raster or third-party logo files
    const strip = await page.goto(`/${l}`).then(() => page.locator('.brand-strip b').allTextContents());
    expect(strip).toEqual([...strip].sort((a, b) => col.compare(a, b)));
  });

  test(`${l}: catalogue Brand → Model → Price → specs, all models, sorting and filters`, async ({ page }) => {
    await page.goto(`/${l}/market/catalog`);
    await expect(page.locator('a.mc[data-model-id]')).toHaveCount(release.entries.length);
    await expect(page.locator('table')).toHaveCount(0);
    const first = page.locator('.cat-brand').first();
    await expect(first.locator('h2')).toBeVisible();
    await expect(first.locator('.mc-price .mc-label').first()).toHaveText(l === 'ar' ? 'السعر' : 'Price');
    await expect(page.locator('main')).not.toContainText(l === 'ar' ? 'السعر السعر' : 'Price Price');
    // Brand V2: letter-and-number model codes stay Latin in Arabic
    if (l === 'ar') await expect(page.locator('a.mc[data-model-id="mg-hs"]')).toContainText('HS');
    // price sort: known prices ascending, unknown last (never guessed)
    await page.goto(`/${l}/market/catalog?sort=price_asc`);
    const states = await page.locator('a.mc').evaluateAll(els => els.map(e => e.getAttribute('data-price-state')));
    const firstUnknown = states.indexOf('unknown');
    expect(firstUnknown).toBeGreaterThan(0);
    expect(states.slice(firstUnknown).every(s => s === 'unknown')).toBe(true);
    // fuel filter narrows to matching cars
    await page.goto(`/${l}/market/catalog?fuel=ev`);
    const n = await page.locator('a.mc').count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(release.entries.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test(`${l}: images are verified exact-model files or the unavailable treatment`, async ({ page }) => {
    for (const path of ['', '/market', '/cars', '/market/catalog']) {
      await page.goto(`/${l}${path}`);
      const srcs = await page.locator('main img').evaluateAll(els => els.map(e => (e as HTMLImageElement).getAttribute('src') || ''));
      for (const s of srcs) expect(s, path).toMatch(/^\/(brand|media\/models)\//);
      await expect(page.locator('[data-asset-flags*="TEMP_UNVERIFIED"]')).toHaveCount(0);
    }
    for (const m of media.entries) {
      await page.goto(`/${l}/cars/${m.site_slug}`);
      await expect(page.locator(`.cd-media img[data-verified-photo][src="${m.src}"]`)).toBeVisible();
    }
    await page.goto(`/${l}/cars/kia-sportage`); // no verified photo: clean unavailable treatment, no substitute car
    await expect(page.locator('.cd-media [data-no-photo]')).toBeVisible();
    await expect(page.locator('.cd-media img.photo')).toHaveCount(0);
  });
}

test('Car Prices rename keeps URLs and the catalogue links', async ({ page, request }) => {
  for (const p of ['/en/market', '/ar/market', '/en/market/catalog?sort=regs', '/en/market/catalog?sort=price', '/en/cars?pt=ice', '/en/cars?body=sedan']) expect((await request.get(p)).status(), p).toBe(200);
  await page.goto('/ar/market');
  await expect(page.locator('h1')).toHaveText('أسعار السيارات');
  await page.goto('/en/market/catalog');
  await expect(page.locator('.breadcrumb a')).toHaveText('Car Prices');
});
