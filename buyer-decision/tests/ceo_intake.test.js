'use strict';
const fs=require('fs'),assert=require('assert/strict');
const [dir,input]=process.argv.slice(2);
const U=JSON.parse(fs.readFileSync(dir+'/recommendation_view.json'));
const P=JSON.parse(fs.readFileSync(input+'/catalogue-serving.release.json'));
const by=new Map(U.models.map(m=>[m.id,m]));let trims=0,models=0,from=0;
for(const e of P.entries.concat(P.market_additions)){
 const p=e.accepted&&e.accepted.price;if(!p||p.confirmation_status!=='CEO_CONFIRMED')continue;
 const m=by.get(e.identity||e.p1_id);assert.ok(m);models++;
 // model-from only: one 'Unspecified trim' at the accepted starting price, flagged price_from_only; no invented name or model year
 if(!p.trims.length){assert.equal(m.price_from_evidence.price_from,p.price_from);assert.equal(m.trims.length,1);const t0=m.trims[0];
  assert.equal(t0.price_from_only,true);assert.equal(t0.min,p.price_from);assert.equal(t0.label,'Unspecified trim');assert.equal(t0.year,p.model_year??null);assert.equal(t0.official,p.tier==='A');from++;}
 else assert.equal(m.trims.length,p.trims.length);
 for(const t of p.trims){assert.match(t.price_id,/^ceo\d{4}-/,'CEO-confirmed price_id prefix: '+t.price_id);const d=m.trims.find(x=>x.p2_price_id===t.price_id);assert.ok(d,t.price_id);
  assert.equal(d.min,t.price_egp);assert.equal(d.year,t.model_year??null);assert.equal(d.date,t.effective_date??null);
  assert.equal(d.source_sha256,t.source_sha256);assert.equal(d.confirmation_status,'CEO_CONFIRMED');trims++;
 }
}
assert.ok(models>30);assert.ok(trims>70);assert.ok(from>0);
const kia=by.get('kia/k4');assert.equal(kia.trims.find(t=>t.label==='Highline').min,1549900);
const j=by.get('jaecoo/j7-phev');assert.equal(j.trims[0].year,null);assert.equal(j.trims[0].plugin,true);
console.log(JSON.stringify({result:'PASS',models,trim_rows:trims,model_from_holds:from,options_in_trims:0}));
