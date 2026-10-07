import 'server-only';
import { NextResponse } from 'next/server';

/* Rate-limit-ready API boundary. S1: per-instance in-memory token bucket (best effort on serverless).
   S3: swap the store for a shared one (e.g. Redis/Upstash) without changing call sites. */
type Bucket = { tokens: number; at: number };
const buckets = new Map<string, Bucket>();

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || req.headers.get('x-real-ip') || 'anon';
}

export function rateLimit(req: Request, name: string, perMinute: number): NextResponse | null {
  const key = `${name}:${clientKey(req)}`;
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, at: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute);
  b.at = now;
  if (b.tokens < 1) { buckets.set(key, b); return json({ error: 'rate_limited' }, 429, { 'Retry-After': '30' }); }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) for (const k of [...buckets.keys()].slice(0, 5_000)) buckets.delete(k);
  return null;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/* Sanitized logging: structured, no request bodies, no PII, no query strings. */
export function log(event: string, fields: Record<string, string | number | boolean | null> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

export async function readJson(req: Request, maxBytes = 16_384): Promise<unknown> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw new Error('too_large');
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('too_large');
  return JSON.parse(text);
}
