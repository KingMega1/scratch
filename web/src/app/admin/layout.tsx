import '@/styles/carindex.tokens.css';
import '@/styles/site.css';
export const metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
/* Internal only. Reachable solely through middleware Basic auth; 404 when credentials are not configured. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" dir="ltr"><body>{children}</body></html>;
}
