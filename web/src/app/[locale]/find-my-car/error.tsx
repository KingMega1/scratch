'use client';
import { useParams } from 'next/navigation';
import { dict } from '@/lib/i18n/dictionaries';
import { isLocale } from '@/lib/i18n/config';

export default function FmcError({ reset }: { error: Error; reset: () => void }) {
  const p = useParams<{ locale: string }>();
  const f = dict(isLocale(p?.locale) ? p.locale : 'ar').fmc;
  return (
    <div className="wrap section fmc-shell">
      <div className="state-panel" role="alert"><p style={{ margin: 0 }}>{f.error}</p><div><button className="btn btn-ghost" onClick={reset}>{f.retry}</button></div></div>
    </div>
  );
}
