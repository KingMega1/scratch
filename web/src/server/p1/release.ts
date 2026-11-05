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

/* P1-RELEASE-U12-CEO3-R4 — ACCEPTED by the CEO (release authority) 2026-11-05, record commit 22c5fe3 (source 777fabc).
   Built on P2 3b4b5ef (release P2-CEO-CONFIRMED-20261102-R1, revision ad4cc5e906b4, serving sha256 e6d2711d…), which is
   exactly the serving release P5 serves alongside it. Bound in every environment, production included (CEO GO 5 Nov:
   release to carindexed.com on R4 22c5fe3 + P2 3b4b5ef). P1-RELEASE-T1 stays vendored and tested but is not selectable at
   runtime; rollback is the previous Vercel production deployment. Never follows a moving P1 branch. */
export const ACCEPTED_R4 = {
  record: 'P1-RELEASE-U12-CEO3-R4',
  record_commit: '22c5fe3a68803a4c4afe41b42774b065e7c6b0e1',
  record_sha256: '8de4ea34ab7b66ffd71b25ff42366d8193c30875a94781323d5edf1e0a08bc2f',
  transport_commit: '777fabc35f7d8c3e726fa77423d2883272cf2fb6',
  engine_version: 'E6.1-2026-10-14', transport_version: 'T1.2-2026-11-03',
  schema: 'ci.reco.v1', universe_version: 'U12-CEO3-R4-2026-11-05',
  dataset_id: 'U12-CEO3-R4-2026-11-05/recommendation_view',
  dataset_content_sha256: '0d34e538944e02cf2244505902c095e77d3b2df552fc980bfb43ba292a6ecddb',
  p2_commit: '3b4b5ef0eedf3eeed1ca91fb597bc0394e3050f1', p2_serving_sha256: 'e6d2711d70a786c52cacfd8aa87d0a4fa60d3529434a732431cacd94e41ceb0b',
  p3_artifact: 'R4-ACCEPTED-2026-11-05',
} as const;
export const ACCEPTED_R4_ROOT = 'p1-accepted/U12-CEO3-R4';
export type Binding = typeof BOUND | typeof ACCEPTED_R4;
export const r4Enabled = () => true;
export const selectedBinding = (): Binding => ACCEPTED_R4;

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

export const releaseRoot = () => path.join(process.cwd(), r4Enabled() ? ACCEPTED_R4_ROOT : 'p1-release');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
declare const __non_webpack_require__: NodeRequire | undefined;
// Load the vendored CommonJS at runtime from disk (not bundled), so the bytes executed are the bytes hash-checked.
const nodeRequire: NodeRequire = typeof __non_webpack_require__ === 'function' ? __non_webpack_require__ : eval('require');

// `binding` is explicit only in tests (T1 tamper suite); the runtime always verifies the selected binding.
export function verifyRelease(root = releaseRoot(), req: NodeRequire = nodeRequire, binding: Binding = selectedBinding()): ReleaseState {
  const candidate = binding === ACCEPTED_R4;
  const checks: string[] = [];
  const fail = (error: string): ReleaseState => ({ ok: false, error, checks });
  try {
    const recBytes = readFileSync(path.join(root, `buyer-decision/release/${binding.record}.json`));
    if (sha(recBytes) !== binding.record_sha256) return fail('release record hash mismatch');
    const rec = JSON.parse(recBytes.toString('utf8'));
    if (rec.record !== binding.record || (rec.transport_commit ?? rec.source_commit) !== binding.transport_commit || rec.engine_version !== binding.engine_version ||
        rec.transport_version !== binding.transport_version || rec.universe_version !== binding.universe_version || rec.schema !== binding.schema ||
        rec.dataset?.content_sha256 !== binding.dataset_content_sha256 || (!candidate && rec.semantic_changes !== 'NONE')) return fail('release record does not match the bound release');
    if (candidate && (rec.status !== 'ACCEPTED' || rec.p2_input?.commit !== ACCEPTED_R4.p2_commit ||
        rec.p2_input?.files?.['catalogue-serving.release.json'] !== ACCEPTED_R4.p2_serving_sha256)) return fail('R4 record is not the accepted release on the bound P2 input');
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
