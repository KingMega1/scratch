import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('data/registry/brochure-serving.release.json','utf8'));
const serving=JSON.parse(readFileSync('data/registry/catalogue-serving.release.json','utf8'));
for(const locale of ['en','ar']){
 test(locale+' exact official brochure links and uncertainty notes',async({page,request})=>{
  for(const b of release.entries){
   const entry=serving.entries.find((e:{p1_id:string})=>e.p1_id===b.p1_id);
   const response=await request.get('/'+locale+'/cars/'+entry.site_slug);
   expect(response.status()).toBe(200);const html=await response.text();
   expect(html).toContain('data-brochure-model-id="'+b.p1_id+'"');expect(html).toContain(b.url);
  }
  await page.goto('/'+locale+'/cars/nissan-magnite');
  await expect(page.locator('#brochure-h')).toBeVisible();
  await expect(page.locator('[data-brochure-model-id="nissan/magnite"]')).toContainText(locale==='ar'?'التواريخ والفئات زي ما هي مذكورة':'Dates and trim coverage are as stated');
  await page.goto('/'+locale+'/cars/alfa-romeo-giulia');await expect(page.locator('#brochure-h')).toHaveCount(0);
 });
}
