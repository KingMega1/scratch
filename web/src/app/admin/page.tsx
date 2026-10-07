import { vehicles } from '@/server/vehicles/read-model';
import { p1EngineInfo, verifyP1Vendor } from '@/server/p1/loader';
import manifest from '@data/registry/sync-manifest.json';
import { notFound } from 'next/navigation';

export default function Admin() {
  // Defense in depth: if the middleware is ever bypassed or misconfigured, an unconfigured admin still does not exist.
  if (!process.env.ADMIN_BASIC_AUTH_USER || !process.env.ADMIN_BASIC_AUTH_PASS) notFound();
  const m = vehicles().meta();
  const p1 = p1EngineInfo();
  return (
    <div className="wrap section">
      <h1>Internal status</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ registry: m, sync: manifest, p1: { ...p1, integrity: verifyP1Vendor() } }, null, 2)}</pre>
    </div>
  );
}
