import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
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
 '@data/registry/catalogue-serving.release.json':release,'@data/registry/media-verified.json':JSON.parse(readFileSync('data/registry/media-verified.json','utf8')),
});
const Q=runtime('src/server/vehicles/query.ts',{'./read-model':V});
test('actual website read-model: all 283 gettable, 283 recommendation bridges, 3 absent',()=>{
 assert.equal(V.vehicles().all().length,283);
 for(const e of release.entries){
  assert.equal(V.p1DisplaySlug(e.p1_id),e.site_slug);
  const car=V.vehicles().get(e.site_slug);assert.ok(car);assert.equal(car.p1Id,e.p1_id);
  const ap=e.accepted?.price;
  if(ap){ // P2-accepted price is served exactly, as the official figure, with every named source and date
   assert.equal(car.priceFrom.state,'checked');assert.equal(car.priceFrom.value,ap.price_from);assert.equal(car.priceFrom.sortValue,ap.price_from);
   const served=[...car.trims,...car.otherCohorts.flatMap(c=>c.trims)].map(t=>t.official.value).sort((a,b)=>a-b);
   assert.deepEqual(served,ap.trims.map(t=>t.price_egp).sort((a,b)=>a-b));
   for(const t of car.trims)assert.ok(t.official.sources.length>=1&&t.official.sources.every(x=>x.name&&x.observedAt));
  } else if(!e.p2_evidence){assert.equal(car.priceFrom.value,null);assert.equal(car.priceFrom.sortValue,null);
   assert.equal(car.priceFrom.state,'unknown');assert.deepEqual(car.trims,[]);}
  if(!e.p2_evidence)assert.deepEqual(car.specs,{});
  // images: P2-accepted hero, else the P5 verified media registry, else none; never copied or inferred from U11
  const vm=JSON.parse(readFileSync('data/registry/media-verified.json','utf8')).entries.find(x=>x.site_slug===car.id);
  assert.equal(car.image?.src??null, e.accepted?.hero_image?.src ?? (vm?vm.src:null));
 }
 for(const e of release.excluded){assert.equal(V.vehicles().get(e.site_slug),null);assert.equal(V.p1DisplaySlug(e.p1_id),null);}
 assert.equal(V.vehicles().get('invented-model'),null);
});
test('actual filters/pagination do not lose models or make unknown prices numeric',()=>{
 assert.equal(Q.queryCars({}).total,283);assert.equal(Q.queryCars({}).pages,12);
 const ids=new Set();for(let page=1;page<=12;page++)for(const c of Q.queryCars({page}).items)ids.add(c.id);
 assert.equal(ids.size,283);
 for(const q of [{min:1},{max:50000000},{official:true}])for(let page=1;page<=12;page++)
 for(const c of Q.queryCars({...q,page}).items)assert.notEqual(c.priceFrom.sortValue,null);
 assert.equal(Q.queryCars({brand:'nissan'}).total,7);
 assert.ok(Q.queryCars({pt:'phev'}).items.every(c=>c.powertrains.includes('phev')));
});
test('P2 media contract: accepted same-origin hero images are served automatically; others ignored',()=>{
 const rel2=structuredClone(release);
 rel2.entries.find(e=>e.site_slug==='kia-sportage').accepted={hero_image:{src:'/media/models/kia-sportage.webp',credit:'Kia Egypt',source_url:'https://example.test/kia'}};
 rel2.entries.find(e=>e.site_slug==='hyundai-tucson').accepted={hero_image:{src:'https://cdn.example.test/tucson.jpg'}};
 rel2.entries.find(e=>e.site_slug==='mg-hs').hero_image={src:'/media/../secret.webp'};
 const V2=runtime('src/server/vehicles/read-model.ts',{
  '@data/registry/universe.snapshot.json':snap,'@data/registry/display-crosswalk.TEMP.json':cw,
  '@data/registry/catalogue-serving.release.json':rel2,'@data/registry/media-verified.json':{entries:[]},
 });
 assert.deepEqual(V2.vehicles().get('kia-sportage').image,{src:'/media/models/kia-sportage.webp',credit:'Kia Egypt',sourcePage:'https://example.test/kia',flags:[]});
 assert.equal(V2.vehicles().get('hyundai-tucson').image,null);
 assert.equal(V2.vehicles().get('mg-hs').image,null);
});
test('Tucson conflict survives without averaging; P1 files and accepted vendor remain untouched',()=>{
 const old=snap.view.models.find(m=>m.slug==='hyundai-tucson');
 const car=V.vehicles().get('hyundai-tucson');
 assert.equal(old.price.price_from.status,'CONFLICT');assert.equal(car.priceFrom.state,'conflict');assert.equal(car.priceFrom.value,null);
});
