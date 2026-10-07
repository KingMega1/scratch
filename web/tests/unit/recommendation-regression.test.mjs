import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const dir = 'tests/fixtures/p1-accepted/';
const manifest = JSON.parse(fs.readFileSync(dir + 'manifest.json'));
for (const [f, sha] of Object.entries(manifest.files)) assert.equal(createHash('sha256').update(fs.readFileSync(dir+f)).digest('hex'), sha);
const E = require('../../'+dir+'engine.js'), B = require('../../'+dir+'brief.js');
const sandbox = {window:{}}; vm.runInNewContext(fs.readFileSync(dir+'view.js','utf8'),sandbox);
const U = JSON.parse(JSON.stringify(sandbox.window.CI_UNIVERSE));
const parse = text => B.parse(text, U.models);
for (const text of ["I don't want a fully electric car", 'مش عايز عربية كهربا']) test('EV negation: '+text, () => {
  const b=parse(text); assert.ok(b.ptNo.includes('ev')); const r=E.recommend(U,{...b,budget:2000000});
  for(const id of r.poolIds) assert.equal(E.eligibility(U.models.find(m=>m.id===id),b,r.terr).status,'eligible');
});
for (const text of ['better than Hyundai','أحسن من هيونداي']) test('comparative brand remains unresolved / Not Applied: '+text,()=>{
  const b=parse(text); assert.equal(b.unresolved[0].kind,'brand_floor'); assert.equal(b.brandsOnly,undefined); assert.equal(b.brandsExclude,undefined); assert.equal(b.extracted.includes('brands'),false);
});
test('maximum / around / earned stretch retain settled ceilings and continuous budget curve',()=>{
  assert.equal(parse('maximum 2 million').budgetMode,'max'); assert.equal(parse('around 2 million').budgetMode,'around');
  for(const b of [{budget:2000000,budgetMode:'max'},{budget:2000000,budgetMode:'around'},{budget:2000000,budgetMode:'max',stretch:true}]) {
    const t=E.territory(b); assert.equal(t.ceil,b.budgetMode==='max'&&!b.stretch?2000000:2200000);
    assert.equal(E.priceFit(1800000,t),1); assert.equal(E.priceFit(2000000,t),1); assert.ok(E.priceFit(1600000,t)<1);
  }
});
test('tie / lean confidence contract and deterministic outcomes across a brief matrix',()=>{
  let ties=0,leans=0;
  for(const budget of [1000000,1500000,2000000,2500000,3000000,4000000]) for(const priorities of [[],['space'],['easy'],['economy'],['popular'],['pocket']]) {
    const b={budget,priorities},r=E.recommend(U,b); assert.deepEqual(E.recommend(U,b),r);
    if(r.confidence?.level==='tie'){ties++;assert.equal(r.clear,false);assert.ok(r.tier>1);}
    if(r.confidence?.level==='lean'){leans++;assert.ok(r.confidence.depends.length>0);}
  }
  assert.ok(ties>0); assert.ok(leans>0);
});
test('EN/AR negation and comparative brand have equivalent applied inputs',()=>{
  const a=parse("I don't want a fully electric car"),b=parse('مش عايز عربية كهربا');assert.deepEqual(a.ptNo,b.ptNo);assert.equal(a.pt,b.pt);
  assert.equal(parse('better than Hyundai').unresolved[0].brand,parse('أحسن من هيونداي').unresolved[0].brand);
});
// Transpile the existing TS contracts for executable tests without changing application code.
function load(file, imports={}) {const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>imports[n]??require(n),console});return mod.exports;}
const C=load('src/lib/recommendation/contract.ts');
const A=load('src/server/recommendation/integration-adapter.ts',{'@/lib/recommendation/contract':C});
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/reco.tie.NONPRODUCTION.json'));
test('share-safe result schema requires an opaque UUID and excludes free text',()=>{
  const r=fixture.result??fixture; const sample={...r,result_id:'buyer@example.com'};assert.equal(C.RecommendationResult.safeParse(sample).success,false);
  assert.equal(C.RecommendationResult.safeParse({...r,share_safe:false}).success,false);
});
test('prepared adapter cannot execute without exact P1 RELEASE for P3 Version 5',()=>{
  let called=false;const transport={execute:()=>{called=true;}};
  assert.throws(()=>A.prepareReleasedAdapter(null,transport),/pending_semantic_acceptance/);assert.equal(called,false);
  assert.throws(()=>A.prepareReleasedAdapter({decision:'RELEASE',p3_artifact_id:'older-version'},transport),/pending_semantic_acceptance/);
});
test('P5 preserves engine-supplied tie/lean and stale official price metadata',async()=>{
  const {_NOTICE,...r}=fixture;
  const release={decision:'RELEASE',p3_artifact_id:A.P3_INTEGRATION_ARTIFACT,p1_evidence_ref:'QA-only',engine_version:r.engine_version,universe_version:r.universe_version,registry_snapshot_id:r.registry_snapshot_id};
  for(const state of [r.state,{kind:'lean',lead_model_id:r.candidates[0].model_id,depends_on:['unknown_data']}]) {
    const input={...r,state,candidates:r.candidates.map(c=>({...c,price:{...c.price,stale:true}}))};
    const out=await A.prepareReleasedAdapter(release,{execute:async()=>input})(r.brief);
    assert.deepEqual(JSON.parse(JSON.stringify(out)),input);
  }
  await assert.rejects(A.prepareReleasedAdapter(release,{execute:async()=>({...r,brief:{...r.brief,free_text:'buyer@example.com'}})})(r.brief),/unsafe_result|Unrecognized/);
  await assert.rejects(A.prepareReleasedAdapter(release,{execute:async()=>({...r,engine_version:'other'})})(r.brief),/release_version_mismatch/);
});
