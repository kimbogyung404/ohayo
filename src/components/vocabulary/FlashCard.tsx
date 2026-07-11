'use client';

import { useState } from 'react';
import type { SavedWord } from '@/types/vocabulary';
import Button from '@/components/ui/Button';

interface FlashCardProps {
  word: SavedWord;
  onUnsave: (vocabularyId: string) => void;
}

export default function FlashCard({ word, onUnsave }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const savedDate = new Date(word.savedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="w-full px-[var(--page-padding-x)]">
      {/* 카드 뒤집기 버튼 */}
      <button
        type="button"
        onClick={() => setIsFlipped((v) => !v)}
        aria-label={isFlipped ? '카드 앞면 보기' : '카드 뒷면 보기 (읽는 법과 뜻 확인)'}
        className="w-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded-[var(--radius-xl)]"
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative w-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform var(--transition-flip)',
            minHeight: '240px',
          }}
        >
          {/* 앞면 */}
          <div
            className="absolute inset-0 rounded-[var(--radius-xl)] bg-[var(--surface-default)] border border-[var(--border-default)] flex flex-col items-center justify-center p-6 gap-3"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            aria-hidden={isFlipped}
          >
            <p
              className="text-display text-[var(--text-primary)] text-center"
              lang="ja"
            >
              {word.vocabulary.surfaceForm}
            </p>
            <p className="text-caption text-[var(--text-tertiary)]">
              뜻을 떠올린 뒤 카드를 눌러보세요
            </p>
          </div>

          {/* 뒷면 */}
          <div
            className="absolute inset-0 rounded-[var(--radius-xl)] bg-[var(--surface-brand)] border border-[var(--border-brand)] flex flex-col p-6 gap-3 overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              minHeight: '240px',
            }}
            aria-hidden={!isFlipped}
          >
            {/* 읽는 법 + 뜻 */}
            <div className="text-center">
              <p className="text-caption text-[var(--text-brand)] font-semibold mb-1" lang="ja">
                {word.vocabulary.reading}
              </p>
              <p className="text-h1 text-[var(--text-primary)] font-semibold">
                {word.vocabulary.meaning}
              </p>
              {word.vocabulary.word !== word.vocabulary.surfaceForm && (
                <p className="text-caption text-[var(--text-tertiary)] mt-1">
                  기본형: <span lang="ja">{word.vocabulary.word}</span>
                </p>
              )}
            </div>

            {/* 구분선 */}
            <div className="border-t border-[var(--border-brand)] my-1" />

            {/* 운세 문장 */}
            <div>
              <p className="text-caption text-[var(--text-secondary)] mb-1">
                {word.zodiacKorean} · {word.fortuneDate}
              </p>
              <p className="text-b2-regular text-[var(--text-primary)]" lang="ja">
                {word.originalText}
              </p>
              <p className="text-b2-regular text-[var(--text-secondary)] mt-1">
                {word.koreanTranslation}
              </p>
            </div>

            {/* 저장 날짜 */}
            <p className="text-caption text-[var(--text-tertiary)] mt-auto">
              {savedDate}에 저장
            </p>
          </div>
        </div>
      </button>

      {/* 저장 해제 */}
      <div className="mt-4">
        <Button
          variant="ghost"
          size="medium"
          fullWidth
          onClick={() => onUnsave(word.vocabularyId)}
          aria-label={`${word.vocabulary.word} 저장 해제`}
        >
          저장 해제
        </Button>
      </div>
    </div>
  );
}
