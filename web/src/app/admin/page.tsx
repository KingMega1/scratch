import { vehicles } from '@/server/vehicles/read-model';
import { release, BOUND } from '@/server/p1/release';
import manifest from '@data/registry/sync-manifest.json';
import { notFound } from 'next/navigation';

export default function Admin() {
  // Defense in depth: if the middleware is ever bypassed or misconfigured, an unconfigured admin still does not exist.
  if (!process.env.ADMIN_BASIC_AUTH_USER || !process.env.ADMIN_BASIC_AUTH_PASS) notFound();
  const m = vehicles().meta();
  const r = release();
  const p1 = { bound: BOUND, ok: r.ok, checks: r.checks, error: r.ok ? null : r.error };
  return (
    <div className="wrap section">
      <h1>Internal status</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ registry: m, sync: manifest, p1 }, null, 2)}</pre>
    </div>
  );
}
