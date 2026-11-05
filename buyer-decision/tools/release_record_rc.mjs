// Writes release/P1-RELEASE-<RC>.json: a U12C2 release candidate (engine E6.1 + dataset datasets/<RC>-2026-10-14), with hashes.
// Status stays CANDIDATE until the release authority accepts it; U11/T1 remains the production binding.
// Usage (from buyer-decision/): node tools/release_record_rc.mjs <source_commit> [U12C2-RC2] [datasets/<dir>]
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sc = process.argv[2]; if (!sc) throw new Error('source commit required');
const RC = process.argv[3] || 'U12C2-RC2', DS = process.argv[4] || `datasets/${RC}-2026-10-14`; // [dataset dir] when it is not <RC>-2026-10-14
const git = (...a) => execFileSync('git', a, { cwd: ROOT }).toString().trim();
const blob = (commit, f) => execFileSync('git', ['show', `${commit}:buyer-decision/${f}`], { cwd: ROOT });
const h = b => crypto.createHash('sha256').update(b).digest('hex');
const at = (f, commit = sc) => { const b = blob(commit, f); return { path: `buyer-decision/${f}`, sha256: h(b), bytes: b.length }; };
const T = require(path.join(ROOT, 'transport/reco.js'));
const man = JSON.parse(blob(sc, `${DS}/manifest.json`));
// compare against the production record (P1-RELEASE-T1), not a commit: T1 files span dcbe9db + the transport commits
const T1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'release/P1-RELEASE-T1.json'), 'utf8'));
const changed = Object.values(T1.files).filter(f => f.path.startsWith('buyer-decision/app/') || f.path.startsWith('buyer-decision/transport/'))
  .map(f => f.path.replace('buyer-decision/', '')).filter(f => fs.existsSync(path.join(ROOT, f)) && at(f).sha256 !== T1.files[Object.keys(T1.files).find(k => T1.files[k].path === 'buyer-decision/' + f)].sha256);
const rec = {
  record: `P1-RELEASE-${RC}`, status: 'CANDIDATE — not released', created: new Date().toISOString().slice(0, 10), owner: 'P1', task: 'P1-READINESS-02',
  repo: 'KingMega1/scratch', branch: 'claude/carindex-buyer-decision-slice-applo4', source_commit: git('rev-parse', sc),
  production_binding_unchanged: 'P1-RELEASE-T1 (engine E6-2026-09-28, U11-2026-09-26) stays bound until this candidate is accepted',
  release_gates_open: process.env.RELEASE_GATES_OPEN ? JSON.parse(process.env.RELEASE_GATES_OPEN) : [
    `Release acceptance of engine E6.1 + dataset ${RC}`,
  ],
  copy_gate: 'CLOSED: no DRAFT markers in app/i18n.js. conflict_h CEO-approved 2026-10-21; conflict.unknown_price / sl_out.unknown_price final wording; conflict.unknown_size, conflict.scope, sl_out.unknown_size, sl_out.scope unreachable (no car carries held) under the 2026-10-21 CEO decisions.',
  p2_compatible_revisions: RC === 'U12-CEO3-R3' ? [
    { revision: 'ac757adcfffb', serving_sha256: 'c4bd33ba1b89ff319a6fdc99de44c03d9499f2949e32a821cf25d7293988b363', role: 'dataset built from' },
    { revision: '03089cc2febb', serving_sha256: '8429ddbaf4462d268068a43a5f2d87071a8e806d6d0af0f71c19d30884b3879c', role: 'accepted; delta vs ac757adcfffb = revision + accepted.gallery (geely/ex2, geely/ex5, hyundai/tucson) only; dataset unchanged; price agreement 0/269' },
  ] : undefined,
  test_build: { repo: 'KingMega1/carindex-buyer-test', commit: process.env.TEST_BUILD_COMMIT || null, url: 'https://kingmega1.github.io/carindex-buyer-test/u12c2/app/index.html', tracking: 'none' },
  engine_version: T.ENGINE_VERSION, transport_version: T.TRANSPORT_VERSION, schema: T.SCHEMA,
  universe_version: man.universe_version,
  dataset: { id: man.dataset_id, path: `buyer-decision/${DS}`, file_sha256: man.sha256, content_sha256: man.content_sha256, identities: man.identities, models_in_universe: man.models_in_universe },
  p2_input: man.p2_input, registry: man.registry,
  files_changed_vs_T1: changed,
  files: {
    engine: at('app/engine.js'), parser: at('app/brief.js'), copy_i18n: at('app/i18n.js'), presentation_extracted: at('app/present.js'),
    browser_app: at('app/app.js'), redaction: at('app/redact.js'), tracking: at('app/track.js'),
    transport: at('transport/reco.js'), schema: at('transport/ci.reco.v1.schema.json'), p5_handoff: at(`transport/P5-HANDOFF-${RC}.md`),
    dataset_manifest: at(`${DS}/manifest.json`), dataset_view: at(`${DS}/recommendation_view.json`),
    ...Object.fromEntries([['eligibility_manifest', 'ELIGIBILITY-MANIFEST.csv'], ['coverage_report', 'COVERAGE-REPORT.md'], ['regression_report', 'REGRESSION_REPORT.md'], ['p2_handoff', 'P2-HANDOFF-missing-facts.csv']]
      .filter(([, f]) => fs.existsSync(path.join(ROOT, DS, f))).map(([k, f]) => [k, at(`${DS}/${f}`)])),
  },
  semantic_changes: 'Ranking: NONE. Parser understanding fixes (ranges, +10% stated as %, brand-only phrasings, running costs, Arabic fuel priority, plug-in check) and transport T1.2 (editBrief, budget guard): see transport/P5-HANDOFF-U12-CEO2.md. Eligibility data policy per CEO 2026-10-21 (market prices for unpriced cars, no size hold, coupes/convertibles/vans included; see dataset manifest changes.policy). Engine E6.1 (vs T1): a held market car reports unknown_size / scope instead of not_on_sale. Transport T1.1: no compare table for a single-car result, matching the released app.',
  evidence: { ref: `buyer-decision/${DS}/REGRESSION_REPORT.md`, commands: [
    'node tools/build_present.mjs --check', 'node tests/regression/run.js --strict',
    `CI_DATASET=${DS}/recommendation_view.json node tests/regression/run.js`, 'node tests/eligibility.test.js datasets/{U11-2026-09-26,U12C-2026-10-14,U12C2-2026-10-14,U12C2-RC1-2026-10-14,U12C2-RC2-2026-10-14,U12-RC3-2026-10-15,U12-RC6-2026-10-21,U12-CEO-2026-11-03,U12-CEO2-2026-11-03}', `node tests/ceo_failures.test.js ${DS}`, `node tests/buyer_scenarios.test.js ${DS}`, `node tests/u12_data.test.js ${DS}`, `node tests/transport/browser_equivalence.mjs <build of ${DS}> ${DS}`,
    'node tests/named_cars.test.js', 'node tests/transport/transport.test.js', 'node tests/{contracts,engine,integrity,redact}.test.js', 'node tests/e2e.mjs'] },
};
fs.writeFileSync(path.join(ROOT, `release/P1-RELEASE-${RC}.json`), JSON.stringify(rec, null, 1) + '\n');
console.log(JSON.stringify({ changed, files: Object.fromEntries(Object.entries(rec.files).map(([k, v]) => [k, v.sha256.slice(0, 12)])) }, null, 1));
