import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { pageMeta } from '@/lib/seo';
import { recommendationProvider } from '@/server/recommendation/provider';
import TrackOnMount from '@/components/TrackOnMount';

type P = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // Scaffold-only while the provider is blocked: keep it out of search indexes until the P1 PASS.
  return pageMeta(locale, '/find-my-car', dict(locale).fmc.h1, dict(locale).fmc.lede, { noindex: recommendationProvider().status().status !== 'ready' });
}
export const dynamic = 'force-dynamic';

/* FIND MY CAR — SCAFFOLD ONLY (WEB-LAUNCH-01 scope correction, P1-P3-INTEGRATION-REVIEW-01 = FAIL/REWORK).
   Implemented: route, layout shell, blocked/loading/error states, server-side provider boundary, typed contract.
   Blocked until "P3 semantic delta -> P1 delta re-review -> PASS": guided journey, free-text entry, confirmation,
   result states (clear/lean/tie), WHY binding, alternatives, why-not-others, confidence wording, result->Compare logic.
   Component boundaries for those live in src/components/fmc/* as typed, empty slots. */
export default async function FindMyCar({ params }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), f = t.fmc;
  const status = recommendationProvider().status();
  return (
    <div className="wrap section fmc-shell" style={{ paddingBlockStart: 32 }} data-fmc-status={status.status} data-engine-version={status.engine_version ?? ''} data-universe-version={status.universe_version}>
      <TrackOnMount event="fmc_view" props={{}} />
      <h1 className="h-page">{f.h1}</h1>
      <p className="lede">{f.lede}</p>
      {status.status === 'blocked' ? (
        <section className="state-panel" aria-labelledby="fmc-blocked-h" role="status">
          <h2 id="fmc-blocked-h" style={{ margin: 0 }}>{f.blockedH}</h2>
          <p className="sub" style={{ margin: 0 }}>{f.blockedBody}</p>
          <div className="chips">
            <Link className="btn btn-primary" href={`/${locale}/cars`}>{f.ctaCars}</Link>
            <Link className="btn btn-ghost" href={`/${locale}/compare`}>{f.ctaCompare}</Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
