'use client';
import { useMemo, useState } from 'react';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';

export type FinderMake = { id: string; label: string };
export type FinderModel = { slug: string; make: string; label: string; years: number[] };

/* Make / model / year from the site's vehicle data only. A plain GET form (works without JavaScript); the script only
   narrows the model and year lists to the chosen make and model. */
export default function Finder({ locale, makes, models, sel }: {
  locale: Locale; makes: FinderMake[]; models: FinderModel[]; sel: { make?: string; model?: string; year?: string; cat?: string };
}) {
  const p = dict(locale).parts;
  const [make, setMake] = useState(sel.make ?? '');
  const [model, setModel] = useState(sel.model ?? '');
  const [year, setYear] = useState(sel.year ?? '');
  const forMake = useMemo(() => models.filter(m => m.make === make), [models, make]);
  const years = useMemo(() => models.find(m => m.slug === model)?.years ?? [], [models, model]);
  return (
    <form className="pf" action={`/${locale}/spare-parts`} method="get" data-finder="true">
      <div className="field">
        <label htmlFor="pf-make">{p.make}</label>
        <select id="pf-make" name="make" value={make} onChange={e => { setMake(e.target.value); setModel(''); setYear(''); }}>
          <option value="">{p.pickMake}</option>
          {makes.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pf-model">{p.model}</label>
        <select id="pf-model" name="model" value={model} disabled={!make} onChange={e => { setModel(e.target.value); setYear(''); }}>
          <option value="">{p.pickModel}</option>
          {forMake.map(m => <option key={m.slug} value={m.slug}>{m.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pf-year">{p.year}</label>
        <select id="pf-year" name="year" value={year} disabled={!model || !years.length} onChange={e => setYear(e.target.value)}>
          <option value="">{model && !years.length ? p.noYears : years.length ? p.anyYear : p.pickYear}</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      {sel.cat ? <input type="hidden" name="cat" value={sel.cat} /> : null}
      <div className="pf-go"><button className="btn btn-primary" type="submit">{p.find}</button></div>
    </form>
  );
}
