import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/* P1 release binding — record P1-RELEASE-T1 (P1-TRANSPORT-01), per buyer-decision/transport/P5-INTEGRATION.md §5.
   The vendored files under web/p1-release/ are byte-identical to the release (scripts/vendor-p1-release.mjs).
   On first use: verify the release record itself, then every file's sha256/bytes against it, then the transport's
   ENGINE/TRANSPORT versions, then the dataset's universe and content hash. Any failure => FMC is refused (no fallback). */

// What P5 deliberately binds. Changing any of these is a new integration decision, not a config change.
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

/* CEO-authorized NONPRODUCTION preview candidate, pinned to P1 record commit 47e33e1 (P1-RELEASE-U12-CEO3, status
   CANDIDATE — not released). Never follows a moving P1 branch. Supersedes the staged U12-CEO2 (0b06620) and U12-RC3 candidates, which
   are no longer vendored: CEO3 changes only the dataset (CEO powertrain decisions for 7 models); engine E6.1, transport T1.2, parser,
   copy and presentation bytes are identical to CEO2, and the P2 input is the same release P5 serves (5a373d7). */
export const PREVIEW_CANDIDATE = {
  record: 'P1-RELEASE-U12-CEO3',
  record_commit: '47e33e16475018e440f9de92af4cd4ba22f51559',
  record_sha256: '06880f9838289247f0e81663f0a7564cbd1f63e2cbc5eb0c9e725b51e45f02d3',
  transport_commit: 'cfa3450f62c8c5353c3eebfda8d096792a034bb2',
  engine_version: 'E6.1-2026-10-14', transport_version: 'T1.2-2026-11-03',
  schema: 'ci.reco.v1', universe_version: 'U12-CEO3-2026-11-03',
  dataset_id: 'U12-CEO3-2026-11-03/recommendation_view',
  dataset_content_sha256: '4f2e9ccc8d57b5fc9df3de2b7e99df27348047a795f834ea2c1ca975627cfd52',
  p3_artifact: 'CANDIDATE_COPY_NOT_ACCEPTED',
} as const;
export const PREVIEW_CANDIDATE_ID = 'U12-CEO3';
export const PREVIEW_CANDIDATE_ROOT = 'p1-candidate/U12-CEO3';
export function candidateEnabled() {
  return process.env.P1_CANDIDATE === PREVIEW_CANDIDATE_ID && process.env.CI_ENV === 'preview' &&
    process.env.VERCEL_ENV !== 'production';
}
export const selectedBinding = () => candidateEnabled() ? PREVIEW_CANDIDATE : BOUND;

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

export const releaseRoot = () => path.join(process.cwd(), candidateEnabled() ? PREVIEW_CANDIDATE_ROOT : 'p1-release');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
declare const __non_webpack_require__: NodeRequire | undefined;
// Load the vendored CommonJS at runtime from disk (not bundled), so the bytes executed are the bytes hash-checked.
const nodeRequire: NodeRequire = typeof __non_webpack_require__ === 'function' ? __non_webpack_require__ : eval('require');

export function verifyRelease(root = releaseRoot(), req: NodeRequire = nodeRequire): ReleaseState {
  const binding = selectedBinding();
  const candidate = candidateEnabled();
  const checks: string[] = [];
  const fail = (error: string): ReleaseState => ({ ok: false, error, checks });
  try {
    if (process.env.P1_CANDIDATE && !candidate) return fail('candidate forbidden outside explicit nonproduction preview');
    const recBytes = readFileSync(path.join(root, `buyer-decision/release/${binding.record}.json`));
    if (sha(recBytes) !== binding.record_sha256) return fail('release record hash mismatch');
    const rec = JSON.parse(recBytes.toString('utf8'));
    if (rec.record !== binding.record || (rec.transport_commit ?? rec.source_commit) !== binding.transport_commit || rec.engine_version !== binding.engine_version ||
        rec.transport_version !== binding.transport_version || rec.universe_version !== binding.universe_version || rec.schema !== binding.schema ||
        rec.dataset?.content_sha256 !== binding.dataset_content_sha256 || (!candidate && rec.semantic_changes !== 'NONE')) return fail('release record does not match the bound release');
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
