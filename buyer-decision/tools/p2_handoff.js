// Writes <dataset dir>/P2-HANDOFF-missing-facts.csv: per identity, what P2 must supply for P1 to recommend it.
// Usage: node tools/p2_handoff.js datasets/U12C2-2026-10-14
'use strict';
const fs = require('fs'), path = require('path');
const T = require(path.join(__dirname, '..', 'transport/reco.js')), E = T._internals.E;
const dir = process.argv[2];
const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))), U = JSON.parse(fs.readFileSync(path.join(dir, 'recommendation_view.json')));
const by = Object.fromEntries(U.models.map(m => [m.id, m]));
const SIZE = 'size class (registration segment or official length)', AR = 'Arabic model name (Arabic free text)';
const arMissing = m => !(m && m.ar && m.ar.model && m.ar.model.length);
const rows = [['identity', 'status', 'can_be_recommended_now', 'missing_facts']];
const add = (id, status, can, miss) => rows.push([id, status, can, miss.join('; ')]);
for (const id of man.changes.unknown_price) { const m = by[id]; add(id, 'UNKNOWN_PRICE', 'no', ['current Egypt price per version'].concat(E.size(m) == null ? [SIZE] : [], arMissing(m) ? [AR] : [])); }
for (const id of man.changes.held_no_size_class) add(id, 'HELD_NO_SIZE_CLASS', 'no', [SIZE].concat(arMissing(by[id]) ? [AR] : []));
for (const [r, ids] of Object.entries(man.changes.excluded)) for (const id of ids)
  add(id, 'EXCLUDED_' + r.toUpperCase(), 'no', [r === 'no_body' ? 'body type (alias identity without a body)' : 'none: coupe/convertible outside the passenger universe by policy']);
for (const m of U.models.filter(x => x.u && x.trims.length)) {
  const miss = [];
  if (!(m.seats || []).length) miss.push('seat count (affects 7-seat briefs only)');
  if (m.awd == null) miss.push('drivetrain (affects 4WD briefs only)');
  if (E.currentTrims(m).some(t => !t.pt) && (m.powertrains || []).length !== 1) miss.push('powertrain per version (affects powertrain-restricted briefs only)');
  if (arMissing(m)) miss.push(AR);
  if (miss.length) add(m.id, 'RECOMMENDABLE', 'yes', miss);
}
const q = x => (/[,;"]/.test(x) ? '"' + String(x).replace(/"/g, '""') + '"' : x);
fs.writeFileSync(path.join(dir, 'P2-HANDOFF-missing-facts.csv'), rows.map(r => r.map(q).join(',')).join('\n') + '\n');
const c = {}; rows.slice(1).forEach(r => { c[r[1]] = (c[r[1]] || 0) + 1; });
const k = s => rows.slice(1).filter(r => r[1] === 'RECOMMENDABLE' && r[3].includes(s)).length;
console.log(c, { recommendable_missing_seats: k('seat count'), drivetrain: k('drivetrain'), powertrain_per_version: k('powertrain per'), arabic_name: k('Arabic') });
