'use client';

import type { Vocabulary } from '@/types/fortune';
import Button from '@/components/ui/Button';

interface VocabularyPopoverProps {
  vocab: Vocabulary;
  isSaved: boolean;
  onSave: () => void;
  onUnsave: () => void;
  id: string;
}

export default function VocabularyPopover({
  vocab,
  isSaved,
  onSave,
  onUnsave,
  id,
}: VocabularyPopoverProps) {
  return (
    <div
      id={id}
      className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-default)] p-4"
      style={{ boxShadow: 'var(--shadow-overlay)' }}
      role="region"
      aria-label={`${vocab.word} 단어 정보`}
    >
      {/* 단어 기본형 + 로마자 문자 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-h2 text-[var(--text-primary)]" lang="ja">
              {vocab.surfaceForm}
            </span>
            <span className="text-caption text-[var(--text-tertiary)]" lang="ja">
              {vocab.reading}
            </span>
          </div>
          <p className="text-b2-medium text-[var(--text-secondary)] mt-0.5">
            {vocab.meaning}
          </p>
          {vocab.word !== vocab.surfaceForm && (
            <p className="text-caption text-[var(--text-tertiary)] mt-1">
              기본형: <span lang="ja">{vocab.word}</span>
            </p>
          )}
        </div>
      </div>

      {/* 저장 버튼 */}
      <Button
        variant={isSaved ? 'secondary' : 'primary'}
        size="medium"
        fullWidth
        onClick={isSaved ? onUnsave : onSave}
        aria-label={isSaved ? `${vocab.word} 저장 해제` : `${vocab.word} 저장`}
      >
        {isSaved ? '✓ 저장됨' : '+ 단어 저장'}
      </Button>
    </div>
  );
}
