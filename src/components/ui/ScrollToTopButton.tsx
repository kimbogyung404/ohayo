'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';

const SCROLL_SHOW_THRESHOLD = 300;

// 길게 스크롤되는 화면 어디서나 재사용 가능한 범용 FAB — 특정 화면(저장된 단어 등)의
// 데이터나 상태에 의존하지 않는다.
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > SCROLL_SHOW_THRESHOLD);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = useCallback(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, []);

  if (!visible) return null;

  return (
    // BottomNavigation과 같은 "고정 폭 중앙 정렬" 래퍼(fixed + left-1/2 +
    // -translate-x-1/2 + max-width: var(--max-width-app))를 그대로 재사용해,
    // 480px보다 넓은 뷰포트에서도 앱 컨테이너 오른쪽 여백 기준으로 정렬되고
    // 실제 viewport 우측 끝에는 붙지 않는다.
    <div
      className="pointer-events-none fixed left-1/2 z-20 w-full -translate-x-1/2"
      style={{
        maxWidth: 'var(--max-width-app)',
        bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + var(--space-4))',
      }}
    >
      <div className="flex justify-end pr-[var(--page-padding-x)]">
        <button
          type="button"
          aria-label="맨 위로 이동"
          onClick={handleClick}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-white)] text-[var(--text-tertiary)] transition-opacity"
          style={{ boxShadow: 'var(--shadow-300)' }}
        >
          <Icon name="double-chevron-up" size={24} />
        </button>
      </div>
    </div>
  );
}
