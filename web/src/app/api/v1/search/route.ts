import { json, rateLimit } from '@/server/http/guard';
import { search } from '@/server/search/index';
import { isLocale } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const limited = rateLimit(req, 'search', 60); if (limited) return limited;
  const u = new URL(req.url);
  const q = (u.searchParams.get('q') || '').slice(0, 120);
  const l = u.searchParams.get('locale');
  return json(await search(q, isLocale(l) ? l : 'ar'));
}
