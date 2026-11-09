import { test, expect, getNoFollow } from './fixtures';
import { readFileSync } from 'node:fs';

/* /spare-parts (CEO 9 Nov) and the GTM dataLayer contract. Parts data is a SAMPLE: no figures, no part numbers. */
const profiles = JSON.parse(readFileSync('data/registry/social-profiles.json', 'utf8')) as { candidates: { url: string; verified: boolean }[] };
const VERIFIED = profiles.candidates.filter(c => c.verified).map(c => c.url);
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; font-src 'self'; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com; frame-src https://www.googletagmanager.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

test.describe('spare parts', () => {
  test('/spare-parts defaults to Arabic RTL; /en/spare-parts is English LTR; both noindex while the data is a sample', async ({ page, request }) => {
    const r = await getNoFollow(request, '/spare-parts');
    expect(r.status()).toBe(307);
    expect(r.headers()['location']).toMatch(/\/ar\/spare-parts$/);
    for (const [l, dir, h1] of [['ar', 'rtl', 'القطعة الصح لعربيتك، قبل ما تدفع.'], ['en', 'ltr', 'The right part for your car, before you pay.']]) {
      await page.goto(`/${l}/spare-parts`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      await expect(page.locator('h1')).toHaveText(h1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.locator('[data-parts-data="SAMPLE_UNVERIFIED"]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/spare-parts');
  });
  test('nav matches the live site plus قطع الغيار; Beta badge kept; header row fits at 1024', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop nav');
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/ar/spare-parts');
      expect(await page.locator('.gh-nav a').allTextContents()).toEqual(['رشّحلي عربية', 'العربيات', 'قارن', 'أسعار السيارات', 'قطع الغيار']);
      await expect(page.locator('.gh-nav a[aria-current="page"]')).toHaveText('قطع الغيار');
      await expect(page.locator('header [data-beta-badge]')).toHaveText('تجريبي');
      expect(await page.evaluate(() => { const r = document.querySelector('.gh-row')!; return r.scrollWidth <= r.clientWidth + 1 && Math.round(r.getBoundingClientRect().height); })).toBe(64);
    }
  });
  test('10 categories incl. charging cables and home charging stations; a category filters the results', async ({ page }) => {
    await page.goto('/ar/spare-parts');
    await expect(page.locator('[data-part-category]')).toHaveCount(10);
    await expect(page.locator('[data-part-category="ev-cables"]')).toContainText('كابلات الشحن');
    await expect(page.locator('[data-part-category="home-chargers"]')).toContainText('محطات الشحن المنزلية');
    await page.locator('[data-part-category="ev-cables"]').click();
    await expect(page).toHaveURL(/cat=ev-cables/);
    await expect(page.locator('.part')).toHaveCount(1);
    await expect(page.locator('.part')).toContainText('كابل شحن');
  });
  test('finder: makes/models from the vehicle data; chosen model links to its real car page (AR/EN)', async ({ page, request }) => {
    for (const l of ['ar', 'en']) {
      await page.goto(`/${l}/spare-parts`);
      await expect(page.locator('#pf-model')).toBeDisabled();
      await page.locator('#pf-make').selectOption('hyundai');
      const models = await page.locator('#pf-model option').evaluateAll(os => os.map(o => (o as HTMLOptionElement).value).filter(Boolean));
      expect(models.length).toBeGreaterThan(0);
      expect(models.every(m => m.startsWith('hyundai-'))).toBe(true);
      await page.locator('#pf-model').selectOption('hyundai-tucson');
      await page.locator('#pf-year').selectOption('2027');
      await page.locator('[data-finder] button[type="submit"]').click();
      await expect(page).toHaveURL(/make=hyundai&model=hyundai-tucson&year=2027/);
      const link = page.locator('[data-model-link]');
      await expect(link).toHaveAttribute('href', `/${l}/cars/hyundai-tucson`);
      expect((await request.get(`/${l}/cars/hyundai-tucson`)).status()).toBe(200);
    }
    // values the data does not know are ignored (no link to a page that does not exist)
    await page.goto('/ar/spare-parts?make=hyundai&model=not-a-car&year=1999');
    await expect(page.locator('[data-model-link]')).toHaveCount(0);
    await page.goto('/ar/spare-parts?make=kia&model=hyundai-tucson');
    await expect(page.locator('[data-model-link]')).toHaveCount(0);
  });
  test('result cards: أصلي/بديل chips, no part numbers, no price figures; all four price states rendered', async ({ page }) => {
    for (const l of ['ar', 'en']) {
      await page.goto(`/${l}/spare-parts?make=hyundai&model=hyundai-tucson`);
      const kinds = await page.locator('.part .part-kind').allTextContents();
      expect(kinds).toEqual(expect.arrayContaining(l === 'ar' ? ['أصلي', 'بديل'] : ['Original', 'Aftermarket']));
      await expect(page.locator('[data-price-figure]')).toHaveCount(0);
      expect(await page.locator('[data-part-number]').evaluateAll(es => es.every(e => e.getAttribute('data-part-number') === ''))).toBe(true);
      expect(await page.locator('.part [data-price-state]').evaluateAll(es => [...new Set(es.map(e => e.getAttribute('data-price-state')))].sort())).toEqual(['conflict', 'unknown']);
      expect(await page.locator('[data-state-key]').evaluateAll(es => es.map(e => e.getAttribute('data-state-key')))).toEqual(['dealer', 'confirmed', 'unknown', 'conflict']);
      if (l === 'ar') for (const s of ['سعر الوكيل', 'آخر تأكيد', 'لسه مش متأكدين', 'المصادر مختلفة']) await expect(page.locator('.parts-states')).toContainText(s);
      // no number anywhere in the result cards except the model year chosen above
      expect(await page.locator('.parts-grid').innerText()).not.toMatch(/\d{3}/);
      await expect(page.locator('.parts')).not.toContainText(/cart|checkout|add to|سلة|اشتري/i);
    }
  });
  test('brand: tokens, fonts, 4px radius, 44px targets on the page', async ({ page }) => {
    await page.goto('/ar/spare-parts?make=hyundai&model=hyundai-tucson');
    const m = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.parts .part, .parts .parts-cat, .parts .pf, .parts .pp-state, .parts .part-kind, .parts select, .parts .btn, .parts .part-why, .parts .parts-states li')];
      const small = [...document.querySelectorAll('.parts a, .parts button, .parts select')].filter(e => (e as HTMLElement).offsetParent && e.getBoundingClientRect().height < 44);
      const cs = (s: string) => getComputedStyle(document.querySelector(s)!);
      return { radii: [...new Set(els.map(e => getComputedStyle(e).borderTopLeftRadius))], small: small.length, h1: cs('#parts-h').fontFamily, body: getComputedStyle(document.body).fontFamily,
        btnBg: cs('.pf .btn').backgroundColor, conflict: cs('.pp-conflict').borderTopColor, checked: cs('.pp-dealer').color };
    });
    expect(m.radii).toEqual(['4px']); expect(m.small).toBe(0);
    expect(m.h1).toContain('Noto Kufi Arabic'); expect(m.body).toContain('IBM Plex Sans Arabic');
    expect(m.btnBg).toBe('rgb(255, 209, 42)'); expect(m.conflict).toBe('rgb(198, 43, 30)'); expect(m.checked).toBe('rgb(31, 122, 77)');
    await page.goto('/en/spare-parts');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#parts-h')!).fontFamily)).toContain('Archivo');
  });
});

