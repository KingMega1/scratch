#!/usr/bin/env node
// Read-only serving projection; never writes either vehicle truth or the P1 dataset.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export function buildCatalogue(snap, u, cw) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const ids = new Map(u.models.map(m => [m.id, m]));
  if (ids.size !== u.models.length) throw Error('duplicate U11 identity');
  const existing = new Map(), excluded = [], slugs = new Set();
  for (const m of snap.view.models) {
    const id = cw.map[m.slug]?.matched_old_id, p = ids.get(id);
    if (!p || norm(p.brand + ' ' + p.model) !== norm(m.brand + ' ' + m.model)) throw Error('unverified identity: ' + m.slug);
    if (p.u === true) existing.set(id, m);
    else excluded.push({ p1_id:id, p2_model_id:m.model_id, site_slug:m.slug, reason:'U11_OFF_SALE', retained_in_p2:true });
  }
  const entries = u.models.filter(p => p.u === true).map(p => {
    const old = existing.get(p.id), slug = old?.slug || p.id.replace('/', '-');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) throw Error('invalid/colliding route: ' + slug);
    slugs.add(slug);
    return { p1_id:p.id, p2_model_id:old?.model_id??null, id_status:old?.id_status??'P2_ACCEPT_PENDING',
      site_slug:slug, brand:p.brand, model:p.model,
      ar:{ brand:old?cw.map[slug]?.ar?.brand??null:p.ar?.brand?.[0]??null, model:old?cw.map[slug]?.ar?.model??null:p.ar?.model?.[0]??null },
      on_sale:true, body:p.body??null, powertrains:p.powertrains??[],
      registration:p.reg?{last12:p.reg.last12??null,first_month:p.reg.first_month??null,window:u.meta.last12_window}:null,
      p2_evidence:!!old, evidence_state:old?'P2_S6_EVIDENCE':'U11_IDENTITY_ONLY',
      price_status:old?.price?.price_from?.status??'UNKNOWN', conflicts:old?.conflicts??[],
      missing_evidence:old?(old.gaps??[]).map(g=>g.type??g.code??String(g)):['NO_VERIFIED_PRICE','NO_VERIFIED_SPECS','P2_ID_PENDING'] };
  });
  if (entries.length !== u.meta.models_in_universe) throw Error('on-sale denominator drift');
  return {schema:'carindex.p2.catalogue-serving/v1',release_id:'P2-CATALOGUE-U11-S6-2026-10-12-RC1',
    state:'VERIFYING',acceptance:'P2_ACCEPT_PENDING',generated_as_of:'2026-10-12',
    identity_authority:{version:u.meta.version,commit:'1947c0d0bd979f92720324fba68b13f2b767f71d',
      path:'web/p1-release/buyer-decision/datasets/U11-2026-09-26/recommendation_view.json',models:u.models.length,on_sale:entries.length},
    evidence_authority:snap.meta,
    relation:'Website on-sale set equals pinned U11 on-sale set; P2 S6 evidence is an explicit 21-model subset. P1 remains unchanged.',
    counts:{catalogue:entries.length,p2_evidence:existing.size,identity_only:entries.length-existing.size,excluded:excluded.length},entries,excluded};
}
export function loadInputs() {
  return ['data/registry/universe.snapshot.json','p1-release/buyer-decision/datasets/U11-2026-09-26/recommendation_view.json','data/registry/display-crosswalk.TEMP.json']
    .map(p=>JSON.parse(readFileSync(p,'utf8')));
}
if (process.argv[1]?.endsWith('build-catalogue-release.mjs')) {
  const release=buildCatalogue(...loadInputs()), text=JSON.stringify(release,null,2)+'\n';
  writeFileSync('data/registry/catalogue-serving.release.json',text);
  console.log(JSON.stringify({release:release.release_id,counts:release.counts,sha256:createHash('sha256').update(text).digest('hex')}));
}
