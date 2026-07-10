'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface TranslationRevealProps {
  koreanTranslation: string;
}

export default function TranslationReveal({ koreanTranslation }: TranslationRevealProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <div className="mt-4">
        <div className="p-4 bg-[var(--surface-brand)] rounded-[var(--radius-lg)] border border-[var(--border-brand)]">
          <p className="text-caption text-[var(--text-brand)] font-semibold mb-1">한국어 해석</p>
          <p className="text-b2-medium text-[var(--text-primary)] leading-relaxed">
            {koreanTranslation}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="mt-2 text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1"
        >
          해석 접기
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Button
        variant="secondary"
        size="medium"
        fullWidth
        onClick={() => setIsOpen(true)}
        aria-label="한국어 전체 해석 보기"
      >
        한국어 전체 해석 보기
      </Button>
    </div>
  );
}
