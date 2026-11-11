/* Read-only proposed P2 work; no canonical promotion or engine changes. */
import fs from 'node:fs';import vm from 'node:vm';
const box={window:{}};vm.runInNewContext(fs.readFileSync('tests/fixtures/p1-accepted/view.js','utf8'),box);
const rows=[];const snap=JSON.parse(fs.readFileSync('data/registry/universe.snapshot.json'));
for(const m of box.window.CI_UNIVERSE.models.filter(m=>m.u)){
 const add=(f,w,p,a)=>rows.push([`${m.brand} ${m.model}`,f,w,p,a,'P1 QA baseline U11; not current canonical P2']);
 if(m.awd==null)add('trim-confirmed AWD / 4WD','Hard 4WD requirement excludes unknown models; candidate pool weakens.','P0','Verify Egypt drivetrain for exact trim/year from official brochure.');
 if(!m.seats?.length)add('trim-confirmed seats','Seven-seat must-have excludes unknown models; fewer eligible alternatives.','P0','Verify Egypt seat count per trim/year with official evidence.');
 if(!m.segment)add('segment / size class','Space/easy/reference-size/premium factors lack values; unknown fill weakens confidence.','P1','Resolve approved taxonomy with evidence and mapping review.');
}
for(const m of snap.view.models){const attrs=m.specs?.attributes??{};
 for(const [f,w,p,a]of[
 ['drive_type','Needed for canonical-to-P1 hard 4WD eligibility.','P0','Extract exact trim/year drivetrain from official Egypt brochure.'],
 ['seats','Needed for canonical-to-P1 seven-seat eligibility.','P0','Verify exact trim/year seat count.'],
 ['trunk_capacity','Buyer comparison gap; current engine does not rank on measured boot volume.','P2','Capture litres and seat configuration; any engine use needs separate P1 approval.'],
 ['fuel_consumption','Economy currently uses powertrain proxies; same-powertrain cars may tie. No present direct ranking effect.','P2','Capture cycle/units/local grade; future engine use requires separate P1 approval.'],
 ['warranty','Current engine explicitly does not rank warranty; buyer economics gap.','P2','Capture years/km/exclusions with dated Egypt terms.']])if(!attrs[f]||attrs[f].status==='MISSING'||!attrs[f].values?.length)rows.push([`${m.brand} ${m.model}`,f,w,p,a,`canonical ${snap.meta.snapshot_id}`]);
 if(['CONFLICT','MISSING'].includes(m.price?.price_from?.status))rows.push([`${m.brand} ${m.model}`,'current official grade price','Conflict/missing price weakens budget eligibility and display.','P0','Resolve against dated importer price list; preserve conflicting evidence.',`canonical ${snap.meta.snapshot_id}`]);
}
const q=s=>'"'+String(s).replaceAll('"','""')+'"';fs.writeFileSync('docs/hardening-evidence/p2-recommendation-gaps.csv',[['Model','missing field','why it affects recommendation','priority','proposed P2 action','evidence baseline'],...rows].map(r=>r.map(q).join(',')).join('\n')+'\n');
console.log(JSON.stringify({rows:rows.length,models:new Set(rows.map(r=>r[0])).size,priority:Object.fromEntries(['P0','P1','P2'].map(p=>[p,rows.filter(r=>r[3]===p).length]))}));
