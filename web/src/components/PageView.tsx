'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { setAnalyticsContext, track } from '@/lib/analytics/client';

export default function PageView({ universeVersion }: { universeVersion: string }) {
  const pathname = usePathname();
  useEffect(() => { setAnalyticsContext({ universe_version: universeVersion }); }, [universeVersion]);
  useEffect(() => { track('page_view', { route: pathname }); }, [pathname]);
  return null;
}
