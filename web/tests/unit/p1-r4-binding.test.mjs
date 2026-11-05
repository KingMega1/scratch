import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, imports={}) { const mod={exports:{}}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:n=>imports[n]??require(n),console,process,Buffer},{filename:file}); return mod.exports; }
const R=load('src/server/p1/release.ts',{'server-only':{}});
test('binding: every environment (production included, CEO GO 5 Nov) binds the accepted R4 and verifies it; T1 bytes never pass as R4',()=>{
 const prev={...process.env};
 try {
  for(const env of [{CI_ENV:'production',VERCEL_ENV:'production'},{CI_ENV:'preview',VERCEL_ENV:'preview'},{CI_ENV:'preview',VERCEL_ENV:'production'},{CI_ENV:'development',VERCEL_ENV:''},{P1_CANDIDATE:'U12-CEO3-R3'}]){
   Object.assign(process.env,env);
   assert.equal(R.selectedBinding().record,'P1-RELEASE-U12-CEO3-R4',JSON.stringify(env));
   assert.ok(R.releaseRoot().endsWith('p1-accepted/U12-CEO3-R4'));
  }
  const rel=R.verifyRelease(path.resolve('p1-accepted/U12-CEO3-R4'),require);
  assert.equal(rel.ok,true,rel.error); assert.equal(rel.T.TRANSPORT_VERSION,'T1.2-2026-11-03'); assert.equal(rel.T.ENGINE_VERSION,'E6.1-2026-10-14');
  assert.equal(rel.ds.sha256,R.ACCEPTED_R4.dataset_content_sha256); assert.equal(rel.ds.universe_version,'U12-CEO3-R4-2026-11-05');
  assert.equal(typeof rel.T.editBrief,'function');
  assert.equal(R.verifyRelease(path.resolve('p1-release'),require).ok,false);
  // the source cannot fall back to T1 from configuration
  const src=fs.readFileSync('src/server/p1/release.ts','utf8');
  assert.match(src,/export const selectedBinding = \(\): Binding => ACCEPTED_R4;/);
 } finally { for(const k of Object.keys(process.env)) if(!(k in prev)) delete process.env[k]; Object.assign(process.env,prev); }
});
