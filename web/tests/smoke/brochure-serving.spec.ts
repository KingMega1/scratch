import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
/* Official brochures: P2-accepted public links (catalogue serving release accepted.brochures) with issuer and scope;
   working-archive Drive links are never shown; the legacy Nissan brochure release applies only where P2 lists none. */
const legacy=JSON.parse(readFileSync('data/registry/brochure-serving.release.json','utf8'));
const serving=JSON.parse(readFileSync('data/registry/catalogue-serving.release.json','utf8'));
type B={url:string;issuer:string};type E={p1_id:string;site_slug:string;accepted?:{brochures?:B[]}};
const pub=(e:E)=>(e.accepted?.brochures??[]).filter(b=>!/drive\.google\.com/.test(b.url));
for(const locale of ['en','ar']){
 test(locale+' official brochure links, issuer and scope; no private archive links',async({page,request})=>{
  const withB=(serving.entries as E[]).filter(e=>pub(e).length);
  expect(withB.length).toBeGreaterThan(20);
  for(const e of withB.slice(0,25)){
   const html=await (await request.get('/'+locale+'/cars/'+e.site_slug)).text();
   for(const b of pub(e))expect(html,e.site_slug).toContain('data-brochure-url="'+b.url.replace(/&/g,'&amp;')+'"');
   expect(html,e.site_slug).not.toContain('drive.google.com');
  }
  for(const b of legacy.entries){
   const e=(serving.entries as E[]).find(x=>x.p1_id===b.p1_id)!;
   if(pub(e).length)continue;
   const html=await (await request.get('/'+locale+'/cars/'+e.site_slug)).text();
   expect(html).toContain('data-brochure-model-id="'+b.p1_id+'"');expect(html).toContain(b.url);
  }
  const first=withB[0];
  await page.goto('/'+locale+'/cars/'+first.site_slug);
  await expect(page.locator('#brochure-h')).toBeVisible();
  await expect(page.locator('[data-p2-brochures]')).toContainText(pub(first)[0].issuer);
  const none=(serving.entries as E[]).find(e=>!pub(e).length&&!legacy.entries.some((b:{p1_id:string})=>b.p1_id===e.p1_id))!;
  await page.goto('/'+locale+'/cars/'+none.site_slug);await expect(page.locator('#brochure-h')).toHaveCount(0);
 });
}
