'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import Tooltip from './Tooltip';

interface VocabHighlightProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  // 페이지 전체에서 첫 번째 단어 하이라이트에만 전달한다. 탭 가능하다는 것을 알려주는
  // 1회성 안내이며, selected(확인 완료)가 되는 순간 자동으로 사라진다.
  // 디자인 시스템 Tooltip(components/ui/Tooltip.tsx)을 그대로 사용한다 — 별도 말풍선
  // 스타일을 새로 만들지 않는다.
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
    <span
      className={[
        'relative inline-block',
        // 툴팁이 위로 뜰 공간은 이 하이라이트의 래퍼에만 준다 — 문단 전체를 밀어내지
        // 않고, 첫 하이라이트가 있는 줄만 필요한 만큼 살짝 커진다.
        hint ? 'mt-12' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hint && !selected && (
        // Tooltip 내부 버블은 max-w-full이라 이 span(=하이라이트 버튼 폭)에 맞춰 좁아진다.
        // "復活"처럼 짧은 단어가 첫 하이라이트일 때 버튼이 좁아 문구가 3줄로 접히며
        // 예상보다 훨씬 높아지는 문제가 있어, 단어 폭과 무관하게 한 줄에 들어가도록
        // 최소 너비만 지정한다(타이포·색상·radius·shadow·화살표는 그대로).
        <Tooltip
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-0.5 min-w-[160px]"
        >
          {hint}
        </Tooltip>
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
