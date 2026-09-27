/**
 * CarIndex buyer-test collector — Google Apps Script bound to a Google Sheet.
 * Receives the app's funnel events (text/plain JSON beacons from app/track.js) and appends one row per event.
 * Deploy: Sheet → Extensions → Apps Script → paste → Deploy → New deployment → Web app
 *         (Execute as: Me, Who has access: Anyone) → copy the /exec URL into build_public.py (--endpoint).
 * Rows are linked per journey by session_id; feedback rows carry the recommendation they refer to (hero_id).
 */
const SHEET = 'events';
const COLS = ['received_at', 'ts', 'event', 'session_id', 'anon_id', 'lang', 'viewport', 'flow_version', 'engine_version', 'utm_source', 'props_json', 'event_id'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const ev = JSON.parse(e.postData.contents);
    if (typeof ev.event !== 'string' || typeof ev.session_id !== 'string') return out({ ok: false });
    const sh = sheet_();
    sh.appendRow([new Date().toISOString(), ev.ts || '', ev.event, ev.session_id, ev.anon_id || '', ev.lang || '', ev.viewport || '',
      ev.flow_version || '', ev.engine_version || '', ev.utm_source || '', JSON.stringify(ev.props || {}).slice(0, 45000), ev.event_id || '']);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, rows: sheet_().getLastRow() - 1 }); }

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) { sh = ss.insertSheet(SHEET); sh.appendRow(COLS); sh.setFrozenRows(1); }
  return sh;
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
