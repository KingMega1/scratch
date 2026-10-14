#!/usr/bin/env node
/* Vendors brand marks from the simple-icons npm package (CC0-1.0 SVG paths; trademarks remain their owners').
   Only marks whose simple-icons title AND source were checked against the automotive brand are included
   (VERIFIED below). Brands without a verified mark get a Brand V2 text tile — never a guessed logo.
   Usage: node scripts/vendor-brand-logos.mjs <path to extracted simple-icons package> */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = process.argv[2];
if (!pkg) { console.error('usage: vendor-brand-logos.mjs <simple-icons package dir>'); process.exit(1); }
const meta = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
// catalogue brand id (read-model brandSlug) -> simple-icons slug; each checked by title + source URL on 2026-10-13
const VERIFIED = {
  audi: 'audi', bmw: 'bmw', cadillac: 'cadillac', chevrolet: 'chevrolet', citroen: 'citroen', fiat: 'fiat', honda: 'honda',
  hyundai: 'hyundai', jeep: 'jeep', kia: 'kia', mg: 'mg', mini: 'mini', mazda: 'mazda', mitsubishi: 'mitsubishi', nissan: 'nissan',
  opel: 'opel', peugeot: 'peugeot', porsche: 'porsche', renault: 'renault', seat: 'seat', skoda: 'skoda', suzuki: 'suzuki',
  tesla: 'tesla', toyota: 'toyota', volkswagen: 'volkswagen', volvo: 'volvo', xiaomi: 'xiaomi', ds: 'dsautomobiles',
};
const EXCLUDED = { proton: 'simple-icons "Proton" is Proton AG (proton.me), not Proton cars' };
const data = JSON.parse(readFileSync(join(pkg, 'data/simple-icons.json'), 'utf8'));
const icons = Array.isArray(data) ? data : data.icons;
const slugOf = i => i.slug || i.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const brands = {};
for (const [id, slug] of Object.entries(VERIFIED)) {
  const icon = icons.find(i => slugOf(i) === slug);
  if (!icon) throw new Error(`missing icon ${slug}`);
  const svg = readFileSync(join(pkg, 'icons', `${slug}.svg`), 'utf8');
  const path = /<path d="([^"]+)"/.exec(svg)?.[1];
  if (!path) throw new Error(`no path in ${slug}`);
  brands[id] = { title: icon.title, si_slug: slug, source_url: icon.source, license: icon.license?.type ?? 'CC0-1.0', svg_sha256: createHash('sha256').update(svg).digest('hex'), path };
}
const out = { schema: 'carindex.brand-logos/v1', source: { package: 'simple-icons', version: meta.version, license: meta.license, note: 'SVG path data CC0-1.0; marks are trademarks of their owners, used to identify the brand.' },
  verified_on: '2026-10-13', brands, excluded: EXCLUDED };
writeFileSync('data/registry/brand-logos.json', JSON.stringify(out, null, 1) + '\n');
console.log(`brand logos: ${Object.keys(brands).length} verified, ${Object.keys(EXCLUDED).length} excluded (simple-icons ${meta.version})`);
