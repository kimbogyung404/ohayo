'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface VocabHighlightProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  // 강조된 단어가 지금 어떤 언어로 표시되고 있는지. 기본값 'ja'는 기존 사용처
  // (일본어 원문 SegmentedText, 행운 아이템)의 타이포를 그대로 유지한다.
  // 'ko'는 한국어 활용형(koreanText)이 표시될 때만 사용한다(Pretendard 24px H1).
  language?: 'ja' | 'ko';
  children: ReactNode;
}

export default function VocabHighlight({
  selected = false,
  language = 'ja',
  className = '',
  children,
  ...props
}: VocabHighlightProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        'inline-flex items-center justify-center p-[10px]',
        'rounded-[var(--radius-md)] border-0 appearance-none',
        'font-[var(--font-primary)] cursor-pointer',
        language === 'ko' ? 'text-h1' : 'text-jp-h2',
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
  );
}
