'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface VocabHighlightProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  // 페이지 전체에서 첫 번째 단어 하이라이트에만 전달한다. 탭 가능하다는 것을 알려주는
  // 1회성 안내이며, selected(확인 완료)가 되는 순간 자동으로 사라진다.
  hint?: string;
  children: ReactNode;
}

// 언어(일본어 원문/한국어 활용형)와 무관하게 항상 18px(.text-b1-medium)로 표시해
// 본문 텍스트와 하이라이트 단어의 글자 크기를 동일하게 맞춘다.
export default function VocabHighlight({
  selected = false,
  hint,
  className = '',
  children,
  ...props
}: VocabHighlightProps) {
  return (
    <span className="relative inline-block">
      {hint && !selected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-0 mb-0.5 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--gray-700)] px-2 py-1 text-caption text-[var(--text-inverse)] shadow-[var(--shadow-200)]"
        >
          {hint}
        </span>
      )}
      <button
        type="button"
        aria-pressed={selected}
        className={[
          'inline-flex items-center justify-center p-[10px]',
          'rounded-[var(--radius-md)] border-0 appearance-none',
          'font-[var(--font-primary)] cursor-pointer',
          'text-b1-medium',
          selected
            ? 'bg-[var(--surface-brand)] text-[var(--brand-primary)]'
            : 'bg-[var(--surface-subtle)] text-[var(--text-tertiary)]',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </button>
    </span>
  );
}
