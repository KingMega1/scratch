// Generates app/present.js: the released result-composition code of app/app.js, copied VERBATIM into a pure module
// (no DOM, no window, no storage) so the server transport says exactly what the released browser app says.
// app.js is not modified. Every block/snippet below must exist character-for-character in app.js, or this fails.
//   node tools/build_present.mjs          write app/present.js
//   node tools/build_present.mjs --check  fail if app/present.js is not exactly what app.js generates (drift guard)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = fs.readFileSync(path.join(ROOT, 'app/app.js'), 'utf8');
const OUT = path.join(ROOT, 'app/present.js');
const lines = APP.split('\n');

// whole-line blocks: [first, last] line markers (exact line text), copied with everything in between
function block(first, last) {
  const a = lines.findIndex(l => l === first);
  const b = lines.findIndex((l, i) => i >= a && l === last);
  if (a < 0 || b < 0 || lines.indexOf(first, a + 1) >= 0) throw new Error(`block not found or not unique: ${first}`);
  return lines.slice(a, b + 1).join('\n');
}
// in-line snippets: exact substrings of app.js (template expressions inside renderResult)
function snip(s) {
  const i = APP.indexOf(s);
  if (i < 0 || APP.indexOf(s, i + 1) >= 0) throw new Error(`snippet not found or not unique: ${s.slice(0, 80)}`);
  return s;
}

const B = {
  esc: block("  const esc = s => String(s == null ? '' : s).replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));",
    "  const num = n => `<span class=\"num\">${fmt(n)}</span>`;"),
  money: block('  const money = n => `<span class="money">${S.egp(num(Math.round(n)))}</span>`;',
    '  const lat = s => `<span class="ltr">${esc(s)}</span>`;'),
  enc: block("  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');",
    "  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));"),
  share: block("  const SHARE_KEYS = ['drive4', 'offroad', 'sizePref', 'brandsOnly', 'ptNo', 'budget', 'budgetMin', 'budgetMode', 'stretch', 'budgetFrom', 'body', 'bodyAny', 'bodyImplied', 'notBody', 'seats', 'who', 'usage', 'pt', 'chinese', 'priorities', 'checks',",
    "  const slim = b => { const o = {}; SHARE_KEYS.forEach(k => { const v = b[k]; if (v != null && v !== false && !(Array.isArray(v) && !v.length)) o[k] = v; }); return o; };"),
  brief: block('  const norm = b => E.normalizeBrief(b, byId);',
    "  const family = b => (b.who || []).some(w => ['kids', 'family', 'parents'].includes(w));"),
  nextQ: block("  const FOLLOW_UPS = ['drive', 'size', 'pt', 'chinese', 'usage', 'priorities'];", '  function advance(brief, asked) {')
    .split('\n').slice(0, -1).join('\n'),
  summary: block("  const joinList = a => a.join(lang === 'ar' ? '، ' : ', ');",
    '  function brandName(bid) { const m = U.models.find(x => x.brand_id === bid); return m ? lat(m.brand) : esc(bid); }'),
  pieces: block('  function warrantyTxt(m) {', '  /* ---------- result ---------- */').split('\n').slice(0, -1).join('\n'),
  topCards: block('    const topCards = [];', '    if (r.widened) topCards.push(`<div class="notice"><span class="ic" aria-hidden="true">i</span><p>${S.widened}</p></div>`);'),
  checks: block("    const checks = [...new Set([...(b.checks || []).filter(c => S.check[c]), 'test', 'terms'])];",
    "    const checks = [...new Set([...(b.checks || []).filter(c => S.check[c]), 'test', 'terms'])];"),
  cards: block('  function shortlistCard(r) {', '  function wireRelax(b) {').split('\n').slice(0, -2).join('\n'),
  packFor: block('  function packFor(id, r) {', "    return p || { id, pick: E.currentTrims(byId[id])[0], price: r.less.price, fit: E.currentTrims(byId[id]), all: E.currentTrims(byId[id]), parts: {}, vs: [] };") + '\n  }',
};
const X = {
  nearest: snip("${r.nearestAbove ? `<section class=\"nomatch\"><h2>${S.nearest_h}</h2><ul class=\"vs\">${r.nearestAbove.map(x => `<li>${S.nearest_line({ n: nm(x.id), price: money(x.price), amount: money(x.over) })}</li>`).join('')}</ul></section>` : ''}"),
  nomatchHead: snip("${r.nearestAbove ? '' : `<h2>${S.nomatch_h}</h2>`}<p>${S.nomatch_p}</p>"),
  fixes: snip("${fixes.map(f => `<button class=\"btn btn-ghost\" type=\"button\" data-fix=\"${f.key}\" data-to=\"${f.to || ''}\">${f.key === 'budget' ? S.fix.budget(mill(f.to)) : S.fix[f.key](num(f.n))}</button>`).join('')}"),
  eyebrow: snip("${r.heroFromShortlist ? S.eyebrow_hero_yours : r.confidence && r.confidence.level === 'lean' ? S.eyebrow_lean : S.eyebrow_clear}"),
  heroSize: snip("<p class=\"hero-trim\">${h.sizeKey ? S.size(h.sizeKey) : ''}</p>").slice('<p class="hero-trim">'.length, -'</p>'.length),
  heroRange: snip("${S.from_to(money(h.fit[0].min), money(h.fit[h.fit.length - 1].min))}"),
  heroSub: snip("${h.stretch ? S.over_by(money(h.stretch.over)) : S.n_versions(num(h.fit.length))}"),
  less: snip("${S.less_line({ n: nm(r.less.id), price: money(r.less.price), saves: money(r.less.saves), seven: r.less.seven && b.seats === 7, same: r.less.sameSize })}"),
  checkItems: snip("${checks.map(c => `<li>${S.check[c]}</li>`).join('')}"),
};

