// CarIndex image registry: the only place the renderer may take a vehicle image from.
// One row per image. Same columns work as a Google Sheet tab ("ImageRegistry") or JSON.
//
// vehicle_id        brand-model[-variant] slug, e.g. "chery-tiggo-7-pro", "geely-monjaro-em-i"
// brand, model, variant   variant "" = image valid for every variant of the model
// market            market the photographed car was sold in (EG, MY, global...)
// image_location    where WE store the file (renderer fetches this URL/path)
// original_source_url, source_page   where the file came from
// source_type       oem_official | oem_regional | distributor_press | press_kit | own_photo |
//                   library_unrecorded | third_party_listing | ai_generated
// rights_status     cleared | press_use | unknown | not_allowed
// vehicle_match     verified | unverified | mismatch   (a human checked the photo shows this car)
// verified_by, verified_date (YYYY-MM-DD), notes

const IR_BLOCKED_SOURCES = ['third_party_listing', 'ai_generated'];
const IR_MAX_AGE_DAYS = 365;

function irSlug(...parts) {
  return parts.filter(Boolean).join(' ').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Returns {usable, reasons[], warnings[]} for one registry row.
function irValidate(e, today) {
  const reasons = [];
  const warnings = [];
  for (const f of ['vehicle_id', 'brand', 'model', 'image_location', 'source_type', 'rights_status', 'vehicle_match', 'verified_date']) {
    if (!e[f]) reasons.push(`missing ${f}`);
  }
  if (e.vehicle_id && e.vehicle_id !== irSlug(e.brand, e.model, e.variant)) reasons.push(`vehicle_id ${e.vehicle_id} does not match brand/model/variant`);
  if (IR_BLOCKED_SOURCES.includes(e.source_type)) reasons.push(`source_type ${e.source_type} not allowed`);
  if (e.rights_status === 'not_allowed') reasons.push('rights_status not_allowed');
  if (e.vehicle_match !== 'verified') reasons.push(`vehicle_match is ${e.vehicle_match || 'empty'}`);
  if (!e.original_source_url) warnings.push('original source not recorded');
  if (e.rights_status === 'unknown') warnings.push('usage rights unknown - confirm before posting');
  if (today && e.verified_date) {
    const age = (Date.parse(today) - Date.parse(e.verified_date)) / 86400000;
    if (!(age >= 0)) reasons.push('verified_date invalid or in the future');
    else if (age > IR_MAX_AGE_DAYS) reasons.push(`verified ${Math.round(age)} days ago (> ${IR_MAX_AGE_DAYS})`);
  }
  return { usable: reasons.length === 0, reasons, warnings };
}

// Pick the image for a car: exact variant first, then model-wide (variant "").
// Returns {entry, check, candidates} - entry null when nothing usable.
function irResolve(rows, car, today) {
  const modelId = irSlug(car.make, car.model);
  const variantId = irSlug(car.make, car.model, car.variant);
  const candidates = (rows || []).filter(e => e.vehicle_id === variantId || e.vehicle_id === modelId);
  candidates.sort((a, b) => (b.vehicle_id === variantId) - (a.vehicle_id === variantId));
  for (const e of candidates) {
    const check = irValidate(e, today);
    if (check.usable) return { entry: e, check, candidates: candidates.length };
  }
  return { entry: null, check: candidates.length ? irValidate(candidates[0], today) : { usable: false, reasons: [`no registry row for ${modelId}`], warnings: [] }, candidates: candidates.length };
}

// Shape the QA gate expects.
function irToImageRecord(res, resolveUrl) {
  const e = res.entry;
  if (!e) return { url: '', registry_status: 'none', registry_reasons: res.check.reasons, vehicle: null, ai_generated: false };
  return {
    url: resolveUrl ? resolveUrl(e.image_location) : e.image_location,
    source_url: e.original_source_url || null,
    library_ref: e.image_location,
    credit: e.credit || e.source_type,
    ai_generated: e.source_type === 'ai_generated',
    registry_status: 'approved',
    registry_warnings: res.check.warnings,
    vehicle: [e.brand, e.model, e.variant].filter(Boolean).join(' '),
    width: e.width || 0, height: e.height || 0,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { irSlug, irValidate, irResolve, irToImageRecord };
}
