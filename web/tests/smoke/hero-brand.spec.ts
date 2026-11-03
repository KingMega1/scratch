import { test, expect } from './fixtures';

for (const locale of ['ar', 'en']) {
  test(`Brand V2 safe homepage hero in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const hero = page.locator('section.hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('img.hero-img')).toHaveCount(0);
    await expect(hero.locator('[data-asset-flags]')).toHaveCount(0);
    await expect(hero.locator('h1')).toBeVisible();
    await expect(hero.locator('a[data-cta="hero_fmc"]')).toBeVisible();
    const size = page.viewportSize()!;
    await page.setViewportSize(size.width > 720 ? { width: 1280, height: 800 } : { width: 390, height: 844 });
    const box = await hero.locator('a[data-cta="hero_fmc"]').boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expect(page.locator('.gh-logo img')).toHaveAttribute('alt', 'CarIndexed');
    expect(await hero.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(11, 22, 32)');
  });
}
