'use client';

import { ReactNode } from 'react';

interface HighlightedWordProps {
  children: ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  vocabularyId: string;
  'aria-expanded'?: boolean;
}

export default function HighlightedWord({
  children,
  isSelected = false,
  onClick,
  vocabularyId,
  'aria-expanded': ariaExpanded,
}: HighlightedWordProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-expanded={ariaExpanded}
      aria-controls={`vocab-popover-${vocabularyId}`}
      className="highlighted-word"
      data-selected={isSelected}
    >
      {children}
    </button>
  );
}
