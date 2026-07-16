'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface VocabCardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

// 상세 학습 플로우에서 단어 하이라이트를 누르면 뜨는 카드 오버레이.
// BottomSheet(핸들/타이틀이 있는 범용 바텀시트)와 달리 카드 콘텐츠만 감싸는
// 전용 다이얼로그라 별도로 둔다. dim에만 onClick을 걸어서, 시트 내부(카드,
// 발음 듣기 버튼 등) 클릭이 버블링돼도 절대 닫히지 않도록 한다.
export default function VocabCardOverlay({ isOpen, onClose, children }: VocabCardOverlayProps) {
  const [entered, setEntered] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // 마운트 다음 프레임에 진입 애니메이션 클래스를 켠다(초기 상태와 동시에
  // 적용하면 transition이 재생되지 않는다).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(isOpen));
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = sheetRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ maxWidth: 'var(--max-width-app)', margin: '0 auto' }}
    >
      {/* dim: 이 요소를 직접 클릭했을 때만 닫는다 */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 transition-opacity motion-reduce:transition-none"
        style={{
          background: 'var(--sheet-overlay)',
          opacity: entered ? 1 : 0,
          transitionDuration: '200ms',
        }}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="단어 카드"
        className="relative w-full bg-[var(--surface-default)] rounded-t-[var(--radius-xl)] p-5 pb-8 transition-transform motion-reduce:transition-none"
        style={{
          boxShadow: 'var(--shadow-overlay)',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          transitionDuration: '200ms',
        }}
      >
        {children}
      </div>
    </div>
  );
}
