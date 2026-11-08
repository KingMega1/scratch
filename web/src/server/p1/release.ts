import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/* P1 release binding — record P1-RELEASE-T1 (P1-TRANSPORT-01), per buyer-decision/transport/P5-INTEGRATION.md §5.
   The vendored files under web/p1-release/ are byte-identical to the release (scripts/vendor-p1-release.mjs).
   On first use: verify the release record itself, then every file's sha256/bytes against it, then the transport's
   ENGINE/TRANSPORT versions, then the dataset's universe and content hash. Any failure => FMC is refused (no fallback). */

// P1-RELEASE-T1: the production binding until 5 Nov 2026. Kept vendored and tested (explicit binding argument only).
export const BOUND = {
  record: 'P1-RELEASE-T1',
  record_commit: '090edb4680a8a228d8b1fe8043b4700dfca248ee',
  record_sha256: '012e5c4bd0fed5582bae54688daf9c39a125f3823d50f8dacc49b25ba5f9a209',
  transport_commit: '49b73a5379735d59ba74c65425f48b02ddf18ca7',
  engine_version: 'E6-2026-09-28',
  transport_version: 'T1-2026-10-07',
  schema: 'ci.reco.v1',
  // P1's authoritative recommendation universe (283 models on sale, 393 in the view). Not the website browse projection.
  universe_version: 'U11-2026-09-26',
  dataset_id: 'U11-2026-09-26/recommendation_view',
  dataset_content_sha256: '5348da5721f049d3befb1e6c8159ecdf0bfd8ed273916da95ee158ba804934e2',
  // P3 Version 7 — approved with the P1 final semantic gate (BLOCKER: PASS, P1 SEMANTIC RELEASE: YES).
  p3_artifact: '1791369522-eecc',
} as const;

/* P1-RELEASE-U12-CEO3-R5 — ACCEPTED by the CEO (release authority) 2026-11-08, record commit a3fe98f (source ba2120d).
   Built on P2 723748d (release P2-CEO-CONFIRMED-20261102-R1, revision cddfe91b3287, serving sha256 02139f41…), which is
   exactly the serving release P5 serves alongside it. Selected in every build. Production (carindexed.com) still runs the
   R4 deployment (P5 f386e95, P1 R4 22c5fe3 + P2 3b4b5ef) until a separate production GO deploys this pair.
   P1-RELEASE-T1 stays vendored and tested but is not selectable at runtime. Never follows a moving P1 branch. */
export const ACCEPTED_R5 = {
  record: 'P1-RELEASE-U12-CEO3-R5',
  record_commit: 'a3fe98fab4cda8137d29507035fa405910338fc8',
  record_sha256: 'e4f19c1c252b5efbdf514d5a09ca66c5c496c315ef93799625d18319f38e48b5',
  transport_commit: 'ba2120d16b69a54524d9cb4176e8fd4fd763c8c0',
  engine_version: 'E6.1-2026-10-14', transport_version: 'T1.2-2026-11-03',
  schema: 'ci.reco.v1', universe_version: 'U12-CEO3-R5-2026-11-08',
  dataset_id: 'U12-CEO3-R5-2026-11-08/recommendation_view',
  dataset_content_sha256: 'b136d0e66fd9dda89c31c0ac5c46116d090a68f0756baa2e99e08f8da2b0046a',
  p2_commit: '723748dfd32a7b88ef56b3bc55893fdd19ed7a0c', p2_serving_sha256: '02139f4146067089942fcdcc945e4008ad567a12095f84a3f0fc993c1c4f3a81',
  p3_artifact: 'R5-ACCEPTED-2026-11-08',
} as const;
export const ACCEPTED_R5_ROOT = 'p1-accepted/U12-CEO3-R5';
export type Binding = typeof BOUND | typeof ACCEPTED_R5;
export const r5Enabled = () => true;
export const selectedBinding = (): Binding => ACCEPTED_R5;

