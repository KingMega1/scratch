import { test, expect } from '@playwright/test';

for (const locale of ['ar', 'en']) {
  test(`Brand V2 safe homepage hero in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const hero = page.locator('section.hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('img.hero-img')).toHaveCount(0);
    await expect(hero.locator('[data-asset-flags]')).toHaveCount(0);
    await expect(hero.locator('h1')).toBeVisible();
    await expect(hero.locator('a[data-cta="hero_fmc"]')).toBeVisible();
    expect(await hero.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(11, 22, 32)');
  });
}
