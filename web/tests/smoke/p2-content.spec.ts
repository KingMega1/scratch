import { test, expect } from '@playwright/test';

/* P5 content completion: P2-accepted specs, warranty, gallery, brochures and logos on the live pages (EN/AR). */
for (const l of ['en', 'ar'] as const) {
  test(`${l}: specs with trim scope and sources, no internal codes`, async ({ page }) => {
    await page.goto(`/${l}/cars/mg-hs`);
    const t = page.locator('table.spec-t');
    await expect(t).toBeVisible();
    await expect(t.locator('tr[data-spec="torque_nm"]')).toHaveCount(2);
    await expect(t.locator('tr[data-spec="torque_nm"][data-variation="by-trim"]').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/\b[a-z]+_(mm|nm|hp|kw|l|kg|cc)\b|market trim pages|_eg_web/);
  });

  test(`${l}: warranty cards are typed and scoped`, async ({ page }) => {
    await page.goto(`/${l}/cars/byd-atto-8`);
    await expect(page.locator('[data-warranty-kind="vehicle"]')).toBeVisible();
    await expect(page.locator('[data-warranty-kind="battery"]')).toBeVisible();
    await expect(page.locator('#warranty-h')).toHaveText(l === 'ar' ? 'الضمان' : 'Warranty');
  });

  test(`${l}: gallery images keep their aspect ratio and lazy-load`, async ({ page }) => {
    await page.goto(`/${l}/cars/changan-cs35-plus`);
    const imgs = page.locator('img[data-gallery-image]');
    expect(await imgs.count()).toBeGreaterThan(2);
    for (const a of await imgs.evaluateAll(els => els.map(e => [e.getAttribute('loading'), e.getAttribute('width'), e.getAttribute('height')]))) {
      expect(a[0]).toBe('lazy'); expect(Number(a[1])).toBeGreaterThan(0); expect(Number(a[2])).toBeGreaterThan(0);
    }
    await expect(page.locator('.gallery-scroll')).toHaveAttribute('tabindex', '0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test(`${l}: official brochure links`, async ({ page }) => {
    await page.goto(`/${l}/cars/chery-tiggo-9`);
    const links = page.locator('[data-brochure-model-id] a.btn');
    expect(await links.count()).toBeGreaterThan(0);
    for (const h of await links.evaluateAll(els => els.map(e => e.getAttribute('href') || ''))) expect(h).not.toContain('drive.google.com');
  });
}
