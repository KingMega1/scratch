import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const root=path.resolve('p1-accepted/U12-CEO3-R4');
const rec=JSON.parse(fs.readFileSync(path.join(root,'buyer-decision/release/P1-RELEASE-U12-CEO3-R4.json')));
const keys=['engine','parser','copy_i18n','presentation_extracted','redaction','transport','schema','dataset_manifest','dataset_view'];
test('R4 accepted release matches all required release bytes and versions; P5 serves its exact P2 input',()=>{
 assert.equal(rec.status,'ACCEPTED');assert.equal(rec.acceptance.p2.commit,'3b4b5ef0eedf3eeed1ca91fb597bc0394e3050f1');
 assert.equal(createHash('sha256').update(fs.readFileSync('data/registry/catalogue-serving.release.json')).digest('hex'),rec.p2_input.files['catalogue-serving.release.json']);
 for(const k of keys){const f=rec.files[k],b=fs.readFileSync(path.join(root,f.path));assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256,k);assert.equal(b.length,f.bytes,k);}
 const T=createRequire(import.meta.url)(path.join(root,'buyer-decision/transport/reco.js'));
 const ds=T.loadAcceptedDataset(path.join(root,rec.dataset.path));
 assert.equal(T.TRANSPORT_VERSION,'T1.2-2026-11-03');assert.equal(T.ENGINE_VERSION,rec.engine_version);assert.equal(ds.sha256,rec.dataset.content_sha256);
 assert.equal(rec.p2_input.commit,'3b4b5ef0eedf3eeed1ca91fb597bc0394e3050f1');
 const source=fs.readFileSync('src/server/p1/release.ts','utf8');
 assert.match(source,/record: 'P1-RELEASE-T1'/);
 assert.match(source,/process.env.CI_ENV === 'preview'/); assert.match(source,/process.env.VERCEL_ENV !== 'production'/);
});
for(const suite of ['ceo_failures','buyer_scenarios','named_cars']) test('R4 independent '+suite,()=>{
 const r=spawnSync(process.execPath,[path.join(root,'buyer-decision/tests/'+suite+'.test.js'),path.join(root,rec.dataset.path)],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
test('P5 independent price parity: R4 P1 version prices equal the served P2-accepted prices for every accepted model',()=>{
 const p2=JSON.parse(fs.readFileSync('data/registry/catalogue-serving.release.json','utf8'));
 const view=JSON.parse(fs.readFileSync(path.join(root,rec.dataset.path,'recommendation_view.json'),'utf8'));
 const P1=new Map(view.models.map(m=>[m.id,m]));let n=0;const bad=[];
 for(const e of [...p2.entries,...(p2.market_additions??[])]){const p=e.accepted?.price;if(!p)continue;n++;
  const m=P1.get(e.p1_id??e.identity);if(!m?.trims?.length){bad.push(e.site_slug+': no P1 price');continue;}
  const a=[...new Set(p.trims.length?p.trims.map(t=>t.price_egp):[p.price_from])].sort((x,y)=>x-y), b=[...new Set(m.trims.map(t=>t.min))].sort((x,y)=>x-y);
  if(JSON.stringify(a)!==JSON.stringify(b))bad.push(`${e.site_slug}: P2 ${a} vs P1 ${b}`);}
 assert.equal(n,269);assert.deepEqual(bad,[]);
 // no accepted price for VW Passat in P2; P1 carries only a non-official market figure (CEO 21 Oct policy), never official
 assert.ok(!p2.entries.find(e=>e.p1_id==='volkswagen/passat').accepted?.price);
 assert.ok(P1.get('volkswagen/passat').trims.every(t=>t.official!==true));
});
