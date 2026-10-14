import type React from 'react';
import type { Locale } from '@/lib/i18n/config';
import { num } from '@/lib/format';
import type { P2Content, P2Fact } from '@/lib/vehicles/types';
import { photoSrcSet } from '@/components/car';

/* P2-accepted customer content on the car page: specs, warranty, gallery, brochures.
   Everything shown is an accepted value with its scope (trim) and named source; unknown keys never reach the page. */

const LABEL: Record<string, [string, string]> = {
  power_hp: ['Power', 'القوة'], system_power_hp: ['System power', 'القوة الكلية'], system_power_kw: ['System power', 'القوة الكلية'],
  motor_power_hp: ['Electric motor power', 'قوة المحرك الكهربائي'], motor_power_kw: ['Electric motor power', 'قوة المحرك الكهربائي'],
  torque_nm: ['Torque', 'العزم'], system_torque_nm: ['System torque', 'العزم الكلي'], motor_torque_nm: ['Electric motor torque', 'عزم المحرك الكهربائي'],
  engine: ['Engine', 'المحرك'], engine_cc: ['Engine capacity', 'سعة المحرك'], engine_l: ['Engine capacity', 'سعة المحرك'], cylinders: ['Cylinders', 'عدد السلندرات'],
  transmission: ['Transmission', 'ناقل الحركة'], drive: ['Drive', 'الدفع'], accel_0_100_s: ['0–100 km/h', 'التسارع 0–100 كم/س'], top_speed_kmh: ['Top speed', 'السرعة القصوى'],
  fuel_consumption_l100: ['Fuel consumption', 'استهلاك الوقود'], battery_kwh: ['Battery', 'البطارية'], ev_range_km: ['Electric range', 'المدى الكهربائي'],
  total_range_km: ['Total range', 'المدى الإجمالي'], energy_consumption_kwh100: ['Energy consumption', 'استهلاك الطاقة'],
  max_ac_kw: ['AC charging', 'الشحن العادي (AC)'], max_dc_kw: ['DC fast charging', 'الشحن السريع (DC)'],
  length_mm: ['Length', 'الطول'], width_mm: ['Width', 'العرض'], height_mm: ['Height', 'الارتفاع'], wheelbase_mm: ['Wheelbase', 'قاعدة العجلات'],
  ground_clearance_mm: ['Ground clearance', 'الخلوص الأرضي'], kerb_weight_kg: ['Kerb weight', 'الوزن الفارغ'], seats: ['Seats', 'عدد المقاعد'],
  boot_l: ['Boot', 'سعة الشنطة'], boot_max_l: ['Boot (max)', 'أقصى سعة للشنطة'], fuel_tank_l: ['Fuel tank', 'خزان الوقود'], wheels_in: ['Wheels', 'مقاس الجنوط'], airbags: ['Airbags', 'الوسائد الهوائية'],
};
const UNIT: Record<string, [string, string]> = {
  mm: ['mm', 'مم'], hp: ['hp', 'حصان'], kw: ['kW', 'كيلوواط'], nm: ['Nm', 'نيوتن متر'], cc: ['cc', 'سي سي'], l: ['L', 'لتر'], s: ['s', 'ثانية'],
  kmh: ['km/h', 'كم/س'], l100: ['L/100 km', 'لتر/100 كم'], kwh: ['kWh', 'ك.و.س'], km: ['km', 'كم'], kwh100: ['kWh/100 km', 'ك.و.س/100 كم'], kg: ['kg', 'كجم'], in: ['in', 'بوصة'],
};
const KEY_UNIT = (k: string) => k.endsWith('_kwh100') ? 'kwh100' : k.endsWith('_l100') ? 'l100' : k.endsWith('_kmh') ? 'kmh' : (k.match(/_(mm|hp|kw|nm|cc|l|s|kwh|km|kg|in)$/)?.[1] ?? null);
const SIMPLE = new Set(['', 'mm', 'hp', 'l', 'nm', 'count', 'kg', 'cc', 'kw', 's', 'km/h', 'in', 'kwh', 'km']);

