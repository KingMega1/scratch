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
// Transpile server TS for executable tests without changing application code.
function load(file, imports={}) {const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>imports[n]??require(n),console,process,Buffer},{filename:file});return mod.exports;}
const R=load('src/server/p1/release.ts',{'server-only':{}});
const C=load('src/lib/recommendation/contract.ts');
const os=require('node:os'), path=require('node:path');
const copyRelease=()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'p1rel-'));fs.cpSync('p1-release',d,{recursive:true});return d;};
test('release binding verifies record, file hashes, versions and dataset (P1-RELEASE-T1, P3 V7)',()=>{
  const r=R.verifyRelease(path.resolve('p1-release'),require);
  assert.equal(r.ok,true,r.error);
  assert.equal(r.T.ENGINE_VERSION,'E6-2026-09-28');assert.equal(r.T.TRANSPORT_VERSION,'T1-2026-10-07');
  assert.equal(r.ds.universe_version,'U11-2026-09-26');assert.equal(r.ds.U.models.filter(m=>m.u).length,283);
  assert.equal(R.BOUND.p3_artifact,'1791369522-eecc');assert.notEqual(R.BOUND.p3_artifact,'1791368192-d509');
});
for (const [name,mutate,re] of [
  ['tampered engine.js', d=>fs.appendFileSync(path.join(d,'buyer-decision/app/engine.js'),'\n'), /file hash mismatch: buyer-decision\/app\/engine.js/],
  ['tampered i18n copy', d=>{const f=path.join(d,'buyer-decision/app/i18n.js');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('don’t have yet',"don't have yet"));}, /file hash mismatch: buyer-decision\/app\/i18n.js/],
  ['tampered dataset', d=>{const f=path.join(d,'buyer-decision/datasets/U11-2026-09-26/recommendation_view.json');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('"U11-2026-09-26"','"U12-2026-10-01"'));}, /file hash mismatch/],
  ['edited release record', d=>{const f=path.join(d,'buyer-decision/release/P1-RELEASE-T1.json');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('E6-2026-09-28','E7-2026-10-01'));}, /release record hash mismatch/],
  ['missing transport', d=>fs.rmSync(path.join(d,'buyer-decision/transport/reco.js')), /release load failed/],
]) test(`release binding refuses: ${name}`,()=>{const d=copyRelease();mutate(d);const r=R.verifyRelease(d,require);assert.equal(r.ok,false);assert.match(r.error,re);});
test('API envelope: only known ops, bounded inputs; no free-text field outside start/answer/parse',()=>{
  assert.equal(C.FmcRequest.safeParse({op:'execute',locale:'en',brief:{}}).success,true);
  assert.equal(C.FmcRequest.safeParse({op:'execute',locale:'fr',brief:{}}).success,false);
  assert.equal(C.FmcRequest.safeParse({op:'start',locale:'en',path:'text',text:'x'.repeat(1001)}).success,false);
  assert.equal(C.FmcRequest.safeParse({op:'shared',locale:'en',r:'x'.repeat(4001)}).success,false);
  assert.equal(C.FmcRequest.safeParse({op:'score',locale:'en'}).success,false);
});
const F=load('src/server/recommendation/fmc.ts',{'server-only':{},'../p1/release':R,'../vehicles/read-model':{vehicles:()=>({get:()=>null})},'../http/guard':{log:()=>{}}});
test('result guard refuses version mismatch, stale binding, leaked share keys and leaked buyer text',()=>{
  const rel=R.verifyRelease(path.resolve('p1-release'),require);const T=rel.T,ds=rel.ds;
  const b=T.normalize({text:'my number is 01012345678',budget:2000000,budgetMode:'around',body:['suv']},ds);
  const good=T.execute(b,ds,{locale:'en'});
  F.guardResult(good,b,'en'); // passes
  const bad=(patch)=>({...JSON.parse(JSON.stringify(good)),...patch});
  for(const [name,r,loc] of [
    ['engine mismatch',bad({engine_version:'E5-2026-01-01'}),'en'],
    ['transport mismatch',bad({transport_version:'T0'}),'en'],
    ['universe mismatch (stale result)',bad({universe_version:'U10-2026-08-01'}),'en'],
    ['dataset hash mismatch',bad({dataset:{id:good.dataset.id,sha256:'0'.repeat(64)}}),'en'],
    ['locale mismatch',good,'ar'],
    ['bad result id',bad({result_id:'buyer@example.com'}),'en'],
  ]) assert.throws(()=>F.guardResult(r,b,loc),/release_version_mismatch/,name);
  assert.throws(()=>F.guardResult(bad({share:{...good.share,brief:{...good.share.brief,text:'x'}}}),b,'en'),/privacy_guard/);
  assert.throws(()=>F.guardResult(bad({notices:[{html:'01012345678',text:'my number is 01012345678'}]}),b,'en'),/privacy_guard/);
});
