'use client';

import { useEffect, useRef } from 'react';
import { trackPageViewed } from '@/lib/analytics/events';

// RootLayout은 클라이언트 사이드 내비게이션에서 재마운트되지 않으므로, 이 컴포넌트의
// 마운트는 곧 "사이트 첫 진입"과 같다. Strict Mode의 mount→cleanup→mount 이중 실행에도
// 같은 컴포넌트 인스턴스라 ref가 유지되므로, page_viewed는 세션당 정확히 한 번만
// 전송된다. RootLayout에서 다른 페이지 컨텐츠보다 먼저 렌더되어야 learning_started 등
// 이후 이벤트보다 먼저 발생함이 보장된다.
export default function PageViewTracker() {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackPageViewed();
  }, []);

  return null;
}
