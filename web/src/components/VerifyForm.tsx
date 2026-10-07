'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { track } from '@/lib/analytics/client';

/* Mobile-first verification UI. Values are posted to the BFF only; never logged or sent to analytics. */
export default function VerifyForm({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const a = dict(locale).account;
  const [msg, setMsg] = useState<string | null>(enabled ? null : a.gated);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!enabled) track('identity_gate_view', {}); }, [enabled]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enabled) { setMsg(a.gated); return; }
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/v1/identity/otp/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'sms', destination: fd.get('phone') }) }).catch(() => null);
    setBusy(false);
    setMsg(res && res.ok ? null : a.gated);
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14, maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="phone">{a.phone}</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="01XXXXXXXXX" disabled={!enabled} />
      </div>
      <div className="field">
        <label htmlFor="email">{a.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" dir="ltr" disabled={!enabled} />
      </div>
      <div><button className="btn btn-primary" type="submit" aria-disabled={!enabled || busy} disabled={busy}>{a.send}</button></div>
      {msg ? <p className="gated" role="status">{msg}</p> : null}
    </form>
  );
}
