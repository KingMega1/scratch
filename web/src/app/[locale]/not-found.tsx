import Link from 'next/link';
import { dict } from '@/lib/i18n/dictionaries';

/* Rendered inside the locale layout; the layout already set lang/dir. Bilingual text keeps it locale-safe. */
export default function NotFound() {
  const ar = dict('ar').notFound, en = dict('en').notFound;
  return (
    <div className="wrap section prose" style={{ paddingBlockStart: 48 }}>
      <h1 className="h-page">{ar[0]} · <span lang="en">{en[0]}</span></h1>
      <p>{ar[1]}</p>
      <p lang="en" dir="ltr">{en[1]}</p>
      <p className="chips"><Link className="btn btn-primary" href="/ar">الرئيسية</Link><Link className="btn btn-ghost" href="/en">Home</Link></p>
    </div>
  );
}
