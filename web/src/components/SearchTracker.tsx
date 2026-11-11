'use client';
import { useEffect } from 'react';
import { track } from '@/lib/analytics/client';
import { redact } from '@/lib/analytics/redact';

/* Search terms are free text: only the redacted form and length are sent (EV3 / D5). */
export default function SearchTracker({ q, results }: { q: string; results: number }) {
  useEffect(() => { const r = redact(q); track('search_submit', { q_chars: q.length, q_redacted: r.text_redacted, results }); }, [q, results]);
  return null;
}
