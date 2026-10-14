import type { Locale } from '@/lib/i18n/config';
import { num } from '@/lib/format';
import { scopeText, type BrochureLink, type ContentSource, type GalleryImage, type SpecRow, type WarrantyItem } from '@/server/vehicles/p2-content';

/* Customer-facing P2 content blocks for the car detail page (EN/AR). Every value carries its trim scope and named source. */
const T = {
  en: {
    specCol: 'Specification', valueCol: 'Value', scopeCol: 'Applies to', srcCol: 'Source',
    byTrim: 'Varies by trim', differ: 'Sources give different values',
    specNote: 'Each value is shown with the trims and the source it comes from. Where sources disagree, every value is shown; none is picked for you.',
    warrantyH: 'Warranty', warrantyNote: 'Shown as published by each source. Coverage can differ by trim and conditions apply; confirm the terms for your exact trim with the dealer.',
    kinds: { vehicle: 'Vehicle warranty', battery: 'High-voltage battery warranty', 'range-extender': 'Range-extender system warranty', extended: 'Extended warranty', maintenance: 'Free maintenance (service offer, not a warranty)' },
    years: (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`, upTo: 'Up to', terms: 'Terms apply',
    galleryH: 'Photos', galleryLabel: 'Photo gallery, scroll sideways', open: 'Open full size', photoBy: 'Photo:',
    brochureH: 'Official brochures', brochureNote: 'Opens the document on the publisher’s site. Dates and trim coverage are as stated in each document; equipment varies by trim.',
    openPdf: 'Open official brochure (PDF)', covers: 'Covers:',
  },
  ar: {
    specCol: 'المواصفة', valueCol: 'القيمة', scopeCol: 'تنطبق على', srcCol: 'المصدر',
    byTrim: 'تختلف حسب الفئة', differ: 'المصادر بتدّي قيم مختلفة',
    specNote: 'كل قيمة معروضة مع الفئات والمصدر اللي جاية منه. لو المصادر مختلفة بنعرض كل القيم ومبنختارش قيمة بدالك.',
    warrantyH: 'الضمان', warrantyNote: 'معروض زي ما نشره كل مصدر. التغطية ممكن تختلف حسب الفئة وفيه شروط؛ اتأكد من شروط فئتك بالظبط مع الموزع.',
    kinds: { vehicle: 'ضمان السيارة', battery: 'ضمان بطارية الجهد العالي', 'range-extender': 'ضمان نظام موسّع المدى', extended: 'ضمان ممتد', maintenance: 'صيانة مجانية (عرض خدمة، مش ضمان)' },
    years: (n: number) => (n === 2 ? 'سنتين' : `${n} ${n >= 3 && n <= 10 ? 'سنوات' : 'سنة'}`), upTo: 'حتى', terms: 'تطبق الشروط',
    galleryH: 'الصور', galleryLabel: 'معرض الصور، اسحب للجنب', open: 'افتح بالحجم الكامل', photoBy: 'مصدر الصورة:',
    brochureH: 'الكتالوجات الرسمية', brochureNote: 'بيفتح المستند على موقع الناشر. التواريخ والفئات زي ما هي مذكورة في كل مستند؛ التجهيزات تختلف حسب الفئة.',
    openPdf: 'افتح الكتالوج الرسمي (PDF)', covers: 'يغطي:',
  },
};

function Sources({ sources }: { sources: ContentSource[] }) {
  return <>{sources.map((s, i) => (
    <span key={i}>{i ? ', ' : ''}{s.url ? <a href={s.url} rel="nofollow noopener noreferrer" target="_blank"><bdi>{s.name}</bdi></a> : <bdi>{s.name}</bdi>}</span>
  ))}</>;
}

export function SpecTable({ rows, locale }: { rows: SpecRow[]; locale: Locale }) {
  const t = T[locale];
  return (
    <>
      <div className="table-scroll" role="region" aria-label={t.specCol} tabIndex={0}><table className="t spec-t" data-p2-specs={rows.length}>
        <thead><tr><th scope="col">{t.specCol}</th><th scope="col">{t.valueCol}</th><th scope="col">{t.scopeCol}</th><th scope="col">{t.srcCol}</th></tr></thead>
        <tbody>{rows.flatMap(r => r.lines.map((l, i) => (
          <tr key={`${r.field}-${i}`} data-spec={r.field} data-variation={r.variation}>
            {i === 0 ? <th scope="row" rowSpan={r.lines.length}>{r.label[locale]}{r.variation !== 'none'
              ? <div><span className={`state ${r.variation === 'sources-differ' ? 'state-conflict' : 'state-near'}`}>{r.variation === 'sources-differ' ? t.differ : t.byTrim}</span></div> : null}</th> : null}
            <td className="spec-v"><bdi>{l.value}</bdi></td>
            <td className="small">{l.scopes.map((s, j) => <div key={j}><bdi>{scopeText(s, locale)}</bdi></div>)}</td>
            <td className="small"><Sources sources={l.sources} /></td>
          </tr>
        )))}</tbody>
      </table></div>
      <p className="small">{t.specNote}</p>
    </>
  );
}

export function WarrantyBlock({ items, locale }: { items: WarrantyItem[]; locale: Locale }) {
  const t = T[locale];
  const terms = (w: WarrantyItem) => [w.years != null ? t.years(w.years) : null, w.km != null ? `${num(w.km)} ${locale === 'ar' ? 'كم' : 'km'}` : null].filter(Boolean).join(' / ');
  return (
    <section className="cd-section" aria-labelledby="warranty-h" data-warranty-items={items.length}>
      <h2 id="warranty-h" className="h-section">{t.warrantyH}</h2>
      <div className="grid grid-2">{items.map((w, i) => (
        <div className="card warranty" key={i} data-warranty-kind={w.kind}>
          <h3>{t.kinds[w.kind]}</h3>
          <div className="cd-price tnum">{w.upTo ? `${t.upTo} ` : ''}{terms(w)}</div>
          {w.termsApply ? <div className="small">{t.terms}</div> : null}
          <div className="small">{t.scopeCol}: {w.scopes.map((s, j) => <span key={j}>{j ? '; ' : ''}<bdi>{scopeText(s, locale)}</bdi></span>)}</div>
          <div className="small">{t.srcCol}: <Sources sources={w.sources} /></div>
        </div>
      ))}</div>
      <p className="small">{t.warrantyNote}</p>
    </section>
  );
}

const WIDTHS = [384, 640, 828, 1200];
export function Gallery({ images, name, locale }: { images: GalleryImage[]; name: string; locale: Locale }) {
  const t = T[locale];
  return (
    <section className="cd-section" aria-labelledby="gallery-h" data-gallery-count={images.length}>
      <h2 id="gallery-h" className="h-section">{t.galleryH}</h2>
      <div className="gallery-scroll" role="region" aria-label={t.galleryLabel} tabIndex={0}><ul className="gallery">{images.map((g, i) => {
        // never request a variant wider than the served file (no upscaling)
        const ws = WIDTHS.filter(w => w < g.width).concat(Math.min(g.width, 1920));
        return (
          <li key={g.src}>
            <figure>
              <a href={g.src} target="_blank" rel="noopener" aria-label={`${t.open}: ${name} ${i + 1}`}>
                <img src={g.src} srcSet={ws.map(w => `/_next/image?url=${encodeURIComponent(g.src)}&w=${w}&q=80 ${w}w`).join(', ')}
                  sizes="(max-width: 720px) 85vw, 440px" width={g.width} height={g.height} alt={`${name} ${i + 1}`}
                  loading="lazy" decoding="async" data-gallery-image="true" />
              </a>
              {g.credit ? <figcaption className="small">{t.photoBy} {g.page ? <a href={g.page} rel="nofollow noopener noreferrer" target="_blank"><bdi>{g.credit}</bdi></a> : <bdi>{g.credit}</bdi>}</figcaption> : null}
            </figure>
          </li>
        );
      })}</ul></div>
    </section>
  );
}

export function Brochures({ items, modelId, locale }: { items: BrochureLink[]; modelId: string; locale: Locale }) {
  const t = T[locale];
  return (
    <section className="cd-section" aria-labelledby="brochure-h" data-brochure-model-id={modelId} data-brochure-count={items.length}>
      <h2 id="brochure-h" className="h-section">{t.brochureH}</h2>
      <ul className="brochures">{items.map(b => (
        <li key={b.url} data-brochure-title={b.title}>
          <a className="btn btn-ghost" href={b.url} target="_blank" rel="noopener noreferrer">{t.openPdf}</a>
          <div className="small"><bdi>{b.issuer}</bdi> · <bdi>{b.host}</bdi>{b.scope ? <> · {t.covers} <bdi>{b.scope}</bdi></> : null}</div>
        </li>
      ))}</ul>
      <p className="small">{t.brochureNote}</p>
    </section>
  );
}
