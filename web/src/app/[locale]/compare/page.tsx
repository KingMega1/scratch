import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { num } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';
import { CarMedia, CarName, OfficialFigure, PriceFrom, PriceState, carNameText } from '@/components/car';
import TrackOnMount from '@/components/TrackOnMount';
import type { PublicCar } from '@/lib/vehicles/types';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMeta(locale, '/compare', dict(locale).compare.h1, dict(locale).compare.lede);
}

/* Compare shell: facts side by side, gaps shown as gaps. No winner marks: there is no buyer brief on this page. */
export default async function Compare({ params, searchParams }: P) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const t = dict(locale), c = t.compare;
  const sp = await searchParams;
  const raw = [typeof sp.ids === 'string' ? sp.ids : '', ...(['a', 'b', 'c'] as const).map(k => (typeof sp[k] === 'string' ? sp[k] : ''))].join(',');
  const V = vehicles();
  const ids = [...new Set(raw.split(',').map(s => s.trim()).filter(s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)))].filter(id => V.get(id)).slice(0, 3);
  const cars = ids.map(id => V.get(id)!) as PublicCar[];
  const options = [...V.all()].sort((a, b) => carNameText(a, locale).localeCompare(carNameText(b, locale)));
  const dash = <span className="state state-unknown">{t.state.unknown}</span>;
  const top = (x: PublicCar) => x.trims.at(-1);
  const spec = (x: PublicCar, k: string) => x.specs[k] ? <>{x.specs[k].values.map((v, i) => <div key={i}><bdi>{v.value}</bdi></div>)}</> : dash;
  const rows: [string, (car: PublicCar) => React.ReactNode][] = [
    [c.rows.from, x => <PriceFrom car={x} locale={locale} />],
    [c.rows.to, x => top(x) ? <OfficialFigure o={top(x)!.official} locale={locale} /> : dash],
    [c.rows.state, x => <PriceState state={x.priceFrom.state} locale={locale} />],
    [c.rows.versions, x => x.trims.length ? <span className="tnum">{x.trims.length}</span> : dash],
    [c.rows.pt, x => x.powertrains.length ? x.powertrains.map(p => t.pt[p]).join(' / ') : dash],
    [c.rows.hp, x => spec(x, 'horsepower')],
    [t.car.spec.engine_capacity, x => spec(x, 'engine_capacity')],
    [t.car.spec.transmission, x => spec(x, 'transmission')],
    [c.rows.drive, x => spec(x, 'drive_type')],
    [c.rows.seats, x => spec(x, 'seats')],
    [c.rows.warranty, x => spec(x, 'warranty')],
    [c.rows.regs, x => x.registrations?.inWindow != null ? <span className="tnum">{num(x.registrations.inWindow)}</span> : dash],
  ];
  const slot = (i: number) => (
    <div className="field" key={i}>
      <label htmlFor={`cmp-${i}`}>{c.pick} {i + 1}</label>
      <select id={`cmp-${i}`} name={['a', 'b', 'c'][i]} defaultValue={ids[i] ?? ''}>
        <option value="">{c.choose}</option>
        {options.map(o => <option key={o.id} value={o.id}>{carNameText(o, locale)}</option>)}
      </select>
    </div>
  );

  return (
    <div className="wrap section" style={{ paddingBlockStart: 32 }}>
      {cars.length ? <TrackOnMount event="compare_view" props={{ model_ids: ids }} /> : null}
      <h1 className="h-page">{c.h1}</h1>
      <p className="lede">{c.lede}</p>
      <form className="cmp-picker" action={`/${locale}/compare`} method="get" style={{ alignItems: 'end' }}>
        {[0, 1, 2].map(slot)}
        <button className="btn btn-primary" type="submit">{c.add}</button>
      </form>
      {cars.length < 2 ? <div className="notice" style={{ marginBlockEnd: 20 }}>{c.empty}</div> : null}
      {cars.length ? (
        <div className="cmp-wrap">
          <table className="cmp">
            <thead><tr><td />{cars.map(x => (
              <th key={x.id} scope="col" className="cmp-car">
                <CarMedia car={x} locale={locale} />
                <Link href={`/${locale}/cars/${x.id}`}><CarName car={x} locale={locale} /></Link>
                <div><Link className="small" href={`/${locale}/compare?ids=${ids.filter(i => i !== x.id).join(',')}`}>{c.remove}</Link></div>
              </th>))}</tr></thead>
            <tbody>{rows.map(([label, f]) => (
              <tr key={label}><th scope="row">{label}</th>{cars.map(x => <td key={x.id}>{f(x)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {cars.length >= 2 ? (
        <div className="notice" style={{ marginBlockStart: 20 }}>{c.noWinner} <Link className="link" href={`/${locale}/find-my-car`}>{t.nav.fmc}</Link></div>
      ) : null}
    </div>
  );
}
