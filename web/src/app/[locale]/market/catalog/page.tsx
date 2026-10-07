import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { num, price } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';
import { CarName, PriceState } from '@/components/car';
import type { PublicCar } from '@/lib/vehicles/types';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/market/catalog', dict(locale).catalog.h1);
}
const SORTS: Record<string, (a: PublicCar, b: PublicCar) => number> = {
  name: (a, b) => a.id.localeCompare(b.id),
  price: (a, b) => (a.price?.min ?? Infinity) - (b.price?.min ?? Infinity),
  regs: (a, b) => (b.registrations?.last12 ?? -1) - (a.registrations?.last12 ?? -1),
};

/* Full catalog: the dense table, kept one level deeper than Market (not the Market homepage). */
export default async function Catalog({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), c = t.catalog;
  const sp = await searchParams;
  const sort = typeof sp.sort === 'string' && SORTS[sp.sort] ? sp.sort : 'regs';
  const rows = [...vehicles().all()].sort((a, b) => SORTS[sort](a, b) || a.id.localeCompare(b.id));
  const th = (key: string, label: string) => (
    <th scope="col" aria-sort={sort === key ? (key === 'regs' ? 'descending' : 'ascending') : undefined}>
      <Link href={`/${locale}/market/catalog?sort=${key}`} style={{ color: 'inherit' }}>{label}</Link>
    </th>
  );
  return (
    <div className="wrap section" style={{ paddingBlockStart: 32 }}>
      <nav className="breadcrumb"><Link href={`/${locale}/market`}>{c.back}</Link></nav>
      <h1 className="h-page">{c.h1}</h1>
      <p className="small tnum">{num(rows.length)}</p>
      <div className="table-scroll"><table className="t">
        <thead><tr>{th('name', c.model)}<th scope="col">{c.body}</th>{th('price', c.from)}<th scope="col" className="t-num">{c.to}</th><th scope="col">{c.state}</th>{th('regs', c.regs)}</tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id}>
            <td><Link href={`/${locale}/cars/${r.id}`}><CarName car={r} locale={locale} /></Link></td>
            <td>{t.body[r.body]}</td>
            <td className="t-num">{r.price ? price(r.price.min, locale) : '—'}</td>
            <td className="t-num">{r.price && r.price.max !== r.price.min ? price(r.price.max, locale) : '—'}</td>
            <td><PriceState state={r.price ? r.price.state : 'unknown'} locale={locale} /></td>
            <td className="t-num">{r.registrations ? num(r.registrations.last12) : '—'}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
