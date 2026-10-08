import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const u11 = read('p1-release/buyer-decision/datasets/U11-2026-09-26/recommendation_view.json');
const site = read('data/registry/universe.snapshot.json').view.models;
const cw = read('data/registry/display-crosswalk.TEMP.json').map;
const byId = Object.fromEntries(u11.models.map(m => [m.id, m]));
const bySite = new Map(site.map(m => [m.slug, {brand:{en:m.brand},model:{en:m.model}}]));
const slugs = new Map(Object.entries(cw).map(([slug, row]) => [row.matched_old_id, slug]));
const T = {_internals:{Present:{create:()=>({setLang:()=>{},byId})}}};
const mocks = {
  'server-only':{},
  '../p1/release':{BOUND:{},release:()=>({ok:true,T,ds:{U:u11}})},
  '../vehicles/read-model':{vehicles:()=>({get:id=>bySite.get(id)??null}),p1DisplaySlug:id=>slugs.get(id)??null},
  '../http/guard':{log:()=>{}}
};
const code = ts.transpileModule(fs.readFileSync(new URL('src/server/recommendation/fmc.ts',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const mod={exports:{}}, require=createRequire(import.meta.url);
vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>mocks[n]??require(n),console,process,Buffer});
const F=mod.exports;

test('AT-51 actual websiteLinks: 21 valid links, 3 off-sale exclusions, no inferred slug',()=>{
  const ids=Object.values(cw).map(row=>row.matched_old_id);
  const r={locale:'en',hero:{id:ids[0]},alternatives:ids.slice(1).map(id=>({id}))};
  const links=F.websiteLinks(r);
  assert.equal(Object.keys(links).length,24);
  let on=0,off=0;
  for(const id of ids){
    if(byId[id].u){assert.equal(links[id],slugs.get(id),id);on++;}
    else{assert.equal(links[id],null,id);off++;}
  }
  assert.equal(on,21);assert.equal(off,3);
  assert.equal(links['soueast/s-06'],'soueast-s06');
  assert.equal(links['soueast/s-09'],'soueast-s09');
  assert.equal(links['deepal/s-05'],'deepal-s05');
  assert.equal(F.websiteLinks({locale:'en',hero:{id:'unknown/not-in-crosswalk'},alternatives:[]})['unknown/not-in-crosswalk'],null);
});