const RUNTIME_FILES = ['engine', 'parser', 'copy_i18n', 'presentation_extracted', 'redaction', 'transport', 'schema', 'p5_contract', 'dataset_manifest', 'dataset_view'];

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Dataset = { id: string; universe_version: string; sha256: string; registry: unknown; U: { meta: any; models: any[] } };
export type Transport = {
  SCHEMA: string; TRANSPORT_VERSION: string; ENGINE_VERSION: string; LOCALES: string[];
  loadAcceptedDataset(src: string): Dataset;
  execute(brief: any, ds: Dataset, o: { locale: string; asOf?: string }): any;
  understand(text: string, ds: Dataset, o?: { locale?: string }): any;
  nextQuestion(brief: any, asked: string[], ds: Dataset, o: { path: string }): string | null;
  normalize(brief: any, ds: Dataset): any;
  mergeAnswer(brief: any, patch: any, ds: Dataset): any;
  editBrief?(brief: any, changes: any, ds: Dataset): any;
  summary(brief: any, ds: Dataset, o: { locale: string }): { key: string; label: string; value: { html: string; text: string } }[];
  decodeShare(token: string, ds: Dataset): any;
  _internals: { E: any; P: any; I: any; Present: any };
};

export type ReleaseState =
  | { ok: true; T: Transport; ds: Dataset; checks: string[] }
  | { ok: false; error: string; checks: string[] };

export const releaseRoot = () => path.join(process.cwd(), r5Enabled() ? ACCEPTED_R5_ROOT : 'p1-release');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
declare const __non_webpack_require__: NodeRequire | undefined;
// Load the vendored CommonJS at runtime from disk (not bundled), so the bytes executed are the bytes hash-checked.
const nodeRequire: NodeRequire = typeof __non_webpack_require__ === 'function' ? __non_webpack_require__ : eval('require');

// `binding` is explicit only in tests (T1 tamper suite); the runtime always verifies the selected binding.
export function verifyRelease(root = releaseRoot(), req: NodeRequire = nodeRequire, binding: Binding = selectedBinding()): ReleaseState {
  const candidate = binding === ACCEPTED_R5;
  const checks: string[] = [];
  const fail = (error: string): ReleaseState => ({ ok: false, error, checks });
  try {
    const recBytes = readFileSync(path.join(root, `buyer-decision/release/${binding.record}.json`));
    if (sha(recBytes) !== binding.record_sha256) return fail('release record hash mismatch');
    const rec = JSON.parse(recBytes.toString('utf8'));
    if (rec.record !== binding.record || (rec.transport_commit ?? rec.source_commit) !== binding.transport_commit || rec.engine_version !== binding.engine_version ||
        rec.transport_version !== binding.transport_version || rec.universe_version !== binding.universe_version || rec.schema !== binding.schema ||
        rec.dataset?.content_sha256 !== binding.dataset_content_sha256 || (!candidate && rec.semantic_changes !== 'NONE')) return fail('release record does not match the bound release');
    if (candidate && (rec.status !== 'ACCEPTED' || rec.p2_input?.commit !== ACCEPTED_R5.p2_commit ||
        rec.p2_input?.files?.['catalogue-serving.release.json'] !== ACCEPTED_R5.p2_serving_sha256)) return fail('R5 record is not the accepted release on the bound P2 input');
    checks.push(`record ${rec.record} sha256 ok`);
    for (const k of RUNTIME_FILES) {
      const f = rec.files[candidate && k === 'p5_contract' ? 'p5_handoff' : k];
      const b = readFileSync(path.join(root, f.path));
      if (sha(b) !== f.sha256 || b.length !== f.bytes) return fail(`file hash mismatch: ${f.path}`);
    }
    checks.push(`${RUNTIME_FILES.length} files sha256 ok`);
    const T = req(path.join(root, 'buyer-decision/transport/reco.js')) as Transport;
    if (T.ENGINE_VERSION !== rec.engine_version || T.TRANSPORT_VERSION !== rec.transport_version || T.SCHEMA !== rec.schema) return fail('transport version mismatch');
    checks.push(`engine ${T.ENGINE_VERSION}, transport ${T.TRANSPORT_VERSION} ok`);
    const ds = T.loadAcceptedDataset(path.join(root, rec.dataset.path));
    if (ds.universe_version !== binding.universe_version || ds.sha256 !== binding.dataset_content_sha256 || ds.id !== binding.dataset_id) return fail('dataset is not the bound accepted dataset');
    checks.push(`dataset ${ds.id} ${ds.sha256.slice(0, 12)} ok`);
    return { ok: true, T, ds, checks };
  } catch (e) {
    return fail(`release load failed: ${(e as Error).message}`);
  }
}

let state: ReleaseState | null = null;
export const release = () => (state ??= verifyRelease());
