import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/* AT-43 UX & visual recovery (2026-10-13) acceptance checks, EN/AR, desktop/mobile. */
const media = JSON.parse(readFileSync('data/registry/media-verified.json', 'utf8')) as { entries: { site_slug: string; src: string }[] };
const logos = JSON.parse(readFileSync('data/registry/brand-logos.json', 'utf8')) as { brands: Record<string, unknown> };
const release = JSON.parse(readFileSync('data/registry/catalogue-serving.release.json', 'utf8')) as { entries: { site_slug: string; brand: string; accepted?: { hero_image?: { src: string }; logo?: { src: string } } }[] };
const bid = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Served images: P2-accepted hero (serving release) first, else the P5 verified media registry.
const served = new Map<string, string>(media.entries.map(m => [m.site_slug, m.src]));
for (const e of release.entries) if (e.accepted?.hero_image?.src) served.set(e.site_slug, e.accepted.hero_image.src);
const darkTile = new Set([...(readFileSync('src/server/vehicles/read-model.ts', 'utf8').match(/DARK_TILE_LOGOS = new Set\(\[([^\]]*)\]/)![1].matchAll(/'([^']+)'/g))].map(m => m[1]));
const p2Logo = new Map<string, string>(); for (const e of release.entries) if (e.accepted?.logo?.src && !p2Logo.has(bid(e.brand))) p2Logo.set(bid(e.brand), e.accepted.logo.src);
const siteBrands = new Set(release.entries.map(e => bid(e.brand)));
const logoIds = [...siteBrands].filter(id => (logos.brands as Record<string, unknown>)[id] || p2Logo.has(id));

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
    await page.goto(`/${l}/market/catalog?fuel=petrol`);
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
    expect(shown.length).toBe(logoIds.length); // ink emblem (simple-icons) or the P2-accepted official logo; never guessed
    for (const id of shown) expect(logoIds).toContain(id);
    for (const src of await page.locator('.brand-grid img').evaluateAll(els => els.map(e => e.getAttribute('src') || ''))) expect(src).toMatch(/^\/media\/p2\/brands\/[\w-]+\.png$/);
    // white-only official marks (e.g. BYD) are served unchanged on an ink tile
    for (const [src, tile] of await page.locator('.brand-grid img').evaluateAll(els => els.map(e => [e.getAttribute('src') || '', e.getAttribute('data-logo-tile')])))
      expect(tile, src).toBe(darkTile.has(src) ? 'dark' : 'light');
    expect(darkTile.has('/media/p2/brands/byd.png')).toBe(true);
    const strip = await page.goto(`/${l}`).then(() => page.locator('.brand-strip b').allTextContents());
    expect(strip).toEqual([...strip].sort((a, b) => col.compare(a, b)));
  });

  test(`${l}: catalogue brand logos -> models -> details, search, filters, paging`, async ({ page }) => {
    await page.goto(`/${l}/market/catalog`);
    await expect(page.locator('[data-catalog-mode="brands"]')).toBeVisible();
    await expect(page.locator('a.mc')).toHaveCount(0); // no dump of every model
    await expect(page.locator('table')).toHaveCount(0);
    // brand -> its models -> detail
    await page.locator('.brand-chip[data-brand-id="nissan"]').click();
    await expect(page).toHaveURL(/brand=nissan/);
    const n = Number(await page.locator('[data-result-count]').getAttribute('data-result-count'));
    await expect(page.locator('a.mc')).toHaveCount(n);
    await expect(page.locator('.mc-price .mc-label').first()).toHaveText(l === 'ar' ? 'السعر' : 'Price');
    await expect(page.locator('main')).not.toContainText(l === 'ar' ? 'السعر السعر' : 'Price Price');
    await page.locator('a.mc[data-model-id="nissan-qashqai"]').click();
    await expect(page).toHaveURL(new RegExp(`/${l}/cars/nissan-qashqai$`));
    // search (Arabic letter variants normalised)
    await page.goto(`/${l}/market/catalog?q=${encodeURIComponent(l === 'ar' ? 'كيا' : 'kia')}`);
    const ids = await page.locator('a.mc').evaluateAll(els => els.map(e => e.getAttribute('data-model-id')));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^kia-/);
    // Brand V2: letter-and-number model codes stay Latin in Arabic
    if (l === 'ar') { await page.goto('/ar/market/catalog?brand=mg'); await expect(page.locator('a.mc[data-model-id="mg-hs"]')).toContainText('HS'); }
    // filtered results are paged (never all at once); price sort keeps unknown prices last
    await page.goto(`/${l}/market/catalog?body=suv&sort=price_asc`);
    await expect(page.locator('a.mc')).toHaveCount(24);
    await expect(page.locator('.pager')).toBeVisible();
    const states = await page.locator('a.mc').evaluateAll(els => els.map(e => e.getAttribute('data-price-state')));
    const firstUnknown = states.indexOf('unknown');
    if (firstUnknown >= 0) expect(states.slice(firstUnknown).every(s => s === 'unknown')).toBe(true);
    await page.goto(`/${l}/market/catalog?fuel=ev`);
    expect(await page.locator('a.mc').count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test(`${l}: images are verified exact-model files or the unavailable treatment`, async ({ page }) => {
    for (const path of ['', '/market', '/cars', '/market/catalog']) {
      await page.goto(`/${l}${path}`);
      const srcs = await page.locator('main img').evaluateAll(els => els.map(e => (e as HTMLImageElement).getAttribute('src') || ''));
      for (const s of srcs) expect(s, path).toMatch(/^\/(brand|media\/models|media\/p2\/(models|brands))\//);
      await expect(page.locator('[data-asset-flags*="TEMP_UNVERIFIED"]')).toHaveCount(0);
    }
    for (const [slug, src] of [...served].slice(0, 12)) {
      await page.goto(`/${l}/cars/${slug}`);
      await expect(page.locator(`.cd-media img[data-verified-photo][src="${src}"]`)).toBeVisible();
    }
    const noPhoto = release.entries.find(e => !served.has(e.site_slug))!.site_slug;
    await page.goto(`/${l}/cars/${noPhoto}`); // no verified photo: clean unavailable treatment, no substitute car
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

/* Additional CEO feedback (13 Oct): navigation, first fold, fat footer, invitation at the final step. */
for (const l of ['en', 'ar'] as const) {
  test(`${l}: no account dashboard in customer navigation; route kept`, async ({ page, request, isMobile }) => {
    await page.goto(`/${l}`);
    if (isMobile) await page.locator('.gh-menu-btn').click();
    await expect(page.locator('header a[href$="/my-carindex"]')).toHaveCount(0);
    expect((await request.get(`/${l}/my-carindex`)).status()).toBe(200);
    expect((await request.get('/admin')).status()).toBe(404); // internal, auth-only (404 when unconfigured)
  });
  test(`${l}: first fold has a clear Find My Car CTA and verified photos only`, async ({ page }) => {
    await page.goto(`/${l}`);
    const fold = page.locator('section.hero');
    await expect(fold.locator('a[data-cta="hero_fmc"]')).toBeVisible();
    const imgs = fold.locator('img');
    expect(await imgs.count()).toBeGreaterThan(0);
    for (const src of await imgs.evaluateAll(els => els.map(e => e.getAttribute('src')))) expect([...served.values()]).toContain(src);
    await expect(page.locator('#paths-h')).toHaveCount(0); // duplicate "Two ways to start" box removed
  });
  test(`${l}: fat footer with the Brand V2 logo on ink`, async ({ page }) => {
    await page.goto(`/${l}`);
    const f = page.locator('footer.gf');
    await expect(f.locator('img[src="/brand/carindex-logo-white-yellow.svg"]')).toHaveCount(1);
    expect(await f.locator('.gf-cols > div').count()).toBeGreaterThanOrEqual(5);
    for (const p of ['/find-my-car', '/market', '/compare', '/methodology', '/privacy', '/news?type=news']) await expect(f.locator(`a[href="/${l}${p}"]`)).toHaveCount(1);
    await expect(f.locator('a[href*="/market/catalog?brand="]').first()).toBeVisible();
  });
  test(`${l}: invitation sits at the final recommendation step with its tracking`, async ({ page, request }) => {
    const j = await (await request.post('/api/v1/recommendation', { data: { op: 'execute', locale: l, brief: { budget: 2000000, budgetMode: 'around', body: ['suv'] } } })).json();
    await page.goto(`/${l}/find-my-car?r=${j.result.share.r}`);
    const inv = page.locator('[data-fmc-invite]');
    await expect(inv).toBeVisible({ timeout: 20_000 });
    await expect(inv.locator('input#phone')).toBeAttached();
    const ev = await page.evaluate(() => ((window as unknown as { dataLayer?: { event: string }[] }).dataLayer || []).map(e => e.event));
    expect(ev).toContain('identity_gate_view');
    // it is the last block of the result
    const last = await page.locator('.fmc-result > *:not(.fmc-sheet):not(.fmc-toast)').last().getAttribute('data-fmc-invite');
    expect(last).toBe('true');
  });
}

/* P2 RC2 accepted prices reach customer pages exactly, with their named sources (one Tier A, one Tier B). */
type AP = { price_from: number; tier: string; issuer: string };
const priced = (release.entries as unknown as { site_slug: string; brand: string; accepted?: { price?: AP } }[]).filter(e => e.accepted?.price);
for (const tier of ['A', 'B']) {
  test(`en: accepted Tier ${tier} price is served exactly with its sources`, async ({ page }) => {
    const e = priced.find(x => x.accepted!.price!.tier === tier)!;
    const p = e.accepted!.price!;
    await page.goto(`/en/cars/${e.site_slug}`);
    await expect(page.locator('.cd-info')).toContainText(p.price_from.toLocaleString('en-US'));
    await expect(page.locator('.cd-info .price-na')).toHaveCount(0);
    if (tier === 'B') for (const s of p.issuer.split('+')) await expect(page.locator('main')).toContainText(s);
    await page.goto(`/en/market/catalog?brand=${bid(e.brand)}`);
    await expect(page.locator(`a.mc[data-model-id="${e.site_slug}"]`)).toHaveAttribute('data-price-state', 'checked');
  });
}