test.describe('site-wide SEO + headers', () => {
  test('Organization JSON-LD is valid; sameAs holds only verified profiles', async ({ page }) => {
    for (const p of ['/ar', '/en/spare-parts', '/ar/cars/hyundai-tucson']) {
      await page.goto(p);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      const org = blocks.map(b => JSON.parse(b)).find(j => j['@type'] === 'Organization');
      expect(org, p).toBeTruthy();
      expect(org['@context']).toBe('https://schema.org'); expect(org.name).toBe('CarIndexed');
      expect(org.url).toMatch(/^https?:\/\//); expect(org.logo).toMatch(/\/brand\/carindexed-app-icon\.svg$/);
      expect(org.sameAs ?? []).toEqual(VERIFIED);
    }
  });
  test('CSP and security headers unchanged', async ({ request }) => {
    const h = (await request.get('/ar/spare-parts')).headers();
    expect(h['content-security-policy']).toBe(CSP);
    expect(h['x-frame-options']).toBe('DENY'); expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

test.describe('GTM dataLayer contract (CEO 9 Nov)', () => {
  const layer = (page: import('@playwright/test').Page) => page.evaluate(() => (window.dataLayer || []) as Record<string, unknown>[]);
  test('page_context on load and on client-side navigation; no GTM container on non-production builds', async ({ page, isMobile }) => {
    await page.goto('/ar/spare-parts');
    await expect.poll(async () => (await layer(page)).filter(e => e.event === 'page_context')).toEqual([{ event: 'page_context', site_language: 'ar' }]);
    expect(await page.locator('script[src*="googletagmanager.com/gtm.js"]').count()).toBe(0); // preview/CI load nothing from Google
    if (!isMobile) {
      await page.locator('.gh-nav a', { hasText: 'قارن' }).click(); // Next.js client navigation (no reload)
      await expect(page).toHaveURL(/\/ar\/compare/);
      await expect.poll(async () => (await layer(page)).filter(e => e.event === 'page_context').length).toBe(2);
    }
    await page.goto('/en/cars');
    expect((await layer(page)).filter(e => e.event === 'page_context')).toEqual([{ event: 'page_context', site_language: 'en' }]);
  });
  test('car_view carries car_slug at the top level, once per car page', async ({ page }) => {
    await page.goto('/en/cars/hyundai-tucson');
    await expect.poll(async () => (await layer(page)).filter(e => e.event === 'car_view').map(e => e.car_slug)).toEqual(['hyundai-tucson']);
  });
  test('find_my_car_complete with budget band and result count when results render; no buyer text', async ({ page, request }) => {
    const j = await (await request.post('/api/v1/recommendation', { data: { op: 'execute', locale: 'en', brief: { budget: 2000000, budgetMode: 'around', body: ['suv'] } } })).json();
    const n = j.result.hero ? 1 + j.result.alternatives.length : 0;
    await page.goto(`/en/find-my-car?r=${j.result.share.r}`);
    await expect.poll(async () => (await layer(page)).filter(e => e.event === 'find_my_car_complete'), { timeout: 20_000 })
      .toEqual([{ event: 'find_my_car_complete', budget_band: 'EGP 1.5M – 2.5M', result_count: n }]);
  });
});
