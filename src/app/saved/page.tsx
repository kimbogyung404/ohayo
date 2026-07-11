'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import FlashCard from '@/components/vocabulary/FlashCard';
import FlashCardNavigation from '@/components/vocabulary/FlashCardNavigation';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import { useToast } from '@/components/ui/Toast';

export default function SavedPage() {
  const { user, isLoggedIn, isLoading: isAuthLoading, signOut } = useAuth();
  const { savedWords, unsaveWord, isLoaded, loadError, refresh } = useSavedVocabulary(
    user?.id ?? null
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const { showToast } = useToast();

  const handleUnsave = async (vocabularyId: string) => {
    const { error } = await unsaveWord(vocabularyId);
    if (error) {
      showToast('저장 해제에 실패했어요. 다시 시도해 주세요.', 'error');
      return;
    }
    showToast('저장을 해제했어요.', 'info');
    // 마지막 카드 삭제 시 이전 카드로 이동
    if (currentIndex > 0 && currentIndex >= savedWords.length - 1) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    showToast('로그아웃했어요.', 'info');
  };

  // 로그인 상태 확인 중
  if (isAuthLoading) {
    return (
      <div>
        <header className="px-[var(--page-padding-x)] pt-8 pb-4">
          <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
        </header>
        <LoadingState />
      </div>
    );
  }

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

  // 저장 단어 조회 중
  if (!isLoaded) {
    return (
      <div>
        <header className="px-[var(--page-padding-x)] pt-8 pb-4">
          <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
        </header>
        <LoadingState />
      </div>
    );
  }

  // 조회 실패
  if (loadError) {
    return (
      <div>
        <header className="px-[var(--page-padding-x)] pt-8 pb-4">
          <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
        </header>
        <ErrorState
          title="저장한 단어를 불러오지 못했어요"
          description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          onRetry={refresh}
        />
      </div>
    );
  }

  // 저장 단어 없음
  if (savedWords.length === 0) {
    return (
      <div>
        <header className="px-[var(--page-padding-x)] pt-8 pb-4 flex items-start justify-between">
          <div>
            <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
            <p className="text-caption text-[var(--text-tertiary)] mt-1">
              저장한 단어 0개
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1 py-1"
          >
            로그아웃
          </button>
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
      <header className="px-[var(--page-padding-x)] pt-8 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">저장한 단어</h1>
          <p className="text-caption text-[var(--text-tertiary)] mt-0.5">
            총 {savedWords.length}개
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1 py-1"
        >
          로그아웃
        </button>
      </header>

      {/* 플래시카드 내비게이션 (상단) — 현재 위치 표시를 위해 카드가 1개여도 항상 렌더링 */}
      <FlashCardNavigation
        current={currentIndex}
        total={savedWords.length}
        onPrev={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
        onNext={() => setCurrentIndex((prev) => Math.min(savedWords.length - 1, prev + 1))}
      />

      {/* 플래시카드 */}
      {currentWord && (
        <div className="pt-2 pb-8">
          <FlashCard word={currentWord} onUnsave={handleUnsave} />
        </div>
      )}
    </div>
  );
}
