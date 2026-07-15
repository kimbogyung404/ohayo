'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface VocabHighlightProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: ReactNode;
}

export default function VocabHighlight({
  selected = false,
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
        'text-jp-h2',
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
