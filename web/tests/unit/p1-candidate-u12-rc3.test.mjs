import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
/* Dry run of P1 candidate U12-RC3 with its own engine E6.1 + transport T1.1 (vendored under p1-candidate/, not read at runtime).
   Prepared, not active: Find My Car stays bound to P1-RELEASE-T1 / U11 until P1 RELEASE. */
const require = createRequire(import.meta.url);
function load(file, imports={}) {const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>imports[n]??require(n),console,process,Buffer},{filename:file});return mod.exports;}
const R=load('src/server/p1/release.ts',{'server-only':{}});
const C=R.CANDIDATE, root=path.resolve(C.root);
const sha=b=>createHash('sha256').update(b).digest('hex');
const recBytes=fs.readFileSync(path.join(root,'buyer-decision/release',`${C.record}.json`)), rec=JSON.parse(recBytes);
const release=JSON.parse(fs.readFileSync('data/registry/catalogue-serving.release.json','utf8'));
const routes=new Map([...release.entries.map(e=>[e.p1_id,e.site_slug]),...(release.market_additions??[]).map(a=>[a.identity,a.site_slug])]);

test('production stays on P1-RELEASE-T1 / U11; candidate is a CANDIDATE record',()=>{
  assert.equal(R.BOUND.record,'P1-RELEASE-T1');assert.equal(R.BOUND.universe_version,'U11-2026-09-26');
  const bound=R.verifyRelease(path.resolve('p1-release'),require);assert.equal(bound.ok,true);assert.equal(bound.ds.universe_version,'U11-2026-09-26');
  assert.equal(C.status,'CANDIDATE_NOT_ACCEPTED');assert.match(rec.status,/^CANDIDATE/);assert.ok(rec.release_gates_open.length>0);
  assert.equal(sha(recBytes),C.record_sha256);
  const src=fs.readFileSync('src/server/p1/release.ts','utf8');assert.ok(!/p1-candidate/.test(src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/root: 'p1-candidate\/U12-RC3'/,'')));
});
test('every vendored candidate file is the P1 bytes named in the record',()=>{
  for(const [k,f] of Object.entries(rec.files)){
    const p=path.join(root,f.path); if(!fs.existsSync(p)) continue; // browser-only/report files are not vendored
    const b=fs.readFileSync(p);assert.equal(sha(b),f.sha256,k);assert.equal(b.length,f.bytes,k);
  }
  assert.equal(sha(fs.readFileSync(path.join(root,C.path,'recommendation_view.json'))),C.file_sha256);
});
const T=require(path.join(root,'buyer-decision/transport/reco.js'));
const ds=T.loadAcceptedDataset(path.join(root,C.path));
test('P5-HANDOFF §5 binding checks pass on the candidate',()=>{
  assert.equal(T.ENGINE_VERSION,C.engine_version);assert.equal(T.TRANSPORT_VERSION,C.transport_version);
  assert.equal(ds.universe_version,C.universe_version);assert.equal(ds.sha256,C.content_sha256);
});
test('every candidate identity resolves to a website route (P2 fc19238 catalogue)',()=>{
  const ids=ds.U.models.map(m=>m.id), missing=ids.filter(id=>!routes.has(id));
  assert.deepEqual(missing,[]);
  console.log({identities:ids.length,in_universe:ds.U.models.filter(m=>m.u).length,routes:routes.size});
});
const BRIEFS=[
  ['en',{budget:2000000,budgetMode:'around',body:['suv']}],['ar',{budget:2000000,budgetMode:'around',body:['suv']}],
  ['en',{budget:1400000,budgetMode:'around',body:['sedan']}],['ar',{budget:1400000,budgetMode:'max',body:['sedan']}],
  ['en',{budget:3500000,budgetMode:'max',body:['suv'],pt:['ev']}],['ar',{budget:6000000,budgetMode:'around'}],
  ['en',{budget:900000,budgetMode:'max'}],['ar',{budget:2200000,budgetMode:'max',seats:7}],
];
for(const [locale,brief] of BRIEFS) test(`candidate ${locale} ${JSON.stringify(brief)}: results resolve to website routes`,()=>{
  const r=T.execute(T.normalize(brief,ds),ds,{locale});
  assert.equal(r.universe_version,C.universe_version);
  for(const id of [r.hero?.id,...(r.alternatives??[]).map(a=>a.id)].filter(Boolean)) assert.ok(routes.has(id),`${id} has no website route`);
});
test('candidate parser reads Arabic free text with a P2-accepted Arabic model name',()=>{
  const u=T.understand('عايز ألفا روميو جوليا',ds,{locale:'ar'});
  assert.ok(JSON.stringify(u).includes('alfa-romeo/giulia'),JSON.stringify(u).slice(0,300));
});
