import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SHOTS = process.env.SMOKE_SCREENSHOTS === '1';
async function shot(page: Page, name: string, testInfo: { project: { name: string } }) {
  if (SHOTS) await page.screenshot({ path: `test-results/screens/${testInfo.project.name}-${name}.png`, fullPage: false });
}

test.describe('locale + direction', () => {
  test('root redirects to Arabic', async ({ page }) => {
    const res = await page.goto('/');
    expect(page.url()).toMatch(/\/ar$/);
    expect(res?.status()).toBe(200);
  });
  for (const [l, dir] of [['ar', 'rtl'], ['en', 'ltr']] as const) {
    test(`/${l} server-renders lang=${l} dir=${dir}`, async ({ request }) => {
      const html = await (await request.get(`/${l}`)).text();
      expect(html).toContain(`<html lang="${l}" dir="${dir}"`); // in the first byte of HTML: no LTR->RTL flash
      expect(html).toMatch(/<link rel="alternate" hrefLang="en"|hreflang="en"/i);
      expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*/${l}"`));
    });
  }
  test('language switch keeps the entity', async ({ page }) => {
    await page.goto('/ar/cars/kia-sportage');
    await page.locator('a.lang').click();
    await expect(page).toHaveURL(/\/en\/cars\/kia-sportage$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});

test.describe('pages', () => {
  const PAGES: [string, RegExp][] = [
    ['/ar', /قبل ما تشتري/], ['/en', /Before making a car decision/i], ['/en/cars', /Browse/i], ['/ar/cars', /تصفّح/],
    ['/en/market', /Market/], ['/ar/market', /السوق/], ['/en/cars/kia-sportage', /Kia Sportage/], ['/ar/cars/kia-sportage', /كيا/],
    ['/en/compare?ids=kia-sportage,hyundai-tucson', /Compare/], ['/en/search?q=sportage', /Kia Sportage/],
    ['/en/my-carindex', /My CarIndex/], ['/en/news', /News/], ['/en/find-my-car', /Find My Car/], ['/en/methodology', /Methodology/],
    ['/en/market/catalog', /Full catalog/i],
  ];
  for (const [path, re] of PAGES) {
    test(`renders ${path}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(String(e)));
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('body')).toContainText(re);
      expect(errors).toEqual([]);
      await shot(page, path.replace(/[/?=,&]+/g, '_'), info);
    });
  }
});

test.describe('navigation + brand', () => {
  test('primary nav and footer links', async ({ page, isMobile }) => {
    await page.goto('/en');
    if (isMobile) {
      await page.locator('.gh-menu-btn').click();
      await expect(page.locator('#gh-drawer')).toBeVisible();
    }
    const scope = isMobile ? page.locator('#gh-drawer nav') : page.locator('.gh-nav');
    for (const label of ['Find My Car', 'Cars', 'Compare', 'Market', 'News & Guides']) await expect(scope.getByRole('link', { name: label, exact: true })).toBeVisible();
    for (const label of ['Methodology', 'Independence', 'About', 'Contact', 'Privacy', 'Terms']) await expect(page.locator('footer').getByRole('link', { name: label, exact: true })).toBeAttached();
    await expect(page.locator('a[href*="dashboard" i], a[href*="invit" i]')).toHaveCount(0);
  });
  test('logo goes home', async ({ page }) => {
    await page.goto('/en/market');
    await page.locator('.gh-logo').click();
    await expect(page).toHaveURL(/\/en$/);
  });
  test('Brand V2 fonts load (self-hosted, no Google Fonts)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url()); });
    await page.goto('/ar');
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')));
    expect(loaded).toEqual(expect.arrayContaining(['Noto Kufi Arabic', 'IBM Plex Sans Arabic']));
    expect(external).toEqual([]);
    await page.goto('/en');
    await page.evaluate(() => document.fonts.ready);
    const en = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')));
    expect(en).toEqual(expect.arrayContaining(['Archivo', 'IBM Plex Sans']));
    const tokens = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ci-color-yellow').trim());
    expect(tokens.toUpperCase()).toBe('#FFD12A');
  });
  test('no horizontal overflow', async ({ page }) => {
    for (const p of ['ar','en'].flatMap(l => ['', '/cars', '/cars/kia-sportage', '/compare?ids=kia-sportage,hyundai-tucson', '/market', '/market/catalog', '/search?q=sportage', '/my-carindex', '/news'].map(p => `/${l}${p}`))) {
      await page.goto(p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, p).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('boundaries', () => {
  test('admin is not public', async ({ request }) => {
    expect((await request.get('/admin')).status()).toBe(404);
  });
  test('Find My Car is bound to the P1 release (no 503 gate)', async ({ page, request }) => {
    await page.goto('/en/find-my-car');
    const shell = page.locator('[data-fmc-status="ready"]');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute('data-release', 'P1-RELEASE-T1');
    await expect(shell).toHaveAttribute('data-engine-version', 'E6-2026-09-28');
    await expect(shell).toHaveAttribute('data-transport-version', 'T1-2026-10-07');
    await expect(shell).toHaveAttribute('data-universe-version', 'U11-2026-09-26');
    const r = await request.post('/api/v1/recommendation', { data: { op: 'execute', locale: 'en', brief: { budget: 2000000, budgetMode: 'around', body: ['suv'] } } });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.result.schema).toBe('ci.reco.v1');
    expect(j.result.engine_version).toBe('E6-2026-09-28');
    expect(j.result.result_id).toMatch(/^cr1_[0-9a-f]{32}$/);
  });
  test('recommendation API validates input', async ({ request }) => {
    expect((await request.post('/api/v1/recommendation', { data: { entry: 'x' } })).status()).toBe(400);
    expect((await request.post('/api/v1/recommendation', { data: { op: 'shared', locale: 'en', r: '!!' } })).status()).toBe(400);
  });
  test('compare shows no winner marks', async ({ page }) => {
    await page.goto('/en/compare?ids=kia-sportage,hyundai-tucson');
    await expect(page.locator('.win, [data-winner]')).toHaveCount(0);
  });
  test('conflicting price is shown as a conflict, never averaged or bracketed', async ({ page }) => {
    await page.goto('/en/cars/hyundai-tucson');
    await expect(page.locator('.cd-info .state-conflict')).toBeVisible();
    await expect(page.locator('tr[data-official-state="conflict"] .bracket')).toHaveCount(0);
  });
  test('car detail Take is a data-bound slot', async ({ page }) => {
    await page.goto('/en/cars/hyundai-tucson');
    await expect(page.locator('[data-slot="carindex-take"]')).toHaveAttribute('data-bound', 'false');
  });
  test('security headers', async ({ request }) => {
    const h = (await request.get('/en')).headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
  });
  test('health exposes versions, not secrets', async ({ request }) => {
    const j = await (await request.get('/api/health')).json();
    expect(j.registry.registry_version).toBeTruthy();
    expect(j.registry.source.repo).toBe('KingMega1/scratch');
    expect(j.registry.source.path).toBe('vehicle-data/views/p1_suv_2m.json');
    expect(j.registry.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(j.registry.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(j.registry.snapshot_id).toContain(j.registry.registry_version);
    expect(j.registry.synced_at).toBeTruthy();
    expect(j.recommendation.status).toBe('ready');
    expect(j.recommendation.integrity).toBe(true);
    expect(j.recommendation.release).toBe('P1-RELEASE-T1');
    expect(j.recommendation.transport_commit).toBe('49b73a5379735d59ba74c65425f48b02ddf18ca7');
    expect(j.recommendation.universe_version).toBe('U11-2026-09-26');
    expect(j.recommendation.p3_artifact).toBe('1791369522-eecc');
    expect(JSON.stringify(j)).not.toMatch(/key|secret|password|token/i);
  });
});

/* Independent audit (P5-AUDIT-01) regression guards. */
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
test.describe('accessibility (axe, WCAG 2.1 A/AA)', () => {
  for (const path of ['ar','en'].flatMap(l => ['', '/cars', '/cars/kia-sportage', '/compare?ids=kia-sportage,hyundai-tucson', '/market', '/market/catalog', '/search?q=sportage', '/find-my-car', '/my-carindex', '/news', '/news/official-vs-listing-prices', '/methodology'].map(p => `/${l}${p}`))) {
    test(`no WCAG A/AA violations: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await (window as unknown as { axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe
        .run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map(x => `${x.id}: ${x.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`));
      expect(v, path).toEqual([]);
    });
  }
});

test.describe('seo', () => {
  test('hreflang is absolute and reciprocal; canonical is self', async ({ request }) => {
    for (const [l, other] of [['ar', 'en'], ['en', 'ar']]) {
      const html = await (await request.get(`/${l}/cars/kia-sportage`)).text();
      expect(html).toMatch(new RegExp(`<link rel="canonical" href="https?://[^"]+/${l}/cars/kia-sportage"`));
      expect(html).toMatch(new RegExp(`<link rel="alternate" hrefLang="${other}" href="https?://[^"]+/${other}/cars/kia-sportage"`));
      expect(html).toMatch(/<link rel="alternate" hrefLang="x-default" href="https?:\/\/[^"]+\/ar\/cars\/kia-sportage"/);
    }
  });
  test('sitemap lists both locales and no noindex pages', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toMatch(/<loc>[^<]+\/ar\/cars\/kia-sportage<\/loc>/);
    expect(xml).toMatch(/<loc>[^<]+\/en\/cars\/kia-sportage<\/loc>/);
    expect(xml).not.toMatch(/<loc>[^<]+\/(find-my-car|search|my-carindex|privacy|terms)<\/loc>/);
  });
  test('Find My Car is noindex', async ({ request }) => {
    expect(await (await request.get('/en/find-my-car')).text()).toMatch(/<meta name="robots" content="noindex/);
  });
});

test.describe('api boundaries', () => {
  test('events collector rejects unknown events and accepts a valid EV3 envelope', async ({ request }) => {
    const base = { schema: 'EV3', event_id: 'e1', ts: new Date().toISOString(), session_id: 's', anon_id: 'a', source_app: 'web', universe_version: null, engine_version: null, locale: 'en', route: 'home', journey_stage: 'awareness' };
    expect((await request.post('/api/v1/events', { data: { ...base, event: 'not_an_event', props: {} } })).status()).toBe(400);
    expect((await request.post('/api/v1/events', { data: { ...base, event: 'page_view', props: { route: '/en', 'user 01012345678': 'x', nested: { email: 'a@b.co' } } } })).status()).toBe(202);
  });
  test('car API rejects malformed ids', async ({ request }) => {
    expect((await request.get('/api/v1/cars/..%2f..%2fetc/passwd')).status()).toBeGreaterThanOrEqual(400);
    expect((await request.get('/api/v1/cars/KIA-Sportage')).status()).toBe(400);
  });
  test('admin is 404 on every path variant when unconfigured', async ({ request }) => {
    for (const p of ['/admin', '/admin/', '/ar/../admin', '/admin.json']) expect((await request.get(p)).status(), p).toBe(404);
  });
});

test.describe('Arabic compare search', () => {
  for (const join of ['و','ولا']) test(`compare action for Arabic ${join}`,async({request})=>{
    const j=await(await request.get(`/api/v1/search?q=${encodeURIComponent(`كيا سبورتاج ${join} هيونداي توسان`)}&locale=ar`)).json();
    expect(JSON.stringify(j)).toContain('/ar/compare?ids=');
  });
});

test.describe('production-only boundaries (local build, no deploy)',()=>{
  test.skip(process.env.SMOKE_PRODUCTION !== '1');
  test('drafts cannot leak through home, news, article, search or car detail',async({request})=>{
    for(const l of ['ar','en']) {
      for(const p of [`/${l}`,`/${l}/news`,`/${l}/cars/kia-sportage`,`/${l}/search?q=official`]) {
        const html=await(await request.get(p)).text();expect(html).not.toContain('official-vs-listing-prices');
      }
      expect((await request.get(`/${l}/news/official-vs-listing-prices`)).status()).toBe(404);
    }
  });
  test('production browser has no QA browsing buffer; env query cannot enable it',async({page})=>{
    await page.goto('/en?env=qa');await page.waitForTimeout(100);
    expect(await page.evaluate(()=>localStorage.getItem('ci_events'))).toBeNull();
    await expect(page.locator('html')).toHaveAttribute('data-env','prod');
  });
  test('production indexes launch pages but keeps FMC and account noindex',async({request})=>{
    const html=await(await request.get('/en')).text();expect(html).not.toMatch(/<meta name="robots" content="noindex/);
    for(const p of ['/ar/find-my-car','/en/my-carindex']) expect(await(await request.get(p)).text()).toMatch(/<meta name="robots" content="noindex/);
  });
});

/* Find My Car journeys over the P1 transport (P1-RELEASE-T1). Copy assertions use P1 engine-owned strings verbatim. */
const FMC = {
  en: { text: 'Family SUV around EGP 2 million, hybrid preferred', summary: 'Here’s what we understood', confirm: 'Yes, show my cars', based: 'Based on your brief' },
  ar: { text: 'عايز عربية عالية في حدود 2.2 مليون.', summary: 'ده اللي فهمناه', confirm: 'أيوه، وريني العربيات', based: 'على أساس طلبك' },
} as const;
async function answerUntilSummary(page: Page) {
  for (let i = 0; i < 12; i++) {
    const view = await page.locator('.fmc').getAttribute('data-fmc-view');
    if (view === 'summary') return;
    const q = page.locator('.fmc-question');
    await expect(q).toBeVisible();
    const step = await q.locator('.label-mono').first().textContent();
    const skip = q.locator('.fmc-actions .link-btn');
    if (await skip.count()) await skip.click();
    else if (await q.locator('.budget-card').count()) await q.locator('.fmc-actions .btn-primary').click();
    else await q.locator('.opt').first().click();
    // advance when the view leaves the question screen or the step label changes
    await expect.poll(async () => {
      const v = await page.locator('.fmc').getAttribute('data-fmc-view');
      if (v !== 'q') return 'moved';
      return (await page.locator('.fmc-question .label-mono').first().textContent()) !== step ? 'moved' : 'same';
    }, { timeout: 20_000 }).toBe('moved');
  }
}
test.describe('find my car (P1 transport)', () => {
  test.setTimeout(90_000);
  for (const l of ['en', 'ar'] as const) {
    test(`${l}: free text -> questions -> summary -> result, engine copy intact`, async ({ page }, testInfo) => {
      const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
      await page.goto(`/${l}/find-my-car`);
      await page.locator('#fmc-brief').fill(FMC[l].text);
      await page.locator('[data-fmc="go"]').click();
      await answerUntilSummary(page);
      await expect(page.locator('#fmc-s-h')).toHaveText(FMC[l].summary);
      await shot(page, `fmc-${l}-summary`, testInfo);
      await page.locator('[data-fmc="confirm"]').click();
      const res = page.locator('.fmc-result');
      await expect(res).toBeVisible({ timeout: 20_000 });
      await expect(res).toHaveAttribute('data-engine-version', 'E6-2026-09-28');
      await expect(res).toHaveAttribute('data-universe-version', 'U11-2026-09-26');
      await expect(page.locator('#fmc-r-h')).toHaveText(FMC[l].based);
      await expect(page.locator('.fmc')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
      expect(page.url()).toMatch(/\?r=[A-Za-z0-9_-]+$/);
      expect(decodeURIComponent(page.url())).not.toContain(FMC[l].text);
      const ids = await page.locator('[data-model-id]').evaluateAll(els => els.map(e => e.getAttribute('data-model-id')));
      expect(ids.length).toBeGreaterThan(0);
      await shot(page, `fmc-${l}-result`, testInfo);
      const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(w).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    });
    test(`${l}: shared result link reproduces the result; guided path starts with a question`, async ({ page, request }) => {
      const j = await (await request.post('/api/v1/recommendation', { data: { op: 'execute', locale: l, brief: { budget: 1500000, budgetMode: 'around', body: ['suv'], seats: 7 } } })).json();
      await page.goto(`/${l}/find-my-car?r=${j.result.share.r}`);
      await expect(page.locator('.fmc-result')).toHaveAttribute('data-result-id', j.result.result_id, { timeout: 20_000 });
      await page.goto(`/${l}/find-my-car`);
      await page.locator('[data-fmc="guided"]').click();
      await expect(page.locator('.fmc-question')).toBeVisible();
    });
  }
  test('outside the 24-model site projection: card kept from ci.reco.v1, site link withheld', async ({ page, request }) => {
    const brief = { budget: 1200000, budgetMode: 'around', body: ['sedan'] };
    const j = await (await request.post('/api/v1/recommendation', { data: { op: 'execute', locale: 'en', brief } })).json();
    const outside = Object.entries(j.website as Record<string, string | null>).filter(([, v]) => v === null).map(([k]) => k);
    expect(outside.length).toBeGreaterThan(0);
    await page.goto(`/en/find-my-car?r=${j.result.share.r}`);
    await expect(page.locator('.fmc-result')).toBeVisible({ timeout: 20_000 });
    for (const id of outside.filter(id => [j.result.hero?.id, ...j.result.alternatives.map((a: { id: string }) => a.id)].includes(id))) {
      await expect(page.locator(`[data-fmc-not-on-site="${id}"]`).first()).toBeVisible();
      await expect(page.locator(`[data-fmc-site-link="${id}"]`)).toHaveCount(0);
    }
    const shown = await page.locator('.fmc-result [data-model-id]').evaluateAll(els => els.map(e => e.getAttribute('data-model-id')));
    expect(shown).toEqual([j.result.hero.id, ...j.result.alternatives.map((a: { id: string }) => a.id)]);
  });
  test('result view has no WCAG A/AA violations', async ({ page, request }) => {
    const j = await (await request.post('/api/v1/recommendation', { data: { op: 'execute', locale: 'ar', brief: { budget: 2000000, budgetMode: 'around', body: ['suv'] } } })).json();
    await page.goto(`/ar/find-my-car?r=${j.result.share.r}`);
    await expect(page.locator('.fmc-result')).toBeVisible({ timeout: 20_000 });
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await (window as unknown as { axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe
      .run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map(x => `${x.id}: ${x.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`));
    expect(v).toEqual([]);
  });
});

/* Full buyer journey (AT-43 recovery): Homepage -> Find My Car -> brief -> recommendation -> WHY -> alternatives
   -> Car Detail -> share link; EV3 analytics events carry ids/keys only, never the buyer's words. */
test.describe('buyer journey end to end', () => {
  test.setTimeout(90_000);
  for (const l of ['en', 'ar'] as const) {
    test(`${l}: homepage -> FMC -> result -> car detail, analytics clean`, async ({ page, request }) => {
      await page.goto(`/${l}`);
      await page.locator('a[data-cta="hero_fmc"]').click();
      await expect(page).toHaveURL(new RegExp(`/${l}/find-my-car`));
      await page.locator('#fmc-brief').fill(FMC[l].text);
      await page.locator('[data-fmc="go"]').click();
      await answerUntilSummary(page);
      await page.locator('[data-fmc="confirm"]').click();
      const res = page.locator('.fmc-result');
      await expect(res).toBeVisible({ timeout: 20_000 });
      await expect(res.locator('.fmc-detail h3, .fmc-card').first()).toBeVisible(); // WHY block or equal cards
      const ev = await page.evaluate(() => (window as unknown as { dataLayer: { event: string; props: Record<string, unknown>; result_id: string | null; engine_version: string | null }[] }).dataLayer);
      const names = ev.map(e => e.event);
      for (const n of ['fmc_view', 'fmc_start', 'fmc_q_answer', 'fmc_summary_confirm', 'fmc_result_view']) expect(names, n).toContain(n);
      const rv = ev.find(e => e.event === 'fmc_result_view')!;
      expect(rv.result_id).toMatch(/^cr1_/); expect(rv.engine_version).toBe('E6-2026-09-28');
      expect(JSON.stringify(ev)).not.toContain(FMC[l].text);
      expect(JSON.stringify(ev)).not.toMatch(/"(text|free_text|notes|q)"\s*:/);
      // Car Detail hop from a result that includes a car with a page on the site
      let token = '', target = '';
      for (const brief of [{ budget: 2000000, budgetMode: 'around', body: ['suv'], chinese: 'exclude' }, { budget: 2500000, budgetMode: 'max', body: ['suv'] }, { budget: 1800000, budgetMode: 'around', body: ['suv'], priorities: ['popular'] }]) {
        const j = await (await request.post('/api/v1/recommendation', { data: { op: 'execute', locale: l, brief } })).json();
        const hit = Object.entries(j.website as Record<string, string | null>).find(([, v]) => v);
        if (hit) { token = j.result.share.r; target = hit[1] as string; break; }
      }
      expect(target, 'a result with an on-site car').not.toBe('');
      await page.goto(`/${l}/find-my-car?r=${token}`);
      await expect(page.locator('.fmc-result')).toBeVisible({ timeout: 20_000 });
      await page.locator(`a[href="/${l}/cars/${target}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`/${l}/cars/${target}$`));
      await expect(page.locator('h1')).toBeVisible();
    });
  }
});