const out = `/* GENERATED by tools/build_present.mjs from app/app.js — do not edit by hand.
   Find My Car result composition as a pure module: every block between "verbatim" markers is copied character-for-character
   from the released app/app.js (which is not modified), so the server transport and the browser say the same thing.
   No DOM, window, storage or network here. Drift guard: node tools/build_present.mjs --check */
(function (root) {
  'use strict';

  // b64 for share tokens: the browser's btoa where present, Node's Buffer otherwise (same output for the latin-1 input enc() builds)
  const btoa = typeof root.btoa === 'function' ? s => root.btoa(s) : s => Buffer.from(s, 'latin1').toString('base64');
  const atob = typeof root.atob === 'function' ? s => root.atob(s) : s => Buffer.from(s, 'base64').toString('latin1');

  // one presenter per (dataset, engine, copy); setLang() switches the engine-owned copy (I.S.en / I.S.ar)
  function create(U, E, I) {
    const byId = {}; U.models.forEach(m => { byId[m.id] = m; });
    let lang = 'en', S = I.S.en;
    const setLang = l => { if (!I.S[l]) throw new Error('unsupported locale: ' + l); lang = l; S = I.S[l]; };

    // ---- verbatim: helpers ----
${B.esc}
${B.money}
${B.enc}
${B.share}

    // ---- verbatim: brief helpers + follow-up selection ----
${B.brief}

${B.nextQ}

    // ---- verbatim: "Here's what we understood" ----
${B.summary}

    // ---- verbatim: result pieces (WHY, trade-offs, specs, versions, market, next steps, what could change) ----
${B.pieces}

    // ---- verbatim (renderResult): notices above the result ----
    function topCardsOf(r, b) {
${B.topCards}
      return topCards;
    }
    // ---- verbatim (renderResult): checks before buying ----
    function checksOf(b) {
${B.checks}
      return checks;
    }
    // ---- verbatim (renderResult): template expressions ----
    const nearestHtml = r => \`${X.nearest}\`;
    const nomatchHeadHtml = r => \`${X.nomatchHead}\`;
    const fixesHtml = fixes => \`${X.fixes}\`;
    const eyebrowOf = r => \`${X.eyebrow}\`;
    const heroSizeOf = h => \`${X.heroSize}\`;
    const heroRangeOf = h => \`${X.heroRange}\`;
    const heroSubOf = h => \`${X.heroSub}\`;
    const lessHtml = (r, b) => \`${X.less}\`;
    const checkItemsHtml = checks => \`${X.checkItems}\`;

    // ---- verbatim: shortlist verdict, alternative card, compare table ----
${B.cards}

    // ---- verbatim: the "spend less" car ranked alone against the same brief ----
${B.packFor}

    return {
      setLang, get lang() { return lang; }, get S() { return S; }, byId,
      esc, fmt, num, money, millTxt, mill, nm, nmShort, lat, enc, dec, SHARE_KEYS, slim,
      norm, renorm, merge, family, nextQ, joinList, summaryRows, brandName,
      warrantyTxt, pts, reasons, trades, imageBlock, specs, versionsBlock, marketBlock, nextSteps, isLean, changeBlock, detail, vsLine,
      topCardsOf, checksOf, nearestHtml, nomatchHeadHtml, fixesHtml, eyebrowOf, heroSizeOf, heroRangeOf, heroSubOf, lessHtml, checkItemsHtml,
      shortlistCard, altCard, compareTable, packFor,
    };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CIPresent = api;
})(typeof window !== 'undefined' ? window : globalThis);
`;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== out) { console.error('FAIL app/present.js is out of date with app/app.js — run node tools/build_present.mjs'); process.exit(1); }
  console.log('PASS app/present.js is exactly the verbatim extraction of app/app.js');
} else {
  fs.writeFileSync(OUT, out);
  console.log('wrote', path.relative(ROOT, OUT));
}
