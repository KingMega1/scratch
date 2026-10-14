import { z } from 'zod';
import { json, log, rateLimit, readJson } from '@/server/http/guard';
import { EG_MOBILE, EMAIL, identity } from '@/server/identity/provider';

export const dynamic = 'force-dynamic';
const Body = z.object({ channel: z.enum(['sms', 'email']), destination: z.string().max(254) }).strict();

/* Feature-gated. Input is validated but never logged or echoed. */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'otp', 5); if (limited) return limited;
  let raw: unknown;
  try { raw = await readJson(req, 1024); } catch { return json({ error: 'invalid_request' }, 400); }
  const p = Body.safeParse(raw);
  if (!p.success) return json({ error: 'invalid_request' }, 400);
  const dest = p.data.destination.replace(/[\s-]/g, '');
  if (p.data.channel === 'sms' ? !EG_MOBILE.test(dest) : !EMAIL.test(dest)) return json({ error: 'invalid_destination' }, 422);
  if (!identity().enabled()) { log('identity_gated', { channel: p.data.channel }); return json({ error: 'identity_disabled' }, 503); }
  return json(await identity().startOtp({ channel: p.data.channel, destination: dest }));
}
