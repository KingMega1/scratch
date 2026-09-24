// CarIndex Buyer Check renderer: structured content JSON -> 6 fixed HTML slides (1080x1350).
// Layout lives here, never in the LLM. Every number printed comes from content.key_data;
// missing/conflicting facts render as an explicit "not available" label, never a guess.
// Used verbatim inside the n8n "Carousel Designer" Code node (see n8n/patch_workflow.py)
// and by run_golden_path.js locally.

const BC_ROLES = ['cover', 'key_fact', 'why_it_matters', 'strengths', 'caveat', 'cta_source'];

const BC_FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap">';

function bcEsc(v) {
  return (v === undefined || v === null ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bcFact(content, id) {
  return (content.key_data || []).find(k => k.id === id) || null;
}

function bcFactValueHtml(f, big) {
  if (!f || f.status !== 'verified' || f.value === null || f.value === undefined || f.value === '') {
    const why = f && f.status === 'conflict' ? 'أرقام متضاربة · Sources conflict' : 'غير متاح · Not in source';
    return `<span class="na${big ? ' na-big' : ''}">${why}</span>`;
  }
  return `<span class="num">${bcEsc(f.value)}</span>${f.unit ? ` <span class="unit">${bcEsc(f.unit)}</span>` : ''}`;
}

function bcSourceLabel(content, sourceId) {
  const s = (content.sources || []).find(x => x.id === sourceId);
  return s ? `${bcEsc(s.outlet)} · ${bcEsc(s.published)}` : '';
}

function bcFilename(postId, n, role) {
  return `${postId}_${String(n).padStart(2, '0')}_${role}.png`;
}

function bcShell(opts, n, bg, dark, inner, footer) {
  const logo = dark ? opts.logoWhiteUrl : opts.logoUrl;
  const fg = dark ? '#FFFFFF' : '#0B0E1A';
  const muted = dark ? 'rgba(255,255,255,0.55)' : '#6B7280';
  return `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="utf-8">
${BC_FONTS}
<style>
  body { margin:0; }
  .slide { width:1080px; height:1350px; position:relative; overflow:hidden; background:${bg}; color:${fg}; font-family:'Poppins',sans-serif; display:flex; flex-direction:column; box-sizing:border-box; }
  .top { display:flex; justify-content:space-between; align-items:center; padding:36px 48px 0; position:relative; z-index:2; }
  .top img { height:32px; width:auto; }
  .count { font-family:'JetBrains Mono',monospace; font-weight:700; font-size:18px; color:${muted}; }
  .main { flex:1; display:flex; flex-direction:column; justify-content:center; padding:0 48px; gap:28px; position:relative; z-index:2; }
  .ar { direction:rtl; font-family:'Cairo',sans-serif; }
  .en { font-family:'Poppins',sans-serif; color:${muted}; }
  .kicker { font-family:'JetBrains Mono',monospace; font-size:16px; letter-spacing:0.16em; text-transform:uppercase; color:#1D6FE0; }
  .num { font-family:'JetBrains Mono',monospace; font-weight:700; }
  .unit { font-family:'JetBrains Mono',monospace; font-weight:500; opacity:0.7; }
  .na { font-family:'Cairo',sans-serif; font-weight:700; color:#B7791F; background:rgba(255,176,32,0.14); padding:2px 10px; }
  .na-big { font-size:44px; }
  .foot { padding:0 48px 34px; font-family:'JetBrains Mono',monospace; font-size:15px; color:${muted}; display:flex; justify-content:space-between; gap:24px; position:relative; z-index:2; }
  .clip { overflow:hidden; }
</style>
</head>
<body>
<div class="slide" data-slide="${n}">
  <div class="top"><img src="${bcEsc(logo)}" alt="CARINDEX"><div class="count">${n}/6</div></div>
  ${inner}
  <div class="foot"><span>${footer || ''}</span><span>BUYER CHECK</span></div>
</div>
</body>
</html>`;
}

function bcCarName(c) {
  const car = c.car || {};
  return [car.make, car.model, car.variant].filter(Boolean).join(' ');
}

function bcCover(c, s, opts) {
  const f = bcFact(c, (s.fact_ids || [])[0]);
  const inner = `
  <div style="position:absolute; inset:0; z-index:1;">
    <img src="${bcEsc(opts.imageUrl)}" alt="${bcEsc(bcCarName(c))}" style="position:absolute; top:0; left:0; width:1080px; height:860px; object-fit:cover;">
    <div style="position:absolute; top:0; left:0; right:0; height:200px; background:linear-gradient(180deg, rgba(11,14,26,0.65), rgba(11,14,26,0));"></div>
    <div style="position:absolute; top:560px; left:0; right:0; bottom:0; background:linear-gradient(180deg, rgba(11,14,26,0) 0%, #0B0E1A 44%);"></div>
  </div>
  <div class="main" style="justify-content:flex-end; padding-bottom:26px; gap:18px;">
    <div class="kicker" style="color:#7FB0F0;">Buyer Check · ${bcEsc(bcCarName(c))}</div>
    <div class="ar clip" style="font-weight:800; font-size:64px; line-height:1.2; max-height:236px;">${bcEsc(c.hook.ar)}</div>
    <div class="en clip" style="font-weight:600; font-size:28px; line-height:1.35; color:rgba(255,255,255,0.72); max-height:80px;">${bcEsc(c.hook.en)}</div>
    ${f ? `<div style="display:flex; align-items:baseline; gap:14px; border-top:2px solid #1D6FE0; padding-top:18px; font-size:44px;">${bcFactValueHtml(f)}<span class="ar" style="font-size:22px; color:rgba(255,255,255,0.6);">${bcEsc(f.label_ar)}</span></div>` : ''}
  </div>`;
  return bcShell(opts, 1, '#0B0E1A', true, inner, `Image: ${bcEsc(opts.imageCredit)}`);
}

function bcKeyFact(c, s, opts) {
  const f = bcFact(c, (s.fact_ids || [])[0]);
  const inner = `
  <div class="main">
    <div class="kicker" style="color:rgba(255,255,255,0.8);">${bcEsc(s.title_en)}</div>
    <div class="ar" style="font-weight:700; font-size:36px; color:rgba(255,255,255,0.9);">${bcEsc(s.title_ar)}</div>
    <div style="font-size:150px; line-height:0.95; letter-spacing:-0.03em; color:#FFFFFF;">${bcFactValueHtml(f, true)}</div>
    <div class="ar" style="font-weight:600; font-size:24px; color:rgba(255,255,255,0.75);">${bcEsc(f ? f.label_ar : '')} <span style="font-family:'Poppins',sans-serif; font-size:18px;">· ${bcEsc(f ? f.label_en : '')}</span></div>
    <div style="height:2px; background:rgba(255,255,255,0.25);"></div>
    <div class="ar clip" style="font-weight:600; font-size:30px; line-height:1.55; max-height:190px;">${bcEsc(s.body_ar)}</div>
    <div class="en clip" style="font-size:22px; line-height:1.5; color:rgba(255,255,255,0.7); max-height:100px;">${bcEsc(s.body_en)}</div>
  </div>`;
  return bcShell(opts, 2, '#1D6FE0', true, inner, f ? `Source: ${bcSourceLabel(c, f.source_id)}` : '');
}

function bcRows(c, ids) {
  return (ids || []).map(id => bcFact(c, id)).filter(Boolean).map(f => `
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:20px; background:#FFFFFF; padding:18px 24px;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div class="ar" style="font-weight:700; font-size:22px;">${bcEsc(f.label_ar)}</div>
          <div class="en" style="font-size:15px;">${bcEsc(f.label_en)}${f.source_id ? ' · ' + bcSourceLabel(c, f.source_id) : ''}</div>
        </div>
        <div style="font-size:34px; white-space:nowrap;">${bcFactValueHtml(f)}</div>
      </div>`).join('');
}

function bcWhy(c, s, opts) {
  const inner = `
  <div class="main" style="gap:22px;">
    <div class="kicker">Why it matters</div>
    <div class="ar clip" style="font-weight:800; font-size:48px; line-height:1.2; max-height:120px;">${bcEsc(s.title_ar)}</div>
    <div class="en" style="font-weight:600; font-size:20px;">${bcEsc(s.title_en)}</div>
    <img src="${bcEsc(opts.imageUrl)}" alt="" style="width:984px; height:300px; object-fit:cover;">
    <div class="ar clip" style="font-weight:600; font-size:27px; line-height:1.55; max-height:170px;">${bcEsc(s.body_ar)}</div>
    <div class="en clip" style="font-size:20px; line-height:1.5; max-height:92px;">${bcEsc(s.body_en)}</div>
    <div style="display:flex; flex-direction:column; gap:8px;">${bcRows(c, (s.fact_ids || []).slice(0, 3))}</div>
  </div>`;
  return bcShell(opts, 3, '#F5F1EA', false, inner, '');
}

function bcPoints(points, color) {
  return (points || []).slice(0, 3).map((p, i) => `
      <div style="direction:rtl; display:flex; align-items:flex-start; gap:18px; background:#FFFFFF; padding:24px 26px;">
        <div style="flex-shrink:0; width:44px; height:44px; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center;"><span class="num" style="font-size:18px; color:#FFFFFF;">0${i + 1}</span></div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div class="ar clip" style="font-weight:700; font-size:30px; line-height:1.5; max-height:135px;">${bcEsc(p.ar)}</div>
          <div class="clip" style="direction:ltr; font-family:'Poppins',sans-serif; font-size:20px; line-height:1.45; color:#6B7280; max-height:60px;">${bcEsc(p.en)}</div>
        </div>
      </div>`).join('');
}

function bcStrengths(c, s, opts) {
  const inner = `
  <div class="main" style="gap:24px;">
    <img src="${bcEsc(opts.imageUrl)}" alt="" style="width:984px; height:340px; object-fit:cover;">
    <div style="direction:rtl; display:flex; align-items:center; gap:18px;">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1F8A44" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><path d="M7.5 12.5l3 3 6-6.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
      <div><div class="ar" style="font-weight:800; font-size:48px; line-height:1.15; color:#1F8A44;">${bcEsc(s.title_ar)}</div>
      <div class="en" style="font-weight:600; font-size:19px; color:#4C7A5A;">${bcEsc(s.title_en)}</div></div>
    </div>
    <div style="display:flex; flex-direction:column; gap:14px;">${bcPoints(s.points, '#1F8A44')}</div>
  </div>`;
  return bcShell(opts, 4, '#E4F2E8', false, inner, '');
}

function bcCaveat(c, s, opts) {
  const skip = (s.skip_if || []).slice(0, 2).map(x => `
        <div style="direction:rtl; display:flex; gap:14px; align-items:flex-start;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E05B4B" stroke-width="2.6" style="flex-shrink:0; margin-top:8px;"><path d="M7 7l10 10M17 7l-10 10" stroke-linecap="round"></path></svg>
          <div><div class="ar clip" style="font-weight:700; font-size:30px; line-height:1.5; color:#FFFFFF; max-height:140px;">${bcEsc(x.ar)}</div>
          <div class="clip" style="direction:ltr; font-size:20px; line-height:1.4; color:rgba(255,255,255,0.55); max-height:58px;">${bcEsc(x.en)}</div></div>
        </div>`).join('');
  const inner = `
  <div class="main" style="gap:30px;">
    <div style="direction:rtl; display:flex; align-items:center; gap:18px;">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2.4"><circle cx="12" cy="12" r="10"></circle><path d="M12 7v6M12 16.5v.5" stroke-linecap="round"></path></svg>
      <div><div class="ar" style="font-weight:800; font-size:48px; line-height:1.15; color:#C0392B;">${bcEsc(s.title_ar)}</div>
      <div class="en" style="font-weight:600; font-size:19px; color:#9C5A52;">${bcEsc(s.title_en)}</div></div>
    </div>
    <div style="background:#FFFFFF; padding:36px 36px; display:flex; flex-direction:column; gap:14px;">
      <div class="ar clip" style="font-weight:700; font-size:38px; line-height:1.55; max-height:300px;">${bcEsc(s.body_ar)}</div>
      <div class="clip" style="font-size:24px; line-height:1.5; color:#6B7280; max-height:92px;">${bcEsc(s.body_en)}</div>
    </div>
    <div style="background:#0B0E1A; border-right:5px solid #C0392B; padding:32px 32px; display:flex; flex-direction:column; gap:18px;">
      <div class="ar" style="font-weight:800; font-size:32px; color:#E05B4B;">تجاهلها لو · <span style="font-family:'Poppins',sans-serif; font-size:18px;">Skip it if</span></div>
      ${skip}
    </div>
  </div>`;
  return bcShell(opts, 5, '#F7E4E1', false, inner, '');
}

function bcCta(c, s, opts) {
  const used = new Set((c.key_data || []).map(k => k.source_id).filter(Boolean));
  const srcs = (c.sources || []).filter(x => used.has(x.id)).slice(0, 4).map((x, i) => `
      <div style="display:flex; gap:18px; align-items:flex-start; background:rgba(255,255,255,0.06); padding:16px 20px;">
        <div class="num" style="color:#7FB0F0; font-size:18px;">0${i + 1}</div>
        <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div style="font-weight:600; font-size:20px; color:#FFFFFF;">${bcEsc(x.outlet)} · <span class="num" style="font-weight:500; font-size:17px;">${bcEsc(x.published)}</span></div>
          <div class="clip" style="font-size:15px; color:rgba(255,255,255,0.55); white-space:nowrap; text-overflow:ellipsis; max-width:900px;">${bcEsc(x.what)}</div>
        </div>
      </div>`).join('');
  const missing = (c.key_data || []).filter(k => k.status !== 'verified');
  const missingLine = missing.length
    ? `<div class="ar" style="font-weight:600; font-size:20px; color:#FFB020;">غير متاح في المصادر: ${missing.map(k => bcEsc(k.label_ar)).join('، ')}</div>`
    : '';
  const inner = `
  <div class="main" style="gap:22px;">
    <img src="${bcEsc(opts.imageUrl)}" alt="" style="width:984px; height:260px; object-fit:cover; opacity:0.85;">
    <div class="ar clip" style="font-weight:800; font-size:46px; line-height:1.25; max-height:120px;">${bcEsc(s.title_ar)}</div>
    <div class="en" style="font-weight:600; font-size:22px; color:rgba(255,255,255,0.7);">${bcEsc(s.title_en)}</div>
    <div style="display:flex; gap:14px;">
      <div style="flex:1; background:#1D6FE0; padding:22px 26px;"><div class="ar" style="font-weight:800; font-size:28px;">احفظ البوست</div><div style="font-size:17px; color:rgba(255,255,255,0.8);">Save for your shortlist</div></div>
      <div style="flex:1; background:rgba(255,255,255,0.08); padding:22px 26px;"><div class="ar" style="font-weight:800; font-size:28px;">تابع CarIndex</div><div style="font-size:17px; color:rgba(255,255,255,0.6);">Numbers first, opinions last</div></div>
    </div>
    <div class="kicker" style="color:#7FB0F0;">Sources</div>
    <div style="display:flex; flex-direction:column; gap:8px;">${srcs}</div>
    ${missingLine}
    <div style="font-size:15px; color:rgba(255,255,255,0.45);">Image: ${bcEsc(opts.imageCredit)} · Prices change, confirm with the official dealer.</div>
  </div>`;
  return bcShell(opts, 6, '#0B0E1A', true, inner, '');
}

const BC_BUILDERS = { cover: bcCover, key_fact: bcKeyFact, why_it_matters: bcWhy, strengths: bcStrengths, caveat: bcCaveat, cta_source: bcCta };

// content: parsed Buyer Check JSON. opts: {postId, imageUrl, imageCredit, logoUrl, logoWhiteUrl}
function buildBuyerCheckSlides(content, opts) {
  const slides = Array.isArray(content.slides) ? content.slides : [];
  return BC_ROLES.map((role, i) => {
    const s = slides.find(x => x && x.role === role) || { role, n: i + 1 };
    return {
      slideNumber: i + 1,
      totalSlides: BC_ROLES.length,
      role,
      filename: bcFilename(opts.postId, i + 1, role),
      html: BC_BUILDERS[role](content, s, opts),
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildBuyerCheckSlides, bcFilename, BC_ROLES };
}
