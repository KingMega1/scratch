'use client';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { setAnalyticsContext, track } from '@/lib/analytics/client';

/* Find My Car client. Every human-facing string inside the tool is P1 engine-owned copy delivered by the server
   (uiCopy / question descriptors / ci.reco.v1 {html,text}); this component adds layout and P5 site links only.
   html fragments are the released P1 markup: data values escaped by P1, fixed classes (ci.reco.v1 schema).
   The working brief lives only in this component's memory (no URL, storage or analytics). */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Copy = Record<string, any>;
type Frag = { html: string; text: string };
type Q = { id: string; step: number; step_label: string; title: string; hint: string; heard: string[]; kind: 'budget' | 'text' | 'multi' | 'single';
  options: { v: string; t: string; s: string; scored: boolean }[]; placeholder: string | null; budget: { value: number; mode: string; stretch: boolean } | null };
type View =
  | { view: 'welcome' }
  | { view: 'q'; brief: any; asked: string[]; path: string; q: Q }
  | { view: 'summary'; brief: any; rows: { key: string; label: string; value: Frag }[] }
  | { view: 'edit'; brief: any; form: any }
  | { view: 'result'; brief: any; result: any; website: Record<string, string | null> };
type SiteCopy = { carPage: string; compareOnSite: string; loading: string; error: string; retry: string; notOnSite: string };

const H = ({ html, as: As = 'span', className }: { html: string; as?: any; className?: string }) => <As className={className} dangerouslySetInnerHTML={{ __html: html }} />;

