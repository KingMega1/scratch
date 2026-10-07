import { json, rateLimit } from '@/server/http/guard';
import { vehicles } from '@/server/vehicles/read-model';

export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ brand: string; model: string }> }) {
  const limited = rateLimit(req, 'car', 240); if (limited) return limited;
  const { brand, model } = await params;
  const id = `${brand}/${model}`;
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(id)) return json({ error: 'invalid_id' }, 400);
  const car = vehicles().get(id);
  if (!car) return json({ error: 'not_found' }, 404);
  const m = vehicles().meta();
  return json({ registry_version: m.registry_version, snapshot_id: m.snapshot_id, car });
}
