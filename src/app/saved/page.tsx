'use client';

import { useState } from 'react';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import FlashCard from '@/components/vocabulary/FlashCard';
import FlashCardNavigation from '@/components/vocabulary/FlashCardNavigation';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/components/ui/Toast';

export default function SavedPage() {
  const { savedWords, unsaveWord, isLoaded } = useSavedVocabulary();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { showToast } = useToast();

  // M1: 로그인 상태 시뮬레이션 (항상 비로그인)
  const isLoggedIn = false;

  const handleUnsave = (vocabularyId: string) => {
    unsaveWord(vocabularyId);
    showToast('저장을 해제했어요.', 'info');
    // 마지막 카드 삭제 시 이전 카드로 이동
    if (currentIndex > 0 && currentIndex >= savedWords.length - 1) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // 비로그인 상태
  if (!isLoggedIn) {
    return (
      <div>
        <header className="px-[var(--page-padding-x)] pt-8 pb-4">
          <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
        </header>
        <EmptyState
          icon="📚"
          title="로그인하면 단어를 저장할 수 있어요"
          description="Google 계정으로 로그인하면 저장한 단어를 플래시카드로 복습하고 다른 기기에서도 이어서 학습할 수 있어요."
          actionLabel="운세 보러 가기"
          actionHref="/"
        />
      </div>
    );
  }

  // 저장 단어 없음
  if (isLoaded && savedWords.length === 0) {
    return (
      <div>
        <header className="px-[var(--page-padding-x)] pt-8 pb-4">
          <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
          <p className="text-caption text-[var(--text-tertiary)] mt-1">
            저장한 단어 0개
          </p>
        </header>
        <EmptyState
          icon="✨"
          title="아직 저장한 단어가 없어요"
          description="운세를 읽다가 모르는 단어를 저장해 보세요!"
          actionLabel="오늘의 운세 보기"
          actionHref="/"
        />
      </div>
    );
  }

  const currentWord = savedWords[currentIndex];

  return (
    <div>
      {/* 헤더 */}
      <header className="px-[var(--page-padding-x)] pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
          <p className="text-caption text-[var(--text-tertiary)] mt-0.5">
            총 {savedWords.length}개
          </p>
        </div>
      </header>

      {/* 플래시카드 내비게이션 (상단) */}
      {savedWords.length > 1 && (
        <FlashCardNavigation
          current={currentIndex}
          total={savedWords.length}
          onPrev={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setCurrentIndex((prev) => Math.min(savedWords.length - 1, prev + 1))}
        />
      )}

      {/* 플래시카드 */}
      {currentWord && (
        <div className="pt-2 pb-8">
          <FlashCard word={currentWord} onUnsave={handleUnsave} />
        </div>
      )}
    </div>
  );
}
