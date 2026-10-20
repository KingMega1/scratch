import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
const ARABIC=JSON.parse((await import('node:fs')).readFileSync('data/registry/arabic-names.p2.json','utf8'));
import {buildCatalogue,loadInputs} from '../../scripts/build-catalogue-release.mjs';
const [snap,u,cw]=loadInputs(), release=JSON.parse(readFileSync('data/registry/catalogue-serving.release.json','utf8'));
// The served release is P2's RC2 (canonical; P5 never regenerates it). Its website identity layer must stay identical
// to the pinned P5 projection: same 283 IDs, routes, names, Arabic names, body, powertrains and exclusions.
const IDKEYS=['p1_id','site_slug','brand','model','ar','on_sale','body','powertrains','registration','p2_evidence','evidence_state'];
const pick=e=>Object.fromEntries(IDKEYS.map(k=>[k,e[k]]));
test('RC2 keeps the pinned website identities; all 283 exact on-sale U11 IDs with unique routes',()=>{
 const built=buildCatalogue(snap,u,cw);
 assert.deepEqual(release.entries.map(pick),built.entries.map(pick));
 assert.deepEqual(release.excluded,built.excluded);
 assert.equal(release.entries.length,283);
 assert.equal(new Set(release.entries.map(e=>e.p1_id)).size,283);
 assert.equal(new Set(release.entries.map(e=>e.site_slug)).size,283);
 assert.deepEqual(new Set(release.entries.map(e=>e.p1_id)),new Set(u.models.filter(m=>m.u===true).map(m=>m.id)));
});
test('21 P2 S6 evidence rows, 262 identity rows, 3 off-sale exclusions; accepted fields only where P2 accepted them',()=>{
 for(const k of ['catalogue','p2_evidence','identity_only','excluded'])assert.equal(release.counts[k],{catalogue:283,p2_evidence:21,identity_only:262,excluded:3}[k]);
 for(const e of release.entries){
   const p=e.accepted?.price;
   if(p){assert.ok(p.price_from>0);assert.ok(['A','B'].includes(p.tier));assert.ok(!e.missing_evidence.includes('NO_ACCEPTED_PRICE'));}
   else assert.ok(e.p2_evidence||e.missing_evidence.includes('NO_ACCEPTED_PRICE'),e.site_slug);
 }
 for(const e of release.excluded)assert.equal(u.models.find(m=>m.id===e.p1_id).u,false);
});
test('identity mismatch, slug collision and denominator drift fail closed',()=>{
 const broken=structuredClone(cw);broken.map['kia-sportage'].matched_old_id='nissan/sunny';
 assert.throws(()=>buildCatalogue(snap,u,broken),/unverified identity/);
 const duplicate=structuredClone(u);duplicate.models.push(duplicate.models[0]);
 assert.throws(()=>buildCatalogue(snap,duplicate,cw),/duplicate U11 identity/);
 const drift=structuredClone(u);drift.meta.models_in_universe++;
 assert.throws(()=>buildCatalogue(snap,drift,cw),/denominator drift/);
});
function runtime(path, dependencies){
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(id=>{
   if(id==='server-only')return {};
   if(id in dependencies)return dependencies[id];
   throw Error('Unexpected runtime import '+id);
 },module,module.exports);
 return module.exports;
}
const V=runtime('src/server/vehicles/read-model.ts',{
 '@data/registry/universe.snapshot.json':snap,'@data/registry/display-crosswalk.TEMP.json':cw,
 '@data/registry/catalogue-serving.release.json':release,'@data/registry/arabic-names.p2.json':ARABIC,'@data/registry/media-verified.json':JSON.parse(readFileSync('data/registry/media-verified.json','utf8')),
});
const Q=runtime('src/server/vehicles/query.ts',{'./read-model':V});
const ADD=release.market_additions??[], TOTAL=283+ADD.length;
test('actual website read-model: 283 U11 + P2 additions gettable, 283 recommendation bridges, 3 absent',()=>{
 assert.equal(V.vehicles().all().length,TOTAL);
 for(const a of ADD){ // P2 additions/splits: browsable with accepted fields only, no U11 data, no P1 id
  const car=V.vehicles().get(a.site_slug);assert.ok(car,a.site_slug);assert.equal(car.p1Id??null,null);assert.equal(car.evidenceState,a.universe);
  assert.equal(V.p1DisplaySlug(a.identity),a.site_slug);
  if(a.accepted?.price){assert.equal(car.priceFrom.value,a.accepted.price.price_from);assert.equal(car.priceFrom.state,'checked');}
  else{assert.equal(car.priceFrom.value,null);assert.equal(car.priceFrom.state,'unknown');}
  assert.deepEqual(car.specs,{});assert.equal(car.registrations,null);
  assert.equal(car.image?.src??null,a.accepted?.hero_image?.src??null);
 }
 for(const e of release.entries){
  assert.equal(V.p1DisplaySlug(e.p1_id),e.site_slug);
  const car=V.vehicles().get(e.site_slug);assert.ok(car);assert.equal(car.p1Id,e.p1_id);
  const ap=e.accepted?.price;
  if(ap){ // P2-accepted price is served exactly, as the official figure, with every named source and date
   assert.equal(car.priceFrom.state,'checked');assert.equal(car.priceFrom.value,ap.price_from);assert.equal(car.priceFrom.sortValue,ap.price_from);
   const served=[...car.trims,...car.otherCohorts.flatMap(c=>c.trims)].map(t=>t.official.value).sort((a,b)=>a-b);
   assert.deepEqual(served,ap.trims.map(t=>t.price_egp).sort((a,b)=>a-b));
   for(const t of car.trims)assert.ok(t.official.sources.length>=1&&t.official.sources.every(x=>x.name&&x.observedAt));
   // model-level accepted price (no per-version rows): shown as one model row with its source, never as 'not confirmed'
   if(!ap.trims.length){assert.equal(car.modelPrice.value,ap.price_from);assert.ok(car.modelPrice.sources.length>=1);}else assert.equal(car.modelPrice,null);
  } else if(!e.p2_evidence){assert.equal(car.priceFrom.value,null);assert.equal(car.priceFrom.sortValue,null);
   assert.equal(car.priceFrom.state,'unknown');assert.deepEqual(car.trims,[]);}
  if(!e.p2_evidence)assert.deepEqual(car.specs,{});
  // images: P2-accepted hero, else the P5 verified media registry, else none; never copied or inferred from U11
  const vm=JSON.parse(readFileSync('data/registry/media-verified.json','utf8')).entries.find(x=>x.site_slug===car.id);
  assert.equal(car.image?.src??null, e.accepted?.hero_image?.src ?? (vm?vm.src:null));
 }
 // U11 off-sale exclusions stay out unless P2 re-adds the identity as a market addition (P2 owns the catalogue; P1 eligibility unchanged)
 for(const e of release.excluded){const re=ADD.find(a=>a.identity===e.p1_id);
  if(re){assert.equal(V.vehicles().get(re.site_slug).evidenceState,re.universe);continue;}
  assert.equal(V.vehicles().get(e.site_slug),null);assert.equal(V.p1DisplaySlug(e.p1_id),null);}
 assert.equal(V.vehicles().get('invented-model'),null);
});
test('actual filters/pagination do not lose models or make unknown prices numeric',()=>{
 const PAGES=Math.ceil(TOTAL/24);
 assert.equal(Q.queryCars({}).total,TOTAL);assert.equal(Q.queryCars({}).pages,PAGES);
 const ids=new Set();for(let page=1;page<=PAGES;page++)for(const c of Q.queryCars({page}).items)ids.add(c.id);
 assert.equal(ids.size,TOTAL);
 for(const q of [{min:1},{max:50000000},{official:true}])for(let page=1;page<=PAGES;page++)
 for(const c of Q.queryCars({...q,page}).items)assert.notEqual(c.priceFrom.sortValue,null);
 assert.equal(Q.queryCars({brand:'nissan'}).total,[...release.entries,...ADD].filter(e=>e.brand==='Nissan').length);
 assert.ok(Q.queryCars({pt:'phev'}).items.every(c=>c.powertrains.includes('phev')));
});
test('P2 media contract: accepted same-origin hero images are served automatically; others ignored',()=>{
 const rel2=structuredClone(release);
 rel2.entries.find(e=>e.site_slug==='kia-sportage').accepted={hero_image:{src:'/media/models/kia-sportage.webp',credit:'Kia Egypt',source_url:'https://example.test/kia'}};
 rel2.entries.find(e=>e.site_slug==='hyundai-tucson').accepted={hero_image:{src:'https://cdn.example.test/tucson.jpg'}};
 const noHero=rel2.entries.find(e=>!e.accepted?.hero_image&&!JSON.parse(readFileSync('data/registry/media-verified.json','utf8')).entries.some(m=>m.site_slug===e.site_slug));
 noHero.hero_image={src:'/media/../secret.webp'};
 const V2=runtime('src/server/vehicles/read-model.ts',{
  '@data/registry/universe.snapshot.json':snap,'@data/registry/display-crosswalk.TEMP.json':cw,
  '@data/registry/catalogue-serving.release.json':rel2,'@data/registry/arabic-names.p2.json':ARABIC,'@data/registry/media-verified.json':{entries:[]},
 });
 assert.deepEqual(V2.vehicles().get('kia-sportage').image,{src:'/media/models/kia-sportage.webp',credit:'Kia Egypt',sourcePage:'https://example.test/kia',flags:[]});
 assert.equal(V2.vehicles().get('hyundai-tucson').image,null);
 assert.equal(V2.vehicles().get(noHero.site_slug).image,null);
});
test('Tucson: P2-accepted official list price supersedes the old U11 listing conflict; the conflict path still never averages',()=>{
 const old=snap.view.models.find(m=>m.slug==='hyundai-tucson'), e=release.entries.find(x=>x.site_slug==='hyundai-tucson');
 assert.equal(old.price.price_from.status,'CONFLICT'); // P1/U11 snapshot untouched
 const car=V.vehicles().get('hyundai-tucson'), ap=e.accepted?.price;
 if(ap){ // canonical evidence: served exactly as accepted, never a blend of the conflicting listing values
  assert.equal(car.priceFrom.state,'checked');assert.equal(car.priceFrom.value,ap.price_from);
  assert.deepEqual(car.trims.map(t=>t.official.value).sort((a,b)=>a-b),ap.trims.filter(t=>t.model_year===car.priceFrom.modelYear||car.priceFrom.modelYear==null).map(t=>t.price_egp).sort((a,b)=>a-b));
  for(const t of car.trims)assert.ok(t.official.sources.every(s=>!/drive\.google\.com/.test(s.url??'')));
 }
 // without an accepted price the U11 conflict is shown as a conflict with no figure
 const rel3=structuredClone(release);delete rel3.entries.find(x=>x.site_slug==='hyundai-tucson').accepted.price;
 const V3=runtime('src/server/vehicles/read-model.ts',{'@data/registry/universe.snapshot.json':snap,'@data/registry/display-crosswalk.TEMP.json':cw,
  '@data/registry/catalogue-serving.release.json':rel3,'@data/registry/arabic-names.p2.json':ARABIC,'@data/registry/media-verified.json':JSON.parse(readFileSync('data/registry/media-verified.json','utf8'))});
 const c3=V3.vehicles().get('hyundai-tucson');assert.equal(c3.priceFrom.state,'conflict');assert.equal(c3.priceFrom.value,null);
});
test('P2 specs, warranty, gallery and brochures are served as accepted, with scope and source; nothing invented',()=>{
 let specs=0,warr=0,gal=0,bro=0,driveHidden=0;
 for(const e of release.entries){
  const a=e.accepted??{}, car=V.vehicles().get(e.site_slug), c=car.p2;
  for(const s of c?.specs??[]){specs++;assert.deepEqual(new Set(s.facts.map(f=>f.value)),new Set(a.specs[s.key].map(x=>{const t=String(x.value).trim();return /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)?t.replace(/,/g,''):t;}))); // identical values from several sources are merged, never dropped
   for(const f of s.facts){assert.ok(f.issuer,e.site_slug);assert.ok(!/U11|conflict/i.test(f.unit));}}
  const wv=(a.warranty??[]).flatMap(w=>String(w.value).split(';').map(x=>x.trim()).filter(Boolean)).length+(a.specs?.warranty_battery??[]).length;
  assert.equal(c?.warranty.length??0,wv,e.site_slug); warr+=wv;
  assert.deepEqual((c?.gallery??[]).map(g=>g.src),(a.gallery??[]).map(g=>g.src)); gal+=(a.gallery??[]).length;
  for(const g of a.gallery??[])assert.ok(existsSync('public'+g.src),g.src);
  const pub=(a.brochures??[]).filter(b=>!/drive\.google\.com/.test(b.url)); driveHidden+=(a.brochures??[]).length-pub.length;
  assert.deepEqual((c?.brochures??[]).map(b=>b.url),pub.map(b=>b.url)); bro+=pub.length;
 }
 assert.ok(specs>0&&warr>0&&gal>0&&bro>0); console.log({specs,warr,gal,bro,driveHidden});
});
test('P2 Arabic model names fill blanks only and reach the read-model (entries and additions)',()=>{
 let filled=0;
 for(const [pid,ar] of Object.entries(ARABIC.names)){
  const e=release.entries.find(x=>x.p1_id===pid), a=ADD.find(x=>x.identity===pid);
  assert.ok(e||a,pid);
  const car=V.vehicles().get((e??a).site_slug);
  if(e?.ar?.model)assert.equal(car.model.ar,e.ar.model); // approved name never overwritten
  else{assert.equal(car.model.ar,ar);filled++;}
 }
 for(const e of release.entries)if(e.ar?.model)assert.equal(V.vehicles().get(e.site_slug).model.ar,e.ar.model);
 assert.ok(filled>0);
});
test('M13 spec remap and quarantine: brochure facts only on the model the brochure is for; no private links',()=>{
 const src=(slug)=>V.vehicles().get(slug).p2?.specs.flatMap(s=>s.facts)??[];
 const raw=(slug)=>Object.values(release.entries.concat(ADD).find(e=>e.site_slug===slug).accepted?.specs??{}).flat();
 // "Geely Brochure_EX5-EMI.pdf" (Drive 1h0bZIM…) belongs to EX5 EM-i; "Venue Brochure RTP.pdf" (Drive 10hQJ6…) never on Tucson
 assert.ok(raw('geely-ex5').every(f=>!String(f.source).includes('1h0bZIM')));
 assert.ok(raw('hyundai-tucson').every(f=>!String(f.source).includes('10hQJ6')));
 for(const c of V.vehicles().all())for(const f of c.p2?.specs.flatMap(s=>s.facts)??[])assert.ok(!/drive\.google\.com/.test(f.sourceUrl??''),c.id);
 assert.ok(src('geely-ex5-em-i').length>0);
});
test('customer-visible source names carry no internal provenance notes; the named issuer is kept',()=>{
 const bad=/CEO|supplied|official issuer|as listed|_eg_web/i, seen=new Set();
 for(const c of V.vehicles().all()){
  const names=[...[...c.trims,...c.otherCohorts.flatMap(o=>o.trims)].flatMap(t=>t.official.sources.map(s=>s.name)),...(c.modelPrice?.sources??[]).map(s=>s.name),
   ...(c.p2?.specs??[]).flatMap(s=>s.facts.map(f=>f.issuer)),...(c.p2?.warranty??[]).map(w=>w.fact.issuer),c.image?.credit,...(c.p2?.gallery??[]).map(g=>g.credit)].filter(Boolean);
  for(const n of names){assert.ok(!bad.test(n),`${c.id}: ${n}`);seen.add(n);}
 }
 assert.equal(V.customerSource('CEO explicit price adjustment to GB Auto Haval list'),'GB Auto Haval list');
 assert.equal(V.customerSource('Mercedes-Benz Egypt; CEO-supplied official list (CEO-supplied list)'),'Mercedes-Benz Egypt');
 assert.equal(V.customerSource('GB Auto official distributor list (CEO-supplied)'),'GB Auto official distributor list');
 assert.ok(seen.has('GB Auto official distributor list'));
});
