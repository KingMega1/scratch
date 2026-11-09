'use client';
import { useEffect } from 'react';
import { track } from '@/lib/analytics/client';
import type { WebEvent } from '@/lib/analytics/contract';

export default function TrackOnMount({ event, props, top = {} }: { event: WebEvent; props: Record<string, unknown>; top?: Record<string, string | number> }) {
  const key = JSON.stringify([props, top]);
  useEffect(() => { const [p, t] = JSON.parse(key); track(event, p, t); }, [event, key]);
  return null;
}