async function call(body: Record<string, unknown>) {
  const res = await fetch('/api/v1/recommendation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const j = await res.json().catch(() => ({ error: 'unavailable' }));
  if (!res.ok) throw Object.assign(new Error(j.error || 'unavailable'), { code: j.error || 'unavailable' });
  return j;
}

export default function FindMyCar({ locale, site, shareToken }: { locale: 'en' | 'ar'; site: SiteCopy; shareToken: string | null }) {
  const [copy, setCopy] = useState<Copy | null>(null);
  const [view, setView] = useState<View>({ view: 'welcome' });
  const [stack, setStack] = useState<View[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const last = useRef<(() => void) | null>(null);

  const run = useCallback(async (body: Record<string, unknown>, opts: { push?: boolean; matching?: boolean } = {}) => {
    const retry = () => run(body, opts);
    last.current = retry;
    setErr(null); setBusy(opts.matching ? 'matching' : 'loading');
    try {
      const next = await call({ locale, ...body }) as View;
      if (opts.push !== false) setStack(s => [...s, view]);
      setView(next);
      if (next.view === 'result') {
        const r = next.result;
        setAnalyticsContext({ engine_version: r.engine_version, universe_version: r.universe_version, result_id: r.result_id });
        track('fmc_result_view', { mode: r.mode, confidence_level: r.confidence?.level ?? null, hero_id: r.hero?.id ?? null, alt_ids: (r.alternatives || []).map((a: any) => a.id), result_id: r.result_id, outside_site: Object.values(next.website).filter(v => v === null).length });
        if (opts.push !== false && r.share?.r) history.replaceState(history.state, '', `?r=${r.share.r}`);
      }
      requestAnimationFrame(() => top.current?.focus());
    } catch (e: any) {
      setErr(e.code || 'unavailable');
      track('fmc_error', { code: String(e.code || 'unavailable').slice(0, 32) });
    } finally { setBusy(null); }
  }, [locale, view]);

  useEffect(() => {
    call({ op: 'status', locale }).then(j => setCopy(j.copy)).catch(e => setErr(e.code || 'unavailable'));
  }, [locale]);
  useEffect(() => { if (copy && shareToken) run({ op: 'shared', r: shareToken }, { push: false }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [copy, shareToken]);

  const back = () => { const s = [...stack]; const prev = s.pop(); if (prev) { setStack(s); setView(prev); } };
  const restart = () => { setStack([]); setView({ view: 'welcome' }); history.replaceState(history.state, '', location.pathname); };

  if (!copy) {
    return err ? <ErrorPanel site={site} onRetry={() => location.reload()} /> : <div className="state-panel" aria-busy="true"><div className="skeleton" style={{ width: '60%' }} /><div className="skeleton" /></div>;
  }
  return (
    <div className="fmc" dir={copy.dir} data-fmc-view={view.view}>
      <div ref={top} tabIndex={-1} className="fmc-focus" aria-live="polite">
        {busy === 'matching' ? <section className="fmc-matching" role="status"><H as="p" html={copy.matching} /><div className="fmc-scan"><i /></div></section> : null}
        {busy === 'loading' ? <p className="small" role="status">{site.loading}</p> : null}
      </div>
      {err ? <ErrorPanel site={site} onRetry={() => last.current?.()} /> : null}
      {view.view === 'welcome' ? <Welcome copy={copy} onText={text => { track('fmc_start', { path: 'text' }); run({ op: 'start', path: 'text', text }); }} onGuided={() => { track('fmc_start', { path: 'guided' }); run({ op: 'start', path: 'guided' }); }} /> : null}
      {view.view === 'q' ? <Question key={view.q.id + view.q.step} copy={copy} v={view} onBack={back} onAnswer={value => { track('fmc_q_answer', { q_id: view.q.id, step: view.q.step }); run({ op: 'answer', brief: view.brief, asked: view.asked, path: view.path, q: view.q.id, value }); }} /> : null}
      {view.view === 'summary' ? <Summary copy={copy} v={view} onBack={back} onConfirm={() => { track('fmc_summary_confirm', { keys: view.rows.map(r => r.key) }); run({ op: 'execute', brief: view.brief }, { matching: true }); }} onEdit={async () => { track('fmc_summary_edit', {}); try { const form = await call({ op: 'edit_form', locale, brief: view.brief }); setStack(s => [...s, view]); setView({ view: 'edit', brief: view.brief, form }); } catch (e: any) { setErr(e.code); } }} /> : null}
      {view.view === 'edit' ? <Edit copy={copy} v={view} locale={locale} onBack={back} onSave={edit => run({ op: 'edit_save', brief: view.brief, edit })} /> : null}
      {view.view === 'result' ? <Result copy={copy} site={site} locale={locale} v={view} onRestart={restart}
        onEdit={async () => { try { const form = await call({ op: 'edit_form', locale, brief: view.brief }); setStack(s => [...s, view]); setView({ view: 'edit', brief: view.brief, form }); } catch (e: any) { setErr(e.code); } }}
        onAdjust={action => { track('fmc_adjust', { kind: action.kind, key: action.key ?? null }); run({ op: 'adjust', brief: view.brief, action }); }} /> : null}
    </div>
  );
}

function ErrorPanel({ site, onRetry }: { site: SiteCopy; onRetry: () => void }) {
  return <section className="state-panel" role="alert"><p style={{ margin: 0 }}>{site.error}</p><div><button className="btn btn-ghost" type="button" onClick={onRetry}>{site.retry}</button></div></section>;
}

function Welcome({ copy, onText, onGuided }: { copy: Copy; onText: (t: string) => void; onGuided: () => void }) {
  const [text, setText] = useState(''); const [empty, setEmpty] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  return (
    <section className="fmc-welcome">
      <form className="fmc-brief" noValidate onSubmit={e => { e.preventDefault(); const t = text.trim(); if (!t) { setEmpty(true); return; } onText(t); }}>
        <label htmlFor="fmc-brief" className="fmc-label">{copy.w_label}</label>
        <textarea id="fmc-brief" ref={ta} rows={3} dir="auto" placeholder={copy.w_ph} value={text} maxLength={1000} onChange={e => { setText(e.target.value); setEmpty(false); }} />
        {empty ? <p className="small" role="alert">{copy.w_empty}</p> : null}
        <div className="fmc-actions"><button className="btn btn-primary" type="submit" data-fmc="go">{copy.w_go}</button></div>
      </form>
      <div>
        <p className="label-mono">{copy.w_examples}</p>
        <div className="chips">{(copy.examples as string[]).map((x, i) => <button key={i} type="button" className="chip" onClick={() => { setText(x); ta.current?.focus(); }}>{x}</button>)}</div>
      </div>
      <button className="link-btn" type="button" onClick={onGuided} data-fmc="guided">{copy.w_guided}</button>
      <H as="p" className="small" html={copy.w_foot} />
    </section>
  );
}

const money = (copy: Copy, n: number) => `<span class="money">${copy.egp[0]}<span class="num">${Number(Math.round(n)).toLocaleString('en-US')}</span>${copy.egp[1]}</span>`;

function BudgetCard({ copy, init, onChange }: { copy: Copy; init: { value: number; mode: string; stretch: boolean }; onChange: (v: { budget: number; mode: string; stretch: boolean }) => void }) {
  const [b, setB] = useState(init.value), [mode, setMode] = useState(init.mode), [stretch, setStretch] = useState(init.stretch);
  useEffect(() => { onChange({ budget: b, mode, stretch: mode === 'max' && stretch }); }, [b, mode, stretch, onChange]);
  const step = (d: number) => setB(v => Math.max(300000, Math.min(20000000, v + d * copy.step_amount)));
  return (
    <div className="budget-card">
      <div className="budget-row">
        <button className="icon-btn" type="button" aria-label={copy.minus} onClick={() => step(-1)}>−</button>
        <H className="budget-val" html={money(copy, b)} />
        <button className="icon-btn" type="button" aria-label={copy.plus} onClick={() => step(1)}>+</button>
      </div>
      <div className="chips" role="radiogroup">{['around', 'max'].map(k => <button key={k} type="button" role="radio" className="chip" aria-checked={mode === k} aria-pressed={mode === k} onClick={() => setMode(k)}>{copy.e_budget_mode[k]}</button>)}</div>
      <label className="check-line"><input type="checkbox" checked={stretch} disabled={mode !== 'max'} onChange={e => setStretch(e.target.checked)} /> {copy.e_stretch}</label>
    </div>
  );
}

function Question({ copy, v, onBack, onAnswer }: { copy: Copy; v: Extract<View, { view: 'q' }>; onBack: () => void; onAnswer: (value: unknown) => void }) {
  const q = v.q;
  const budget = useRef<unknown>(null);
  const setBudget = useCallback((x: unknown) => { budget.current = x; }, []);
  const [more, setMore] = useState(''); const [picked, setPicked] = useState<string[]>([]);
  const opt = (o: Q['options'][number], multi: boolean) => (
    <button key={o.v} className="opt" type="button" data-v={o.v} {...(multi ? { role: 'checkbox', 'aria-checked': picked.includes(o.v) } : {})}
      onClick={() => multi ? setPicked(p => p.includes(o.v) ? p.filter(x => x !== o.v) : p.length >= 3 ? p : [...p, o.v]) : onAnswer(o.v)}>
      <H className="t" html={o.t} /><H className="s" html={o.s} />
    </button>
  );
  return (
    <section className="fmc-question" aria-labelledby="fmc-q-h">
      <div className="fmc-top"><button className="link-btn" type="button" onClick={onBack}>← {copy.back}</button><span className="label-mono">{q.step_label}</span></div>
      {q.heard.length ? <div className="fmc-heard"><span className="small">{copy.heard}</span> {q.heard.map((h, i) => <H key={i} className="chip" html={h} />)}</div> : null}
      <div className="fmc-q-head"><H as="h2" html={q.title} /><H as="p" className="sub" html={q.hint} /></div>
      {q.kind === 'budget' && q.budget ? <>
        <BudgetCard copy={copy} init={q.budget} onChange={setBudget} />
        <div className="fmc-actions"><button className="btn btn-primary" type="button" onClick={() => onAnswer(budget.current)}>{copy.cont}</button></div>
      </> : null}
      {q.kind === 'text' ? <>
        <textarea rows={3} dir="auto" placeholder={q.placeholder ?? ''} value={more} maxLength={1000} onChange={e => setMore(e.target.value)} aria-labelledby="fmc-q-h" />
        <div className="fmc-actions"><button className="btn btn-primary" type="button" onClick={() => onAnswer(more)}>{copy.cont}</button><button className="link-btn" type="button" onClick={() => onAnswer('')}>{copy.skip_q}</button></div>
      </> : null}
      {q.kind === 'multi' ? <>
        <div className="options">{q.options.filter(o => o.scored).map(o => opt(o, true))}</div>
        <p className="label-mono">{copy.prio_check_h}</p>
        <div className="options">{q.options.filter(o => !o.scored).map(o => opt(o, true))}</div>
        <div className="fmc-actions"><button className="btn btn-primary" type="button" onClick={() => onAnswer(picked)}>{copy.cont}</button><button className="link-btn" type="button" onClick={() => onAnswer([])}>{copy.skip_q}</button></div>
      </> : null}
      {q.kind === 'single' ? <div className="options">{q.options.map(o => opt(o, false))}</div> : null}
    </section>
  );
}

function Summary({ copy, v, onBack, onConfirm, onEdit }: { copy: Copy; v: Extract<View, { view: 'summary' }>; onBack: () => void; onConfirm: () => void; onEdit: () => void }) {
  return (
    <section className="fmc-summary" aria-labelledby="fmc-s-h">
      <div className="fmc-top"><button className="link-btn" type="button" onClick={onBack}>← {copy.back}</button></div>
      <p className="label-mono">{copy.s_eyebrow}</p>
      <h2 id="fmc-s-h">{copy.s_h}</h2>
      <dl className="specs understood">{v.rows.map(r => <div key={r.key}><dt>{r.label}</dt><H as="dd" html={r.value.html} /></div>)}</dl>
      <p className="h3">{copy.s_q}</p>
      <div className="fmc-actions"><button className="btn btn-primary" type="button" onClick={onConfirm} data-fmc="confirm">{copy.s_yes}</button><button className="btn btn-ghost" type="button" onClick={onEdit}>{copy.s_edit}</button></div>
    </section>
  );
}

function Edit({ copy, v, locale, onBack, onSave }: { copy: Copy; v: Extract<View, { view: 'edit' }>; locale: string; onBack: () => void; onSave: (e: unknown) => void }) {
  const f = v.form;
  const budget = useRef<any>({ budget: f.budget.value, mode: f.budget.mode, stretch: f.budget.stretch });
  const setBudget = useCallback((x: unknown) => { budget.current = x; }, []);
  const [sel, setSel] = useState<Record<string, string[]>>(Object.fromEntries(f.groups.map((g: any) => [g.key, g.sel.filter(Boolean)])));
  const [only, setOnly] = useState<{ id: string; html: string }[]>(f.only), [excl, setExcl] = useState<{ id: string; html: string }[]>(f.excl);
  const [unres, setUnres] = useState<string[]>(f.unresolved), [cars, setCars] = useState<{ id: string; html: string; label: string }[]>(f.cars);
  const [added, setAdded] = useState<string[]>([]);
  const [brandText, setBrandText] = useState(''), [carText, setCarText] = useState('');
  const toggle = (g: any, k: string) => setSel(s => {
    const cur = s[g.key] || [], on = cur.includes(k);
    if (!g.multi) return { ...s, [g.key]: on ? [] : [k] };
    if (g.key === 'body') return { ...s, body: k === 'any' ? ['any'] : on ? cur.filter(x => x !== k) : [...cur.filter(x => x !== 'any'), k] };
    return { ...s, [g.key]: on ? cur.filter(x => x !== k) : [...cur, k] };
  });
  const addBrands = async (kind: 'only' | 'excl') => {
    const { items } = await call({ op: 'parse_names', locale, kind: 'brand', text: brandText });
    for (const it of items as { id: string; html: string }[]) {
      setOnly(o => [...o.filter(x => x.id !== it.id), ...(kind === 'only' ? [it] : [])]);
      setExcl(o => [...o.filter(x => x.id !== it.id), ...(kind === 'excl' ? [it] : [])]);
    }
    setBrandText('');
  };
  const addCar = async () => {
    const { items } = await call({ op: 'parse_names', locale, kind: 'car', text: carText });
    for (const it of items as { id: string; html: string; label: string }[]) if (!cars.some(c => c.id === it.id)) { setCars(c => [...c, it]); setAdded(a => [...a, it.id]); }
    setCarText('');
  };
  return (
    <section className="fmc-edit" aria-labelledby="fmc-e-h">
      <div className="fmc-top"><button className="link-btn" type="button" onClick={onBack}>← {copy.back}</button></div>
      <h2 id="fmc-e-h">{copy.e_h}</h2>
      <div className="fmc-edit-grid">
        <div><p className="fmc-label">{copy.s_rows.budget}</p><BudgetCard copy={copy} init={f.budget} onChange={setBudget} /></div>
        {f.groups.map((g: any) => (
          <div key={g.key} className={g.full ? 'full' : ''}><H as="p" className="fmc-label" html={g.label} />
            <div className="chips">{g.options.map((o: any) => <button key={o.v} type="button" className="chip" aria-pressed={(sel[g.key] || []).includes(o.v)} onClick={() => toggle(g, o.v)}><H html={o.t} /></button>)}</div></div>
        ))}
        <div className="full"><p className="fmc-label">{copy.e_brands}</p>
          {unres.length ? <p className="small">{copy.s_rows.unresolved}: {unres.map(u => <button key={u} type="button" className="chip" onClick={() => setUnres(x => x.filter(y => y !== u))}><span dir="auto">“{u}”</span> ×</button>)}<br />{copy.unresolved_hint}</p> : null}
          <div className="chips">{only.map(x => <button key={x.id} type="button" className="chip" onClick={() => setOnly(o => o.filter(y => y.id !== x.id))}>{copy.s_rows.only}: <H html={x.html} /> ×</button>)}</div>
          <div className="chips">{excl.map(x => <button key={x.id} type="button" className="chip" onClick={() => setExcl(o => o.filter(y => y.id !== x.id))}>{copy.s_rows.avoid}: <H html={x.html} /> ×</button>)}</div>
          <div className="fmc-add"><input type="text" dir="auto" value={brandText} maxLength={200} placeholder={copy.e_brand_ph} aria-label={copy.e_brands} onChange={e => setBrandText(e.target.value)} />
            <button type="button" className="btn btn-ghost" onClick={() => addBrands('only')}>{copy.e_brand_only}</button><button type="button" className="btn btn-ghost" onClick={() => addBrands('excl')}>{copy.e_brand_excl}</button></div>
        </div>
        <div className="full"><p className="fmc-label">{copy.s_rows.shortlist}</p>
          <div className="chips">{cars.map(c => <button key={c.id} type="button" className="chip" aria-label={c.label} onClick={() => { setCars(x => x.filter(y => y.id !== c.id)); setAdded(a => a.filter(y => y !== c.id)); }}><H html={c.html} /> ×</button>)}</div>
          <div className="fmc-add"><input type="text" dir="auto" value={carText} maxLength={200} placeholder={copy.e_add_ph} aria-label={copy.e_add} onChange={e => setCarText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCar(); } }} />
            <button type="button" className="btn btn-ghost" onClick={addCar}>+</button></div>
        </div>
      </div>
      <div className="fmc-actions"><button className="btn btn-primary" type="button" onClick={() => onSave({
        budget: { value: budget.current.budget, mode: budget.current.mode, stretch: budget.current.stretch }, sel,
        only: only.map(x => x.id), excl: excl.map(x => x.id), unresolved: unres, cars: cars.filter(c => !added.includes(c.id)).map(c => c.id), addCars: added,
      })}>{copy.e_save}</button></div>
    </section>
  );
}

/* Result: renders ci.reco.v1 only. Ties (equal) show hero + alternatives as equal cards in the given order, none leads. */
function Result({ copy, site, locale, v, onRestart, onEdit, onAdjust }: { copy: Copy; site: SiteCopy; locale: string; v: Extract<View, { view: 'result' }>; onRestart: () => void; onEdit: () => void;
  onAdjust: (a: { kind: 'budget' | 'fix' | 'relax'; key?: string; to?: number; dir?: number }) => void }) {
  const r = v.result, W = v.website;
  const [cmp, setCmp] = useState(false), [sheet, setSheet] = useState<string | null>(null), [toast, setToast] = useState(false);
  const cars: any[] = r.hero ? [r.hero, ...r.alternatives] : [];
  const onSite = cars.map(c => W[c.id]).filter((x): x is string => !!x);
  const siteLink = (id: string) => W[id]
    ? <Link className="link" href={`/${locale}/cars/${W[id]}`} data-fmc-site-link={id}>{site.carPage}</Link>
    : <span className="small" data-fmc-not-on-site={id}>{site.notOnSite}</span>;
  // P1 markup carries data-detail / data-fix / data-relax buttons; wire them here (released app.js behaviour).
  const delegate = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-detail],[data-fix],[data-relax]') as HTMLElement | null;
    if (!el) return;
    if (el.dataset.detail) { setSheet(el.dataset.detail); track('evidence_open', { model_id: el.dataset.detail }); }
    else if (el.dataset.fix) onAdjust({ kind: 'fix', key: el.dataset.fix, ...(el.dataset.to ? { to: Number(el.dataset.to) } : {}) });
    else if (el.dataset.relax) onAdjust({ kind: 'relax', key: el.dataset.relax });
  };
  const sheetCar = sheet ? cars.find(c => c.id === sheet) : null;
  const sheetHtml = sheetCar ? sheetCar.html.detail : r.less && sheet === r.less.id ? r.less.detail_html : null;
  const share = () => {
    const url = `${location.origin}${location.pathname}?r=${r.share.r}`;
    track('cta_click', { cta: 'fmc_share' });
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { setToast(true); setTimeout(() => setToast(false), 1800); }).catch(() => window.prompt('', url));
  };
  return (
    <div className="fmc-result" onClick={delegate} data-mode={r.mode} data-result-id={r.result_id} data-engine-version={r.engine_version} data-universe-version={r.universe_version} data-transport-version={r.transport_version}>
      <section className="fmc-brief-bar" aria-labelledby="fmc-r-h">
        <div className="fmc-head"><h2 id="fmc-r-h" className="h3">{copy.r_based}</h2>
          <div className="fmc-head-actions"><button className="link-btn" type="button" onClick={onEdit}>{copy.r_edit}</button><button className="link-btn" type="button" onClick={share}>{copy.share}</button><button className="link-btn" type="button" onClick={onRestart}>{copy.r_restart}</button></div></div>
        <div className="fmc-budget-inline"><span className="label-mono">{copy.r_budget}</span>
          <button className="icon-btn" type="button" aria-label={copy.minus} onClick={() => onAdjust({ kind: 'budget', dir: -1 })}>−</button><H className="price-big" html={r.budget.html} /><button className="icon-btn" type="button" aria-label={copy.plus} onClick={() => onAdjust({ kind: 'budget', dir: 1 })}>+</button></div>
        <div className="chips">{r.brief_bar.map((x: any) => <span key={x.key} className="chip"><span className="small">{x.label}:</span> <H html={x.value.html} /></span>)}</div>
      </section>
      {r.notices.map((n: Frag, i: number) => <H key={i} html={n.html} as="div" className="fmc-notice-wrap" />)}

      {r.mode === 'no_match' && r.no_match ? <>
        {r.no_match.nearest_html ? <H as="div" html={r.no_match.nearest_html} /> : null}
        <section className="nomatch">{r.no_match.head_html ? <H as="div" html={r.no_match.head_html} /> : null}<H as="div" html={r.no_match.fixes_html} /></section>
        {r.no_match.nearest_above.length ? <ul className="fmc-site-links">{r.no_match.nearest_above.map((x: any) => <li key={x.id}>{siteLink(x.id)}</li>)}</ul> : null}
      </> : null}

      {r.hero && r.equal ? (
        <section className="fmc-equal" aria-labelledby="fmc-eq-h" data-fmc-equal="true">
          <div className="fmc-head"><h2 id="fmc-eq-h" className="h3">{r.equal.heading}</h2><button className="link-btn" type="button" aria-expanded={cmp} onClick={() => setCmp(x => !x)}>{cmp ? copy.compare_hide : copy.compare}</button></div>
          <p className="small">{r.equal.sub}</p>
          <div className="alts">{cars.map(c => <div key={c.id} className="fmc-card" data-model-id={c.id}><H as="div" html={c.card.html} />{siteLink(c.id)}</div>)}</div>
          {cmp && r.compare_html ? <H as="div" html={r.compare_html} /> : null}
        </section>
      ) : null}

      {r.hero && !r.equal ? <>
        <article className="fmc-hero" aria-labelledby="fmc-hero-h" data-model-id={r.hero.id}>
          {r.hero.image ? <figure className="fmc-hero-img"><img src={r.hero.image.src} alt={r.hero.name.text} loading="lazy" referrerPolicy="no-referrer" onError={e => (e.currentTarget.closest('figure') as HTMLElement).remove()} /></figure> : null}
          <div className="fmc-hero-top">
            <div>{r.eyebrow ? <H as="p" className="eyebrow" html={r.eyebrow.html} /> : null}
              <H as="h2" className="hero-name" html={r.hero.name.html} />
              {r.hero.size ? <H as="p" className="small" html={r.hero.size.html} /> : null}</div>
            <div className="fmc-hero-price"><p className="label-mono">{copy.in_range}</p><H as="p" className="price-big" html={r.hero.price_range.html} />
              {r.hero.price_note ? <H as="p" className="small" html={r.hero.price_note.html} /> : null}</div>
          </div>
          <H as="div" className="fmc-detail" html={r.hero.html.detail} />
          <p className="fmc-site">{siteLink(r.hero.id)}</p>
        </article>
        {r.alternatives.length ? <section aria-labelledby="fmc-alt-h">
          <div className="fmc-head"><h2 id="fmc-alt-h" className="h3">{copy.alts_h}</h2><button className="link-btn" type="button" aria-expanded={cmp} onClick={() => setCmp(x => !x)}>{cmp ? copy.compare_hide : copy.compare}</button></div>
          <div className="alts">{r.alternatives.map((c: any) => <div key={c.id} className="fmc-card" data-model-id={c.id}><H as="div" html={c.card.html} />{siteLink(c.id)}</div>)}</div>
          {cmp && r.compare_html ? <H as="div" html={r.compare_html} /> : null}
        </section> : null}
      </> : null}

      {onSite.length >= 2 ? <p><Link className="btn btn-ghost" href={`/${locale}/compare?ids=${onSite.slice(0, 3).join(',')}`}>{site.compareOnSite}</Link></p> : null}
      {r.less ? <section className="note-card"><h3>{r.less.heading}</h3><H as="p" html={r.less.html} /><button className="link-btn" type="button" data-detail={r.less.id}>{copy.details}</button> {siteLink(r.less.id)}</section> : null}
      {r.checks.length ? <section className="note-card"><h3>{copy.check_h}</h3><ul className="checks">{r.checks.map((c: any) => <H key={c.key} as="li" html={c.html} />)}</ul></section> : null}

      {sheet && sheetHtml ? (
        <div className="fmc-sheet" role="dialog" aria-modal="true" aria-labelledby="fmc-sheet-h" onKeyDown={e => { if (e.key === 'Escape') setSheet(null); }}>
          <div className="fmc-sheet-panel" tabIndex={-1} ref={el => el?.focus()}>
            <div className="fmc-top"><button className="link-btn" type="button" onClick={() => setSheet(null)}>← {copy.back}</button></div>
            {sheetCar ? <><h2 id="fmc-sheet-h" className="hero-name" dangerouslySetInnerHTML={{ __html: sheetCar.name.html }} /><H as="p" className="price-big" html={sheetCar.price_range.html} /></> : <h2 id="fmc-sheet-h" className="h3">{r.less.heading}</h2>}
            <H as="div" className="fmc-detail light" html={sheetHtml} />
            <p>{siteLink(sheet)}</p>
          </div>
        </div>
      ) : null}
      {toast ? <div className="fmc-toast" role="status">{copy.copied}</div> : null}
    </div>
  );
}
