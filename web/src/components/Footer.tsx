import Link from 'next/link';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';

export default function Footer({ locale, dataVersion }: { locale: Locale; dataVersion: string }) {
  const t = dict(locale), f = t.footer, L = (p: string) => `/${locale}${p}`;
  return (
    <footer className="gf inverse">
      <div className="wrap">
        <div className="gf-cols">
          <div className="gf-brand">
            <img src="/brand/carindex-logo-white.svg" alt="CarIndex" width={97} height={22} />
            <p>{f.about}</p>
          </div>
          <div><h2>{f.cols.cars}</h2><ul>
            <li><Link href={L('/cars')}>{f.browseAll}</Link></li>
            <li><Link href={L('/market#brands')}>{f.byBrand}</Link></li>
            <li><Link href={L('/market#body')}>{f.byBody}</Link></li>
            <li><Link href={L('/market#new')}>{f.launches}</Link></li>
          </ul></div>
          <div><h2>{f.cols.tools}</h2><ul>
            <li><Link href={L('/find-my-car')}>{t.nav.fmc}</Link></li>
            <li><Link href={L('/compare')}>{t.nav.compare}</Link></li>
            <li><Link href={L('/market')}>{f.marketPrices}</Link></li>
            <li><Link href={L('/search')}>{t.nav.search}</Link></li>
          </ul></div>
          <div><h2>{f.cols.content}</h2><ul>
            <li><Link href={L('/news?type=news')}>{f.newsL}</Link></li>
            <li><Link href={L('/news?type=guide')}>{f.guidesL}</Link></li>
            <li><Link href={L('/news?type=insight')}>{f.insightsL}</Link></li>
          </ul></div>
          <div><h2>{f.cols.company}</h2><ul>
            <li><Link href={L('/methodology')}>{f.methodology}</Link></li>
            <li><Link href={L('/independence')}>{f.independence}</Link></li>
            <li><Link href={L('/about')}>{f.about2}</Link></li>
            <li><Link href={L('/contact')}>{f.contact}</Link></li>
            <li><Link href={L('/privacy')}>{f.privacy}</Link></li>
            <li><Link href={L('/terms')}>{f.terms}</Link></li>
          </ul></div>
        </div>
        <div className="gf-bottom">
          <span>{f.rights} · {t.tagline}</span>
          <span className="tnum">{f.data(dataVersion)}</span>
        </div>
      </div>
    </footer>
  );
}
