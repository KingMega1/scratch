/**
 * CarIndex buyer-test collector — Google Apps Script web app writing to a Google Sheet (by id).
 * Receives the app's funnel events (text/plain JSON beacons from app/track.js) and appends one row per event.
 * Deploy: script.new → paste → Deploy → New deployment → Web app
 *         (Execute as: Me, Who has access: Anyone) → copy the /exec URL into build_public.py (--endpoint).
 * Rows are linked per journey by session_id; result/feedback/CTA rows share props.recommendation_id.
 * envelope_json holds the full EV3 envelope (all utm_*, env, is_test, client_seq, referrer_origin, ...).
 */
const SHEET = 'events';
const COLS = ['received_at', 'ts', 'event', 'session_id', 'anon_id', 'lang', 'viewport', 'flow_version', 'engine_version', 'utm_source', 'props_json', 'event_id', 'envelope_json'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ev = JSON.parse(e.postData.contents);
    if (typeof ev.event !== 'string' || typeof ev.session_id !== 'string') return out({ ok: false });
    // defence in depth (D5): the app sends only redacted text; never store a raw `text` or a full referrer
    if (ev.props && typeof ev.props === 'object') delete ev.props.text;
    delete ev.referrer;
    const sh = sheet_();
    sh.appendRow([new Date().toISOString(), ev.ts || '', ev.event, ev.session_id, ev.anon_id || '', ev.lang || '', ev.viewport || '',
      ev.flow_version || '', ev.engine_version || '', ev.utm_source || '', JSON.stringify(ev.props || {}).slice(0, 45000), ev.event_id || '', JSON.stringify(ev).slice(0, 45000)]);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, rows: sheet_().getLastRow() - 1 }); }

const SHEET_ID = '1YMny8RS6Vom_70AJzuWrNptAqxxgjZiE__OgN4sMdcY'; // "CarIndex buyer test — events"
function sheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    // the Sheet was created from a CSV header: use its first tab, named "events"
    sh = ss.getSheets()[0];
    if (sh.getLastRow() === 0) sh.appendRow(COLS);
    sh.setName(SHEET); sh.setFrozenRows(1);
  }
  // older Sheets were created with 12 columns: add the envelope_json header once
  if (sh.getLastColumn() < COLS.length) sh.getRange(1, 1, 1, COLS.length).setValues([COLS]);
  return sh;
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
