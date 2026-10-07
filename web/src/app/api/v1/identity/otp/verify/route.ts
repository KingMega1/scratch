import { z } from 'zod';
import { json, rateLimit, readJson } from '@/server/http/guard';
import { identity } from '@/server/identity/provider';

export const dynamic = 'force-dynamic';
const Body = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{4,8}$/) }).strict();

export async function POST(req: Request) {
  const limited = rateLimit(req, 'otp-verify', 10); if (limited) return limited;
  let raw: unknown;
  try { raw = await readJson(req, 512); } catch { return json({ error: 'invalid_request' }, 400); }
  if (!Body.safeParse(raw).success) return json({ error: 'invalid_request' }, 400);
  if (!identity().enabled()) return json({ error: 'identity_disabled' }, 503);
  return json({ error: 'not_implemented' }, 501);
}