function Value({ k, f, locale }: { k: string; f: P2Fact; locale: Locale }) {
  const ar = locale === 'ar';
  const numeric = /^\d+(\.\d+)?$/.test(f.value);
  const u = KEY_UNIT(k);
  const qualifier = SIMPLE.has(f.unit.toLowerCase()) ? null : f.unit; // e.g. "km WLTP combined" stays as the source wrote it
  return (
    <>
      {numeric ? <span className="tnum">{num(Number(f.value))}</span> : <bdi>{f.value}</bdi>}
      {u && UNIT[u] && !qualifier ? <> {UNIT[u][ar ? 1 : 0]}</> : null}
      {qualifier ? <> <bdi>{qualifier}</bdi></> : null}
    </>
  );
}

const T = {
  en: { scope: 'Applies to', all: 'Stated for the model', source: 'Source', specsNote: 'Figures differ between versions where shown; each is listed with the versions it applies to.',
    wH: 'Warranty', vehicle: 'Vehicle warranty', battery: 'Battery warranty', wNote: 'Terms can differ by version and by dealer. Confirm the warranty for your exact version before you buy.',
    gH: 'Photos', all_: (n: number) => `Show all ${n} photos`, photo: (n: number) => `photo ${n}`, credit: 'Photos',
    bH: 'Official brochures', open: 'Open brochure', bNote: 'Brochures are published by the brand’s Egypt distributor. Equipment varies by version; check the version table.' },
  ar: { scope: 'ينطبق على', all: 'مذكور للموديل', source: 'المصدر', specsNote: 'لو الأرقام بتختلف بين الفئات، كل رقم مكتوب جنبه الفئات اللي ينطبق عليها.',
    wH: 'الضمان', vehicle: 'ضمان العربية', battery: 'ضمان البطارية', wNote: 'شروط الضمان ممكن تختلف حسب الفئة والوكيل. اتأكد من ضمان الفئة اللي هتشتريها قبل الشراء.',
    gH: 'صور', all_: (n: number) => `عرض كل الصور (${n})`, photo: (n: number) => `صورة ${n}`, credit: 'الصور',
    bH: 'الكتالوجات الرسمية', open: 'افتح الكتالوج', bNote: 'الكتالوجات صادرة من وكيل الماركة في مصر. التجهيزات بتختلف حسب الفئة؛ راجع جدول الفئات.' },
};

const Meta = ({ f, locale }: { f: P2Fact; locale: Locale }) => {
  const t = T[locale];
  return (
    <span className="small fact-meta">
      {f.scope ? <span className="fm">{t.scope}: <bdi>{f.scope}</bdi></span> : null}
      <span className="fm">{t.source}: {f.sourceUrl ? <a className="link" href={f.sourceUrl} target="_blank" rel="noopener noreferrer"><bdi>{f.issuer}</bdi></a> : <bdi>{f.issuer}</bdi>}</span>
    </span>
  );
};

