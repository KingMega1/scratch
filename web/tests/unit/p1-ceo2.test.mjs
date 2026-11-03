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
test('CEO2 is refused in production even if explicitly selected',()=>{
 const prev={...process.env};
 try {
  process.env.P1_CANDIDATE='U12-CEO2';
  for(const env of [{CI_ENV:'production',VERCEL_ENV:'production'},{CI_ENV:'preview',VERCEL_ENV:'production'},{CI_ENV:'development',VERCEL_ENV:''}]){
   Object.assign(process.env,env); assert.equal(R.candidateEnabled(),false);
   assert.equal(R.verifyRelease(path.resolve('p1-release'),require).ok,false);
  }
  process.env.CI_ENV='preview'; delete process.env.VERCEL_ENV;
  const rel=R.verifyRelease(path.resolve('p1-candidate/U12-CEO2'),require);
  assert.equal(rel.ok,true,rel.error); assert.equal(rel.T.TRANSPORT_VERSION,'T1.2-2026-11-03');
  assert.equal(rel.ds.sha256,R.CEO2.dataset_content_sha256);
  assert.equal(typeof rel.T.editBrief,'function');
 } finally { for(const k of Object.keys(process.env)) if(!(k in prev)) delete process.env[k]; Object.assign(process.env,prev); }
});
