import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('data/registry/brochure-serving.release.json','utf8'));
const serving=JSON.parse(readFileSync('data/registry/catalogue-serving.release.json','utf8'));
test('six reviewed brochure PDFs link exact U11 identities, with hashes and unknown dates preserved',()=>{
 assert.equal(release.entries.length,6);assert.equal(new Set(release.entries.map(b=>b.p1_id)).size,6);
 for(const b of release.entries){
  assert.ok(serving.entries.some(e=>e.p1_id===b.p1_id));
  assert.equal(new URL(b.url).hostname,'www-europe.nissan-cdn.net');
  assert.ok(new URL(b.source_page).hostname==='en.nissan.com.eg');
  assert.match(b.sha256,/^[0-9a-f]{64}$/);assert.ok(b.bytes>1000);assert.ok(b.pages>0);
  assert.equal(b.effective_date,null);assert.equal(b.qa.trim_applicability,'VERIFY_BEFORE_FACT_PROMOTION');
 }
});
