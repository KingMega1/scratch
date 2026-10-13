import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('data/registry/catalogue-serving.release.json','utf8'));
for(const locale of ['en','ar']){
 test(locale+' complete catalogue and all 283 detail pages',async({page,request})=>{
  test.setTimeout(240000);
  await page.goto('/'+locale+'/market/catalog');
  // progressive disclosure: entry shows brands (no model dump); brand counts cover every on-sale model
  await expect(page.locator('a.mc[data-model-id]')).toHaveCount(0);
  const counts = await page.locator('.brand-grid .brand-chip').evaluateAll(els => els.map(e => Number(e.getAttribute('data-count'))));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(283);
  for(let i=0;i<release.entries.length;i+=8){
   await Promise.all(release.entries.slice(i,i+8).map(async(e:{site_slug:string})=>{
    const response=await request.get('/'+locale+'/cars/'+e.site_slug);
    expect(response.status(),e.site_slug).toBe(200);
    const html=await response.text();
    expect(html,e.site_slug).toContain('data-model-id="'+e.site_slug+'"');
    expect(html,e.site_slug).toContain('<h1');
   }));
  }
  for(const e of release.excluded)expect((await request.get('/'+locale+'/cars/'+e.site_slug)).status()).toBe(404);
  await page.goto('/'+locale+'/cars/alfa-romeo-giulia');
  await expect(page.locator('.cd-info .price-na, .cd-info .state-unknown').first()).toBeVisible();
  await expect(page.locator('.cd-info .bracket')).toHaveCount(0);
  await expect(page.locator('#specs-h').locator('..')).toContainText(locale==='ar'?'المواصفات لم يتم التحقق منها بعد.':'Specifications have not been verified yet.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
 });
 test(locale+' brand filters and unknown-price exclusion',async({page})=>{
  await page.goto('/'+locale+'/cars?brand=nissan');
  await expect(page.locator('a.cc')).toHaveCount(7);
  await page.goto('/'+locale+'/cars?min=1&max=50000000');
  await expect(page.locator('a.cc .state-unknown')).toHaveCount(0);
  await page.goto('/'+locale+'/cars?page=12');
  await expect(page.locator('a.cc')).toHaveCount(19);
 });
}
