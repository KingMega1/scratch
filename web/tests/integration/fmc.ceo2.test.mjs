import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), root='../../p1-candidate/U12-CEO2/buyer-decision/';
const T=require(root+'transport/reco.js');
const rec=JSON.parse(fs.readFileSync(new URL(root+'release/P1-RELEASE-U12-CEO2.json',import.meta.url)));
const ds=T.loadAcceptedDataset(new URL(root+ 'datasets/U12-CEO2-2026-11-03',import.meta.url).pathname);
const base=process.env.FMC_BASE_URL||'http://localhost:3210';
async function api(body){const res=await fetch(base+'/api/v1/recommendation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await res.json();assert.equal(res.status,200,JSON.stringify(j));return j;}
const direct=(b,l)=>T.execute(T.normalize(b,ds),ds,{locale:l});
const ids=r=>[r.hero,...r.alternatives].filter(Boolean).map(c=>c.id);
test('candidate status and P1/P2 exact provenance',async()=>{
 const j=await api({op:'status',locale:'en'}); assert.equal(j.status.record,rec.record); assert.equal(j.status.dataset_sha256,rec.dataset.content_sha256);
 const h=await (await fetch(base+'/api/health')).json();assert.equal(h.recommendation.release_commit,'0b066207e43baa9af7e9b1d536e3ba8568d023ce');
 const p2=JSON.parse(fs.readFileSync(new URL('../../data/registry/catalogue-serving.release.json',import.meta.url)));
 assert.equal(rec.p2_input.commit,'5a373d7a5ee97247f2da6de65239ff61c79cab4e');
 assert.ok(p2);
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../../data/registry/catalogue-serving.release.json',import.meta.url))).digest('hex'),rec.p2_input.files['catalogue-serving.release.json']);
});
for(const [locale,text] of [['en','SUV from 1.2M to 1.5M, anything but Kia, low running costs'],['ar','عربية عالية من 1.2 مليون لـ 1.5 مليون، اي حاجه غير كيا، الأهم عندي البنزين']]) test(locale+' range, exclusions, edits, share and exact P1 output',async()=>{
 const v=await api({op:'start',path:'text',text,locale});
 const b=v.brief; assert.equal(b.budgetMode,'range');assert.equal(b.budgetMin,1200000);assert.equal(b.budget,1500000); assert.ok(b.brandsExclude.includes('kia'));
 const r=await api({op:'execute',brief:b,locale});assert.deepEqual(r.result,direct(b,locale));
 for(const id of ids(r.result)) assert.notEqual(ds.U.models.find(m=>m.id===id).brand_id,'kia');
 const f=await api({op:'edit_form',brief:b,locale});
 const edit={budget:f.budget,sel:Object.fromEntries(f.groups.map(g=>[g.key,g.key==='prio'?[]:g.sel])),only:[],excl:[],cars:f.cars.map(c=>c.id),addCars:[],unresolved:[]};
 const saved=await api({op:'edit_save',brief:b,edit,locale});
 assert.deepEqual(saved.brief.brandsExclude,[]);assert.deepEqual(saved.brief.priorities,[]);assert.deepEqual(saved.brief.checks,[]);
 assert.equal(saved.brief.budgetMode,'range');assert.equal(saved.brief.budgetMin,1200000);
 const after=await api({op:'execute',brief:saved.brief,locale});assert.deepEqual(after.result,direct(saved.brief,locale));
 assert.notEqual(after.result.result_id,r.result.result_id);
 const shared=await api({op:'shared',r:after.result.share.r,locale});assert.deepEqual(shared.result,after.result);
 // A deliberate budget edit replaces the range rather than silently retaining its floor.
 edit.budget={value:2000000,mode:'max',stretch:false,changed:true};
 const budgetEdit=await api({op:'edit_save',brief:saved.brief,edit,locale});
 assert.equal(budgetEdit.brief.budgetMode,'max');assert.equal(budgetEdit.brief.budgetMin,null);
});
for(const locale of ['en','ar']) test(locale+' only-brand removal, powertrain clearing and single-car contract',async()=>{
 const b=T.understand(locale==='en'?'I only want a Kia, maximum 2 million, no electric':'مش عايز غير كيا، بحد أقصى 2 مليون، مش عايز كهربا',ds,{locale});
 assert.ok(b.brandsOnly.includes('kia'));
 const f=await api({op:'edit_form',brief:b,locale});
 const edit={budget:f.budget,sel:Object.fromEntries(f.groups.map(g=>[g.key,g.key==='pt'?['open']:g.sel])),only:[],excl:[],cars:[],addCars:[],unresolved:[]};
 const saved=await api({op:'edit_save',brief:b,edit,locale});assert.deepEqual(saved.brief.brandsOnly,[]);assert.deepEqual(saved.brief.ptNo,[]);
 const r=await api({op:'execute',brief:saved.brief,locale});assert.deepEqual(r.result,direct(saved.brief,locale));
 const single=T.understand('7-seater around EGP 1M',ds,{locale});
 const one=await api({op:'execute',brief:single,locale});assert.deepEqual(one.result,direct(single,locale));assert.equal(one.result.compare_html,null);
});
