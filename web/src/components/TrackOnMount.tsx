'use client';
import { useEffect } from 'react';
import { track } from '@/lib/analytics/client';
import type { WebEvent } from '@/lib/analytics/contract';

export default function TrackOnMount({ event, props }: { event: WebEvent; props: Record<string, unknown> }) {
  const key = JSON.stringify(props);
  useEffect(() => { track(event, JSON.parse(key)); }, [event, key]);
  return null;
}
