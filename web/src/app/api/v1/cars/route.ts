import { json, rateLimit } from '@/server/http/guard';
import { parseCarQuery, queryCars } from '@/server/vehicles/query';
import { vehicles } from '@/server/vehicles/read-model';

export const dynamic = 'force-dynamic';
/* Shaped, read-only vehicle list for clients. Same public shape as the pages render. */
export function GET(req: Request) {
  const limited = rateLimit(req, 'cars', 120); if (limited) return limited;
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const r = queryCars(parseCarQuery(sp));
  const m = vehicles().meta();
  return json({ registry_version: m.registry_version, snapshot_id: m.snapshot_id, ...r });
}
