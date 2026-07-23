'use client';

import { ReactNode, useEffect, useRef } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // 배경(dim 영역) 클릭 시 닫기. dim은 오버레이 컨테이너를 꽉 채우는 자식 요소라
  // 실제 클릭 지점의 e.target은 항상 그 자식(또는 시트 내부 요소)이지 컨테이너
  // 자신(e.currentTarget)이 될 수 없다 — 그래서 시트 콘텐츠 바깥(=dim 영역)에서
  // 발생한 클릭인지는 시트 본체(sheetRef) 안쪽인지 여부로 판단한다.
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // 포커스 트랩 (첫 열릴 때)
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      const focusable = sheetRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      aria-label={title}
      style={{ maxWidth: 'var(--max-width-app)', margin: '0 auto' }}
    >
      {/* 오버레이 */}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--sheet-overlay)' }}
      />

      {/* 시트 본체 */}
      <div
        ref={sheetRef}
        className="relative w-full bg-[var(--surface-default)] rounded-t-[var(--radius-xl)]"
        style={{ boxShadow: 'var(--shadow-overlay)', maxHeight: '90dvh' }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-9 h-1 rounded-full bg-[var(--gray-300)]"
            aria-hidden="true"
          />
        </div>

        {/* 타이틀 */}
        {title && (
          <div className="px-5 pt-2 pb-1">
            <h2 className="text-h2 text-[var(--text-primary)]">{title}</h2>
          </div>
        )}

        {/* 콘텐츠 */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90dvh - 48px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
