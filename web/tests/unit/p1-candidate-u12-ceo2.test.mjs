import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const root=path.resolve('p1-candidate/U12-CEO2');
const rec=JSON.parse(fs.readFileSync(path.join(root,'buyer-decision/release/P1-RELEASE-U12-CEO2.json')));
const keys=['engine','parser','copy_i18n','presentation_extracted','redaction','transport','schema','dataset_manifest','dataset_view'];
test('CEO2 isolated candidate matches all required release bytes and versions',()=>{
 assert.match(rec.status,/^CANDIDATE/);
 for(const k of keys){const f=rec.files[k],b=fs.readFileSync(path.join(root,f.path));assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256,k);assert.equal(b.length,f.bytes,k);}
 const T=createRequire(import.meta.url)(path.join(root,'buyer-decision/transport/reco.js'));
 const ds=T.loadAcceptedDataset(path.join(root,rec.dataset.path));
 assert.equal(T.TRANSPORT_VERSION,'T1.2-2026-11-03');assert.equal(T.ENGINE_VERSION,rec.engine_version);assert.equal(ds.sha256,rec.dataset.content_sha256);
 assert.equal(rec.p2_input.commit,'5a373d7a5ee97247f2da6de65239ff61c79cab4e');
 const source=fs.readFileSync('src/server/p1/release.ts','utf8');
 assert.match(source,/record: 'P1-RELEASE-T1'/);
 assert.match(source,/process.env.CI_ENV === 'preview'/); assert.match(source,/process.env.VERCEL_ENV !== 'production'/);
});
for(const suite of ['ceo_failures','buyer_scenarios','named_cars']) test('CEO2 independent '+suite,()=>{
 const r=spawnSync(process.execPath,[path.join(root,'buyer-decision/tests/'+suite+'.test.js'),path.join(root,rec.dataset.path)],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
