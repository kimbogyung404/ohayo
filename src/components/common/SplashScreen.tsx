'use client';

import { useEffect, useState } from 'react';
import Logo from '@/components/ui/Logo';

const HOLD_MS = 1200;
const FADE_MS = 280;

type Phase = 'visible' | 'fading' | 'done';

// 서버 렌더와 클라이언트 첫 hydration 렌더는 항상 동일하게 "visible" 마크업을
// 그린다(hydration mismatch 방지, 서버 HTML에도 .splash-screen이 항상 존재).
// 이미 본 세션인지 여부는 root layout의 블로킹 인라인 스크립트(src/lib/splash.ts)가
// 페인트 전에 document.documentElement의 data-splash-seen 속성으로 CSS에 먼저
// 알리고(globals.css), 이 컴포넌트는 hydration 이후에만 그 값을 읽어 애니메이션
// 재생 여부(첫 방문이면 hold→fade, 이미 봤으면 즉시 unmount)를 정한다.
export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('visible');

  useEffect(() => {
    if (document.documentElement.dataset.splashSeen === 'true') {
      const raf = requestAnimationFrame(() => setPhase('done'));
      return () => cancelAnimationFrame(raf);
    }

    const holdTimer = setTimeout(() => setPhase('fading'), HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'fading') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doneTimer = setTimeout(() => setPhase('done'), prefersReducedMotion ? 0 : FADE_MS);
    return () => clearTimeout(doneTimer);
  }, [phase]);

  // 표시 중에만 배경 스크롤을 잠근다. 이미 본 세션(CSS로 즉시 숨겨짐)에는
  // 애초에 잠그지 않는다.
  useEffect(() => {
    if (phase === 'done') return;
    if (document.documentElement.dataset.splashSeen === 'true') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      className={['splash-screen', phase === 'fading' ? 'splash-fade-out' : ''].filter(Boolean).join(' ')}
      role="presentation"
      aria-hidden="true"
    >
      <div className="splash-inner">
        <Logo className="splash-logo" />
        <p className="splash-tagline">별자리 운세로 배우는 일본어</p>
      </div>
    </div>
  );
}
