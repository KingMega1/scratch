import { z } from 'zod';
import { json, log, rateLimit, readJson } from '@/server/http/guard';
import { FORBIDDEN_KEYS, WEB_EVENTS } from '@/lib/analytics/contract';
import { redact } from '@/lib/analytics/redact';

export const dynamic = 'force-dynamic';
/* EV3 collector boundary. Validates the envelope, drops forbidden (PII) keys, re-redacts free text.
   S1 sink: structured log line without props values (no warehouse yet). S2: forward to the analytics pipeline. */
const Envelope = z.object({
  event: z.string().max(40), schema: z.literal('EV3'), event_id: z.string().max(64), ts: z.string().max(40),
  session_id: z.string().max(64), anon_id: z.string().max(64), source_app: z.literal('web'),
  universe_version: z.string().max(40).nullable(), engine_version: z.string().max(40).nullable(),
  locale: z.string().max(5), route: z.string().max(40), journey_stage: z.string().max(20), props: z.record(z.unknown()),
}).passthrough();

export async function POST(req: Request) {
  const limited = rateLimit(req, 'events', 120); if (limited) return limited;
  let raw: unknown;
  try { raw = await readJson(req, 8192); } catch { return json({ error: 'invalid' }, 400); }
  const p = Envelope.safeParse(raw);
  if (!p.success || !(p.data.event in WEB_EVENTS)) return json({ error: 'invalid' }, 400);
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p.data.props)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    props[k] = typeof v === 'string' ? redact(v.slice(0, 200)).text_redacted : v;
  }
  log('ev3', { event: p.data.event, route: p.data.route, locale: p.data.locale, universe_version: p.data.universe_version, props_keys: Object.keys(props).join(',') });
  return json({ accepted: true }, 202);
}
