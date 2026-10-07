import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { identity } from '@/server/identity/provider';
import VerifyForm from '@/components/VerifyForm';
import Link from 'next/link';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/my-carindex', dict(locale).account.h1, undefined, { noindex: true });
}
const TABS = ['recs', 'saved', 'comparisons', 'shared', 'invites', 'profile'] as const;

/* Account shell. No customer data is read or stored in S1; identity is feature-gated server-side. */
export default async function MyCarIndex({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const a = dict(locale).account;
  const sp = await searchParams;
  const tab = TABS.find(x => x === sp.tab) ?? 'recs';
  const enabled = identity().enabled();
  const empty = tab === 'recs' ? a.emptyRecs : tab === 'saved' ? a.emptySaved : a.emptyGeneric;
  return (
    <div className="wrap section" style={{ paddingBlockStart: 32 }}>
      <h1 className="h-page">{a.h1}</h1>
      <div className="acct" style={{ marginBlockStart: 16 }}>
        <nav className="acct-nav" aria-label={a.h1}>
          {TABS.map(x => <Link key={x} href={`/${locale}/my-carindex?tab=${x}`} aria-current={tab === x ? 'page' : undefined}>{a.nav[x]}</Link>)}
        </nav>
        <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
          <section className="card" aria-labelledby="v-h">
            <h2 id="v-h" style={{ marginBlockStart: 0 }}>{a.verifyH}</h2>
            <p className="sub">{a.verifyBody}</p>
            <VerifyForm locale={locale} enabled={enabled} />
          </section>
          <section aria-labelledby="tab-h">
            <h2 id="tab-h" className="h-section">{a.nav[tab]}</h2>
            <div className="slot-empty">{empty}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
