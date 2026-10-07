import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { recommendationStatus } from '@/server/recommendation/provider';
import TrackOnMount from '@/components/TrackOnMount';
import FindMyCar from '@/components/fmc/FindMyCar';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // Kept noindex (P5 launch policy: FMC and account pages stay out of search indexes).
  return pageMeta(locale, '/find-my-car', dict(locale).fmc.h1, dict(locale).fmc.lede, { noindex: true });
}
export const dynamic = 'force-dynamic';

/* FIND MY CAR — bound to the P1 release P1-RELEASE-T1 (transport T1-2026-10-07, engine E6-2026-09-28, universe U11-2026-09-26).
   The tool UI (src/components/fmc/FindMyCar.tsx) renders P1 engine-owned copy and ci.reco.v1 only.
   If the release binding fails verification the page shows the blocked state; there is no fallback. */
export default async function FindMyCarPage({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), f = t.fmc;
  const status = recommendationStatus();
  const sp = await searchParams;
  const r = typeof sp.r === 'string' && /^[A-Za-z0-9_-]{1,4000}$/.test(sp.r) ? sp.r : null;
  return (
    <div className="wrap section fmc-shell" style={{ paddingBlockStart: 32 }} data-fmc-status={status.status} data-engine-version={status.engine_version ?? ''} data-universe-version={status.universe_version ?? ''}
      data-transport-version={status.status === 'ready' ? status.transport_version : ''} data-release={status.status === 'ready' ? status.record : ''}>
      <TrackOnMount event="fmc_view" props={{}} />
      <h1 className="h-page">{f.h1}</h1>
      <p className="lede">{f.lede}</p>
      {status.status === 'ready' ? (
        <FindMyCar locale={locale} shareToken={r} site={{ carPage: f.carPage, compareOnSite: f.compareOnSite, notOnSite: f.notOnSite, loading: f.loading, error: f.error, retry: f.retry }} />
      ) : (
        <section className="state-panel" aria-labelledby="fmc-blocked-h" role="status">
          <h2 id="fmc-blocked-h" style={{ margin: 0 }}>{f.blockedH}</h2>
          <p className="sub" style={{ margin: 0 }}>{f.blockedBody}</p>
          <div className="chips">
            <Link className="btn btn-primary" href={`/${locale}/cars`}>{f.ctaCars}</Link>
            <Link className="btn btn-ghost" href={`/${locale}/compare`}>{f.ctaCompare}</Link>
          </div>
        </section>
      )}
    </div>
  );
}
