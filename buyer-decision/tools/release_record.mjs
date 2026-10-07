// Writes release/P1-RELEASE-T1.json: what exactly constitutes the released P1 implementation + transport, with hashes.
// Usage (from buyer-decision/): node tools/release_record.mjs <transport_commit>
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tc = process.argv[2]; if (!tc) throw new Error('transport commit required');
const git = (...a) => execFileSync('git', a, { cwd: ROOT }).toString().trim();
const blob = (commit, f) => execFileSync('git', ['show', `${commit}:buyer-decision/${f}`], { cwd: ROOT });
const h = b => crypto.createHash('sha256').update(b).digest('hex');
const at = (f, commit = tc) => { const b = blob(commit, f); return { path: `buyer-decision/${f}`, sha256: h(b), bytes: b.length }; };
const T = require(path.join(ROOT, 'transport/reco.js'));
const man = JSON.parse(blob(tc, 'datasets/U11-2026-09-26/manifest.json'));
const SRC = 'dcbe9dbaa2f93f99dfb162745b11ef315e52a5f6';
const same = ['app/engine.js', 'app/brief.js', 'app/i18n.js', 'app/app.js', 'app/redact.js', 'app/track.js'].every(f => at(f).sha256 === at(f, SRC).sha256);
const rec = {
  record: 'P1-RELEASE-T1', created: new Date().toISOString().slice(0, 10), owner: 'P1', task: 'P1-TRANSPORT-01',
  repo: 'KingMega1/scratch', branch: 'claude/carindex-buyer-decision-slice-applo4',
  p1_source_commit: SRC,
  transport_commit: git('rev-parse', tc),
  published_build: { repo: 'KingMega1/carindex-buyer-test', commit: '1a139e538d32c05457d344a53cf9f59c54b5925f', url: 'https://kingmega1.github.io/carindex-buyer-test/app/index.html',
    note: 'built from p1_source_commit by tools/build_public.py; engine/brief/i18n/app byte-identical to the files below; data/view.js sha256 = dataset published_view_js_sha256' },
  engine_version: T.ENGINE_VERSION, transport_version: T.TRANSPORT_VERSION, schema: T.SCHEMA,
  universe_version: man.universe_version,
  dataset: { id: man.dataset_id, path: 'buyer-decision/datasets/U11-2026-09-26', file_sha256: man.sha256, content_sha256: man.content_sha256, published_view_js_sha256: man.published_view_js_sha256, models: man.models, models_in_universe: man.models_in_universe },
  registry: man.registry,
  released_files_unchanged_since_p1_source_commit: same,
  files: {
    engine: at('app/engine.js'), parser: at('app/brief.js'), copy_i18n: at('app/i18n.js'), presentation_extracted: at('app/present.js'),
    browser_app: at('app/app.js'), redaction: at('app/redact.js'), tracking: at('app/track.js'),
    transport: at('transport/reco.js'), schema: at('transport/ci.reco.v1.schema.json'), p5_contract: at('transport/P5-INTEGRATION.md'),
    present_generator: at('tools/build_present.mjs'), dataset_manifest: at('datasets/U11-2026-09-26/manifest.json'), dataset_view: at('datasets/U11-2026-09-26/recommendation_view.json'),
  },
  superseded_p5_vendor: { source_commit: 'f994e7f2441194f149ce0e9988abe41ef10e2e11', 'brief.js': '6c476efa572d4feb71bf502cc807e633612f4c638300e65ab46d5c76a01cc46f', 'i18n.js': '3e91dbb166dee9fb37e2756afc0d16e4fec5a6620539b41e295a782959d5185d',
    status: 'NOT the release: predates the dcbe9db comparative-brand parser fix. engine.js there (5ce81cc0…) equals the release.' },
  evidence: { ref: 'buyer-decision/release/P1-TRANSPORT-01-EVIDENCE.md', commands: [
    'node tools/build_present.mjs --check', 'node tests/regression/run.js --strict', 'node tests/transport/transport.test.js',
    'node tests/transport/browser_equivalence.mjs <published build 1a139e5 checkout>', 'node tests/{contracts,engine,integrity,redact}.test.js', 'node tests/e2e.mjs'] },
  semantic_changes: 'NONE',
};
fs.writeFileSync(path.join(ROOT, 'release/P1-RELEASE-T1.json'), JSON.stringify(rec, null, 1) + '\n');
console.log(JSON.stringify({ same, files: Object.fromEntries(Object.entries(rec.files).map(([k, v]) => [k, v.sha256.slice(0, 12)])) }, null, 1));
