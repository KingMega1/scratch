import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/http/guard.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: m, exports: m.exports, require: () => ({}), TextDecoder });
const { readJson } = m.exports;
const encode = s => new TextEncoder().encode(s);
function request(chunks, length) {
  let cancelled = false, consumed = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (consumed < chunks.length) controller.enqueue(chunks[consumed++]);
      else controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return { req: { headers: new Headers(length === undefined ? {} : { 'content-length': String(length) }), body: stream },
    state: () => ({ cancelled, consumed }) };
}
test('JSON limit counts UTF-8 bytes without trusting absent or understated length', async () => {
  const body = encode(JSON.stringify({ text: 'ع'.repeat(20) }));
  assert.ok(body.byteLength > 40);
  for (const length of [undefined, 1]) {
    const { req, state } = request([body], length);
    await assert.rejects(readJson(req, 40), /too_large/);
    assert.equal(state().cancelled, true);
  }
});
test('oversized chunked JSON cancels before draining remaining chunks', async () => {
  const { req, state } = request([encode('{"x":"'), encode('a'.repeat(50)), encode('must not read')]);
  await assert.rejects(readJson(req, 20), /too_large/);
  assert.deepEqual(state(), { cancelled: true, consumed: 2 });
});
test('valid JSON at byte boundary decodes split multi-byte UTF-8 characters', async () => {
  const expected = { text: 'عربية' }, body = encode(JSON.stringify(expected));
  const { req } = request([...body].map(b => Uint8Array.of(b)));
  assert.deepEqual(JSON.parse(JSON.stringify(await readJson(req, body.byteLength))), expected);
});
test('declared oversized JSON is rejected without reading its body', async () => {
  const { req, state } = request([encode('{}')], 100);
  await assert.rejects(readJson(req, 20), /too_large/);
  assert.equal(state().consumed, 0);
});
test('invalid or absent JSON retains parse rejection', async () => {
  await assert.rejects(readJson(request([encode('invalid')]).req));
  await assert.rejects(readJson({ headers: new Headers(), body: null }));
});
