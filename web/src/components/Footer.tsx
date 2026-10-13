import Link from 'next/link';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { vehicles } from '@/server/vehicles/read-model';
import { brandName, sortBrands } from '@/components/brand';

/* Fat footer (Brand V2): logo on ink uses the white-with-yellow-brackets variant (rule F1). The data version stays
   machine-readable on the element for QA; it is not shown to customers. */
export default function Footer({ locale, dataVersion }: { locale: Locale; dataVersion: string }) {
  const t = dict(locale), f = t.footer, L = (p: string) => `/${locale}${p}`;
  const top = [...vehicles().brands()].sort((a, b) => b.registrations - a.registrations).slice(0, 8);
  return (
    <footer className="gf inverse" data-version={dataVersion}>
      <div className="wrap">
        <div className="gf-cols">
          <div className="gf-brand">
            <img src="/brand/carindex-logo-white-yellow.svg" alt="CarIndex" width={106} height={24} />
            <p>{f.about}</p>
            <p className="gf-tag">{t.tagline}</p>
          </div>
          <div><h2>{f.cols.cars}</h2><ul>
            <li><Link href={L('/find-my-car')}>{t.nav.fmc}</Link></li>
            <li><Link href={L('/cars')}>{f.browseAll}</Link></li>
            <li><Link href={L('/market')}>{t.nav.market}</Link></li>
            <li><Link href={L('/compare')}>{t.nav.compare}</Link></li>
            <li><Link href={L('/search')}>{t.nav.search}</Link></li>
          </ul></div>
          <div><h2>{f.cols.brands}</h2><ul>
            {sortBrands(top, locale).map(b => (
              <li key={b.id}><Link href={L(`/market/catalog?brand=${b.id}`)}>{locale === 'ar' && !b.ar ? <bdi>{brandName(b, locale)}</bdi> : brandName(b, locale)}</Link></li>
            ))}
            <li><Link href={L('/market/catalog')}>{f.allBrands}</Link></li>
          </ul></div>
          <div><h2>{f.cols.content}</h2><ul>
            <li><Link href={L('/news?type=news')}>{f.newsL}</Link></li>
            <li><Link href={L('/news?type=guide')}>{f.guidesL}</Link></li>
            <li><Link href={L('/news?type=insight')}>{f.insightsL}</Link></li>
            <li><Link href={L('/methodology')}>{f.methodology}</Link></li>
          </ul></div>
          <div><h2>{f.cols.company}</h2><ul>
            <li><Link href={L('/independence')}>{f.independence}</Link></li>
            <li><Link href={L('/about')}>{f.about2}</Link></li>
            <li><Link href={L('/contact')}>{f.contact}</Link></li>
            <li><Link href={L('/privacy')}>{f.privacy}</Link></li>
            <li><Link href={L('/terms')}>{f.terms}</Link></li>
          </ul></div>
        </div>
        <div className="gf-bottom">
          <span>{f.rights}</span>
          <span>{t.taglineShort}</span>
        </div>
      </div>
    </footer>
  );
}
