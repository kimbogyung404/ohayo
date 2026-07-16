import { ReactNode } from 'react';

interface StickyActionBarProps {
  children: ReactNode;
}

// 화면 최하단에 고정되는 흰색 액션 바(BottomNavigation과 동일한 고정/최대너비/safe-area
// 패턴을 공유하되, 내비게이션이 아니라 CTA·Tooltip 등 화면별 하단 액션 콘텐츠를 감싼다).
export default function StickyActionBar({ children }: StickyActionBarProps) {
  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full bg-[var(--color-white)]"
      style={{ maxWidth: 'var(--max-width-app)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex flex-col items-center gap-2 px-[var(--page-padding-x)] pt-3 pb-4">
        {children}
      </div>
    </div>
  );
}
