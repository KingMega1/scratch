// P2 vehicle-data sync consumer core (runs inside an n8n Code node; no Node builtins available).
// Contract: SYNC_CONTRACT.md. GitHub is canonical; this node only reads GitHub and records a ledger
// in workflow static data. It never writes to GitHub, Drive, or any production dataset.
//
// Inputs (first item json, all optional): {request_id, ref, path, expected_sha256, reset_ledger}
const CFG = {
  repo: 'KingMega1/scratch',
  branch: 'claude/carindex-buyer-vehicle-data-97yinp',
  defaultPath: 'vehicle-data/views/p1_suv_2m.json',
  allowPaths: [/^vehicle-data\/views\/[a-z0-9_]+\.json$/, /^vehicle-data\/sync_canary\/[a-z0-9_]+\.json$/],
  schemas: {
    'carindex.p1.buyer_view/v2': ['schema', 'generated_as_of', 'models'],
    'carindex.sync_canary/v1': ['schema', 'artifact_id', 'generated_as_of', 'payload'],
  },
};
const UA = { 'User-Agent': 'carindex-p2-sync/1', Accept: 'application/vnd.github+json' };

// ---- pure-JS SHA-1 / SHA-256 over byte arrays (crypto module is disallowed in the n8n sandbox)
function sha256(bytes) {
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const p = pad(bytes, false), W = new Uint32Array(64);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < p.length; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = (p[i+4*t] << 24) | (p[i+4*t+1] << 16) | (p[i+4*t+2] << 8) | p[i+4*t+3];
    for (let t = 16; t < 64; t++) {
      const s0 = r(W[t-15], 7) ^ r(W[t-15], 18) ^ (W[t-15] >>> 3), s1 = r(W[t-2], 17) ^ r(W[t-2], 19) ^ (W[t-2] >>> 10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return hex(H);
}
function sha1(bytes) {
  const H = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
  const p = pad(bytes, false), W = new Uint32Array(80);
  const l = (x, n) => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < p.length; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = (p[i+4*t] << 24) | (p[i+4*t+1] << 16) | (p[i+4*t+2] << 8) | p[i+4*t+3];
    for (let t = 16; t < 80; t++) W[t] = l(W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16], 1);
    let [a, b, c, d, e] = H;
    for (let t = 0; t < 80; t++) {
      const [f, k] = t < 20 ? [(b & c) | (~b & d), 0x5a827999] : t < 40 ? [b ^ c ^ d, 0x6ed9eba1]
        : t < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const tmp = (l(a, 5) + f + e + k + W[t]) | 0;
      e = d; d = c; c = l(b, 30); b = a; a = tmp;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e;
  }
  return hex(H);
}
function pad(bytes) {
  const n = bytes.length, total = (((n + 9) + 63) >> 6) << 6, p = new Uint8Array(total);
  p.set(bytes); p[n] = 0x80;
  const bits = n * 8;
  for (let i = 0; i < 8; i++) p[total - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
  return p;
}
function hex(words) { return Array.from(words, w => (w >>> 0).toString(16).padStart(8, '0')).join(''); }
function gitBlobSha(bytes) {
  const head = new TextEncoder().encode(`blob ${bytes.length}\0`), all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);
  return sha1(all);
}

// The task runner may hand back a Buffer, an ArrayBuffer, a serialised {type:'Buffer',data:[]} or a string.
function toBytes(b) {
  if (b == null) return new Uint8Array(0);
  if (b instanceof Uint8Array) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  if (b instanceof ArrayBuffer) return new Uint8Array(b);
  if (b.type === 'Buffer' && Array.isArray(b.data)) return Uint8Array.from(b.data);
  if (typeof b === 'string') return new TextEncoder().encode(b);
  if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  return new Uint8Array(0);
}

// ---- sync
const transient = (st) => st === 0 || st === 403 || st === 429 || st >= 500;   // GitHub rate limit = 403/429
async function gh(ctx, url, bin) {
  try {
    const res = await ctx.helpers.httpRequest({ url, headers: UA, json: !bin, encoding: bin ? 'arraybuffer' : undefined,
                                                returnFullResponse: true, ignoreHttpStatusErrors: true });
    return { status: res.statusCode, body: res.body };
  } catch (e) { return { status: 0, body: null, error: e.message }; }
}

async function run(ctx, input, ledger, now) {
  const req = Object.assign({}, input);
  const path = req.path || CFG.defaultPath, ref = req.ref || CFG.branch;
  const artifact_id = `github:${CFG.repo}:${path}`;
  const out = { request_id: req.request_id || null, artifact_id, path, ref, decided_at: now };
  const decide = (decision, extra) => {
    Object.assign(out, extra || {}, { decision });
    ledger.events.push({ at: now, request_id: out.request_id, artifact_id, decision, commit: out.commit || null,
                         sha256: out.sha256 || null, reason: out.reason || null });
    if (ledger.events.length > 200) ledger.events.splice(0, ledger.events.length - 200);
    out.ledger_entry = ledger.artifacts[artifact_id] || null;
    return out;
  };
  if (!CFG.allowPaths.some(rx => rx.test(path))) return decide('REJECTED_NOT_ALLOWED', { reason: 'path not in allowlist' });

  // one call resolves the commit AND proves it is on the canonical branch lineage (identical to, or behind, the head)
  const lin = await gh(ctx, `https://api.github.com/repos/${CFG.repo}/compare/${encodeURIComponent(CFG.branch)}...${encodeURIComponent(ref)}`);
  if (transient(lin.status)) return decide('DEFERRED_SOURCE_UNAVAILABLE', { reason: `GitHub HTTP ${lin.status} (rate limit / outage): retry later, state unchanged` });
  if (lin.status === 404 || lin.status === 422) return decide('REJECTED_SOURCE_NOT_FOUND', { reason: `ref not found (HTTP ${lin.status})` });
  if (lin.status !== 200 || !['identical', 'behind'].includes(lin.body.status))
    return decide('REJECTED_NOT_ON_CANONICAL_BRANCH', { reason: `compare branch...ref = ${lin.body && lin.body.status} (HTTP ${lin.status})` });
  const mb = lin.body.merge_base_commit;   // for identical/behind the merge base IS the requested commit
  const commit = mb.sha; out.commit = commit; out.commit_date = mb.commit.committer.date;

  const meta = await gh(ctx, `https://api.github.com/repos/${CFG.repo}/contents/${path}?ref=${commit}`);
  if (transient(meta.status)) return decide('DEFERRED_SOURCE_UNAVAILABLE', { reason: `GitHub HTTP ${meta.status}: retry later, state unchanged` });
  if (meta.status !== 200 || !meta.body || !meta.body.sha) return decide('REJECTED_SOURCE_NOT_FOUND', { reason: `contents HTTP ${meta.status}` });
  const raw = await gh(ctx, `https://raw.githubusercontent.com/${CFG.repo}/${commit}/${path}`, true);
  if (transient(raw.status)) return decide('DEFERRED_SOURCE_UNAVAILABLE', { reason: `raw HTTP ${raw.status}: retry later, state unchanged` });
  if (raw.status !== 200) return decide('REJECTED_SOURCE_NOT_FOUND', { reason: `raw HTTP ${raw.status}` });
  const bytes = toBytes(raw.body);
  out.body_type = raw.body === null ? 'null' : (raw.body && raw.body.constructor ? raw.body.constructor.name : typeof raw.body);
  const sha = sha256(bytes), blob = gitBlobSha(bytes);
  Object.assign(out, { sha256: sha, git_blob_sha: blob, bytes: bytes.length });
  if (blob !== meta.body.sha) return decide('REJECTED_INTEGRITY', { reason: `git blob ${blob} != GitHub ${meta.body.sha}` });
  if (req.expected_sha256 && req.expected_sha256 !== sha) return decide('REJECTED_INTEGRITY', { reason: 'sha256 != expected_sha256' });

  let doc;
  try { doc = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (e) { return decide('REJECTED_MALFORMED', { reason: `not UTF-8 JSON: ${e.message.slice(0, 120)}` }); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return decide('REJECTED_MALFORMED', { reason: 'top level is not an object' });
  const req_keys = CFG.schemas[doc.schema];
  out.schema = doc.schema || null;
  if (!req_keys) return decide('REJECTED_UNSUPPORTED_SCHEMA', { reason: `schema ${JSON.stringify(doc.schema)} not supported` });
  const missing = req_keys.filter(k => !(k in doc));
  if (missing.length) return decide('REJECTED_MALFORMED', { reason: `missing keys ${missing.join(',')}` });
  // "processing": the consumer derives the facts it will use downstream
  const consumed = { generated_as_of: doc.generated_as_of,
                     items: Array.isArray(doc.models) ? doc.models.length : (doc.payload && doc.payload.items || []).length,
                     synthetic: doc.schema === 'carindex.sync_canary/v1' };

  const cur = ledger.artifacts[artifact_id];
  const entry = (version) => ({ artifact_id, version, schema: doc.schema, commit, commit_date: out.commit_date,
                                git_blob_sha: blob, sha256: sha, bytes: bytes.length,
                                canonical_url: `https://github.com/${CFG.repo}/blob/${commit}/${path}`,
                                consumed, processed_at: now });
  if (!cur) { ledger.artifacts[artifact_id] = entry(1); return decide('ACCEPTED_NEW', { consumed }); }
  if (cur.sha256 === sha) {
    cur.last_seen_commit = commit; cur.last_seen_at = now;
    return decide('DUPLICATE_NO_CHANGE', { reason: `content identical to version ${cur.version}` });
  }
  const order = await gh(ctx, `https://api.github.com/repos/${CFG.repo}/compare/${cur.commit}...${commit}`);
  if (transient(order.status)) return decide('DEFERRED_SOURCE_UNAVAILABLE', { reason: `GitHub HTTP ${order.status}: retry later, state unchanged` });
  const st = order.status === 200 ? order.body.status : `HTTP ${order.status}`;
  if (st === 'ahead') {
    const prev = { version: cur.version, commit: cur.commit, sha256: cur.sha256 };
    ledger.artifacts[artifact_id] = Object.assign(entry(cur.version + 1), { previous: prev });
    return decide('UPDATED', { consumed, previous: prev });
  }
  if (st === 'behind') return decide('REJECTED_STALE', { reason: `commit is older than current version ${cur.version} (${cur.commit.slice(0, 7)})` });
  return decide('REJECTED_DIVERGED', { reason: `compare current...candidate = ${st}` });
}

// ---- n8n entry point
const staticData = $getWorkflowStaticData('global');
const input = ($input.first() && $input.first().json) || {};
let req = {};
if (input.request) req = input.request; else if (input.ref || input.path) req = input;
if (req.reset_ledger === true) delete staticData.p2sync;
staticData.p2sync = staticData.p2sync || { contract: 'carindex.p2.sync/v1', artifacts: {}, events: [] };
const result = await run(this, req, staticData.p2sync, new Date().toISOString());
return [{ json: result }];
