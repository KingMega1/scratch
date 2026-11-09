import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { date, price } from '@/lib/format';
import { priceView, type PartPrice as Price } from '@/lib/spare-parts/model';

/* One price state per part. A figure appears only for a sourced dealer price or a dated confirmation (priceView);
   unknown and conflicting prices show no number. Conflict red / checked green are used only for these states. */
export default function PartPrice({ value, locale }: { value: Price; locale: Locale }) {
  const p = dict(locale).parts, v = priceView(value);
  return (
    <div className="pp" data-price-state={v.state}>
      <span className={`pp-state pp-${v.state}`}>{p.state[v.state]}</span>
      {v.state === 'dealer' ? (
        <>
          <span className="pp-figure tnum" data-price-figure="true">{price(v.figure, locale)}</span>
          <span className="small">{p.source}: {v.source.url ? <a href={v.source.url} rel="nofollow noopener noreferrer" target="_blank">{v.source.name}</a> : v.source.name}</span>
        </>
      ) : v.state === 'confirmed' ? (
        <>
          <span className="pp-figure tnum" data-price-figure="true">{price(v.figure, locale)}</span>
          <span className="small"><time dateTime={v.date}>{date(v.date, locale)}</time></span>
        </>
      ) : <span className="pp-none" aria-hidden="true">—</span>}
    </div>
  );
}