export function P2Specs({ c, locale, lead }: { c: P2Content; locale: Locale; lead?: [string, React.ReactNode][] }) {
  if (!c.specs.length) return null;
  const ar = locale === 'ar';
  return (
    <>
      <div className="spec-grid" data-p2-specs={c.specs.length}>
        {(lead ?? []).map(([k, v]) => <div className="spec" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}
        {c.specs.map(s => (
          <div className="spec" key={s.key} data-spec={s.key}>
            <div className="k">{LABEL[s.key][ar ? 1 : 0]}</div>
            <div className="v">{s.facts.map((f, i) => (
              <div key={i} className="fact"><Value k={s.key} f={f} locale={locale} />{s.facts.length > 1 || f.scope ? <div><Meta f={f} locale={locale} /></div> : null}</div>
            ))}</div>
          </div>
        ))}
      </div>
      <p className="small">{T[locale].specsNote} {T[locale].source}: {[...new Set(c.specs.flatMap(s => s.facts.flatMap(f => f.issuer.split(' · '))))].map((x, i) => <span key={x}>{i ? ' · ' : ''}<bdi>{x}</bdi></span>)}</p>
    </>
  );
}

const yearsKm = (v: string, locale: Locale) => {
  const m = v.match(/^(\d+)\s*years?\s*\/\s*([\d,]+)\s*km$/i);
  if (!m) return v; // other wordings (e.g. unlimited mileage) stay exactly as the source states them
  const y = Number(m[1]), km = num(Number(m[2].replace(/,/g, '')));
  return locale === 'ar' ? `${num(y)} ${y >= 3 && y <= 10 ? 'سنوات' : 'سنة'} / ${km} كم` : `${y} ${y === 1 ? 'year' : 'years'} / ${km} km`;
};

export function P2Warranty({ c, locale }: { c: P2Content; locale: Locale }) {
  if (!c.warranty.length) return null;
  const t = T[locale];
  return (
    <section className="cd-section" aria-labelledby="warranty-h" data-p2-warranty={c.warranty.length}>
      <h2 id="warranty-h" className="h-section">{t.wH}</h2>
      <ul className="warranty-list">
        {c.warranty.map((w, i) => (
          <li key={i} data-warranty-kind={w.kind}>
            <b>{w.kind === 'battery' ? t.battery : t.vehicle}</b>: <bdi>{yearsKm(w.fact.value, locale)}</bdi>
            <div><Meta f={{ ...w.fact, scope: w.fact.scope }} locale={locale} />{w.fact.scope ? null : <span className="small"> · {t.all}</span>}</div>
          </li>
        ))}
      </ul>
      <p className="small">{t.wNote}</p>
    </section>
  );
}

export function P2Gallery({ c, locale, name }: { c: P2Content; locale: Locale; name: string }) {
  if (!c.gallery.length) return null;
  const t = T[locale], FIRST = 6;
  const item = (g: P2Content['gallery'][number], i: number) => (
    <li key={g.src}>
      <a href={g.src} target="_blank" rel="noopener noreferrer">
        <img src={g.src} srcSet={photoSrcSet(g.src)} sizes="(max-width: 720px) 46vw, 300px" alt={`${name} — ${t.photo(i + 1)}`}
          width={g.width ?? undefined} height={g.height ?? undefined} loading="lazy" decoding="async" data-gallery-photo="true" />
      </a>
    </li>
  );
  const credits = [...new Set(c.gallery.map(g => g.credit).filter(Boolean))];
  return (
    <section className="cd-section" aria-labelledby="gallery-h" data-p2-gallery={c.gallery.length}>
      <h2 id="gallery-h" className="h-section">{t.gH}</h2>
      <ul className="gallery">{c.gallery.slice(0, FIRST).map(item)}</ul>
      {c.gallery.length > FIRST ? (
        <details className="gallery-more"><summary>{t.all_(c.gallery.length)}</summary><ul className="gallery">{c.gallery.slice(FIRST).map((g, i) => item(g, i + FIRST))}</ul></details>
      ) : null}
      {credits.length ? <p className="small">{t.credit}: {credits.map((x, i) => <span key={x}>{i ? ' · ' : ''}<bdi>{x}</bdi></span>)}</p> : null}
    </section>
  );
}

export function P2Brochures({ c, locale }: { c: P2Content; locale: Locale }) {
  if (!c.brochures.length) return null;
  const t = T[locale];
  return (
    <section className="cd-section" aria-labelledby="brochure-h" data-p2-brochures={c.brochures.length}>
      <h2 id="brochure-h" className="h-section">{t.bH}</h2>
      <ul className="brochure-list">
        {c.brochures.map(b => (
          <li key={b.url}>
            <a className="btn btn-ghost" href={b.url} target="_blank" rel="noopener noreferrer" data-brochure-url={b.url}>{t.open}{/\.pdf($|\?)/i.test(b.url) ? ' (PDF)' : ''}</a>
            <span className="small"> <bdi>{b.issuer}</bdi>{b.scope ? <> · {t.scope}: <bdi>{b.scope}</bdi></> : null}</span>
          </li>
        ))}
      </ul>
      <p className="small">{t.bNote}</p>
    </section>
  );
}
