'use client';

import { useState } from 'react';

interface ReadingRevealProps {
  readingText: string;
}

export default function ReadingReveal({ readingText }: ReadingRevealProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 text-b2-medium text-[var(--text-brand)] hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1"
      >
        <span>{isOpen ? '▼' : '▶'}</span>
        <span>읽는 법 열기</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-[var(--surface-subtle)] rounded-[var(--radius-md)] text-b2-regular text-[var(--text-secondary)]" lang="ja">
          {readingText}
        </div>
      )}
    </div>
  );
}
