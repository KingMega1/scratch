// Arabic recognition audit for popular models (P2 coverage-matrix rank) and launches (P2 launch_flag).
// Usage: node tests/arabic_names.js <dataset dir> <targets.json {launch:[], top40:[]}> [out.csv]
'use strict';
const fs = require('fs'), path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js'));
const ds = T.loadAcceptedDataset(process.argv[2]), tg = JSON.parse(fs.readFileSync(process.argv[3]));
const by = Object.fromEntries(ds.U.models.map(m => [m.id, m]));
const hit = (t, id) => { const b = T.understand(t, ds, { locale: 'ar' }); return [...(b.shortlist || []), ...(b.aspiration || []), ...(b.reference || []), ...((b.mentions || []).map(x => x.id))].includes(id); };
const rows = [['identity', 'group', 'latin_in_arabic', 'arabic_brand_latin_model', 'full_arabic', 'arabic_model_names']];
const ids = [...new Set([...tg.top40.map(x => [x, 'top40']), ...tg.launch.map(x => [x, 'launch'])].map(JSON.stringify))].map(JSON.parse);
const stat = {};
for (const [id, g] of ids) {
  const m = by[id];
  if (!m) { rows.push([id, g, 'not in view', '', '', '']); continue; }
  const a = hit(`عايز ${m.brand} ${m.model}`, id), arB = (m.ar && m.ar.brand && m.ar.brand[0]) || null, arM = (m.ar && m.ar.model) || [];
  const b = arB ? hit(`عايز ${arB} ${m.model}`, id) : null, c = arB && arM.length ? hit(`عايز ${arB} ${arM[0]}`, id) : null;
  rows.push([id, g, a ? 'yes' : 'NO', b == null ? 'no Arabic brand name' : b ? 'yes' : 'NO', c == null ? 'no Arabic model name' : c ? 'yes' : 'NO', arM.join(' | ')]);
  const k = `${g}`; stat[k] = stat[k] || { n: 0, latin: 0, arBrand: 0, fullAr: 0, noArName: 0 };
  stat[k].n++; stat[k].latin += a; stat[k].arBrand += !!b; stat[k].fullAr += !!c; stat[k].noArName += !arM.length;
}
if (process.argv[4]) fs.writeFileSync(process.argv[4], rows.map(r => r.join(',')).join('\n') + '\n');
console.log(JSON.stringify(stat)); rows.filter(r => r.includes('NO')).forEach(r => console.log('  ' + r.join(' | ')));
