import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
/* Dry run of the P1 candidate U12C2 against the BOUND T1 engine/transport. Prepared, not active: production stays on U11. */
const require = createRequire(import.meta.url);
function load(file, imports={}) {const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>imports[n]??require(n),console,process,Buffer},{filename:file});return mod.exports;}
const R=load('src/server/p1/release.ts',{'server-only':{}});
const C=R.CANDIDATE, root=path.resolve('p1-release');
const release=JSON.parse(fs.readFileSync('data/registry/catalogue-serving.release.json','utf8'));
const routes=new Map([...release.entries.map(e=>[e.p1_id,e.site_slug]),...(release.market_additions??[]).map(a=>[a.identity,a.site_slug])]);
const rel=R.verifyRelease(root,require);

test('production binding is still U11; candidate is not active',()=>{
  assert.equal(R.BOUND.universe_version,'U11-2026-09-26');assert.equal(C.status,'CANDIDATE_NOT_ACCEPTED');
  assert.equal(rel.ok,true);assert.equal(rel.ds.universe_version,'U11-2026-09-26');
});
test('candidate files are the P1 bytes (manifest + sha256)',()=>{
  const b=fs.readFileSync(path.join(root,C.path,'recommendation_view.json'));
  assert.equal(createHash('sha256').update(b).digest('hex'),C.file_sha256);
  const man=JSON.parse(fs.readFileSync(path.join(root,C.path,'manifest.json'),'utf8'));
  assert.equal(man.dataset_id,C.dataset_id);assert.equal(man.content_sha256,C.content_sha256);
});
const ds=rel.T.loadAcceptedDataset(path.join(root,C.path));
test('bound T1 transport accepts the candidate; every in-universe model has a website route',()=>{
  assert.equal(ds.universe_version,C.universe_version);assert.equal(ds.sha256,C.content_sha256);
  const inU=ds.U.models.filter(m=>m.u);
  assert.equal(inU.length,ds.U.meta.models_in_universe);
  const missing=inU.filter(m=>!routes.has(m.id)).map(m=>m.id);
  assert.deepEqual(missing,[]);
  console.log({in_universe:inU.length,priced:ds.U.meta.models_priced_in_universe,routes:routes.size});
});
const BRIEFS=[
  ['en',{budget:2000000,budgetMode:'around',body:['suv']}],['ar',{budget:2000000,budgetMode:'around',body:['suv']}],
  ['en',{budget:1400000,budgetMode:'around',body:['sedan']}],['ar',{budget:1400000,budgetMode:'max',body:['sedan']}],
  ['en',{budget:3500000,budgetMode:'max',body:['suv'],pt:['ev']}],['ar',{budget:6000000,budgetMode:'around'}],
  ['en',{budget:900000,budgetMode:'max'}],['ar',{budget:2200000,budgetMode:'max',seats:7}],
];
for(const [locale,brief] of BRIEFS) test(`candidate ${locale} ${JSON.stringify(brief)}: results resolve to website routes`,()=>{
  const b=rel.T.normalize(brief,ds); const r=rel.T.execute(b,ds,{locale});
  assert.equal(r.universe_version,C.universe_version);
  const ids=[r.hero?.id,...(r.alternatives??[]).map(a=>a.id)].filter(Boolean);
  for(const id of ids) assert.ok(routes.has(id),`${id} has no website route`);
});
