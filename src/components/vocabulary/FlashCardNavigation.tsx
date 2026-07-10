'use client';

interface FlashCardNavigationProps {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function FlashCardNavigation({
  current,
  total,
  onPrev,
  onNext,
}: FlashCardNavigationProps) {
  return (
    <div className="flex items-center justify-between px-[var(--page-padding-x)] py-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={current === 0}
        aria-label="이전 카드"
        className="flex items-center gap-1.5 text-b2-medium text-[var(--text-secondary)] disabled:text-[var(--text-disabled)] disabled:cursor-not-allowed hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-2 py-1"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        이전
      </button>

      {/* 인디케이터 */}
      <span className="text-caption text-[var(--text-tertiary)]" aria-live="polite" aria-atomic="true">
        {current + 1} / {total}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={current === total - 1}
        aria-label="다음 카드"
        className="flex items-center gap-1.5 text-b2-medium text-[var(--text-secondary)] disabled:text-[var(--text-disabled)] disabled:cursor-not-allowed hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-2 py-1"
      >
        다음
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
