'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import AuthTopNav from '@/components/common/AuthTopNav';
import VocabCard from '@/components/ui/VocabCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import { useToast } from '@/components/ui/Toast';
import BottomNavigation from '@/components/ui/BottomNavigation';
import { speak } from '@/lib/speak';
import { trackSavedTabViewed, trackSavedVocabFlipped } from '@/lib/analytics/events';
import type { SavedWord } from '@/types/vocabulary';

export default function SavedPage() {
  const { user, isLoggedIn, isLoading: isAuthLoading } = useAuth();
  const { savedWords, unsaveWords, isLoaded, loadError, refresh } = useSavedVocabulary(
    user?.id ?? null
  );
  const { showToast } = useToast();

  // 카드별 독립적인 뒤집힘 상태 (삭제 모드가 아닐 때만 의미가 있다)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // saved_tab_viewed 중복 전송 방지 — 목록이 실제로 표시된 시점에 이 마운트당 1회만.
  const savedTabViewedTrackedRef = useRef(false);
  useEffect(() => {
    if (!isLoggedIn || !isLoaded || loadError) return;
    if (savedTabViewedTrackedRef.current) return;
    savedTabViewedTrackedRef.current = true;
    trackSavedTabViewed({ count: savedWords.length });
  }, [isLoggedIn, isLoaded, loadError, savedWords.length]);

  const toggleReveal = (id: string, vocabularyId: string) => {
    // 앞면 → 뒷면(공개)으로 바뀌는 순간만 전송한다. 뒷면 → 앞면으로 되돌아갈 때는
    // 전송하지 않는다.
    const willReveal = !revealedIds.has(id);
    if (willReveal) {
      trackSavedVocabFlipped({ vocabularyId });
    }
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePlayAudio = (item: SavedWord) => {
    speak(item.vocabulary.reading || item.vocabulary.surfaceForm);
  };

  const enterDeleteMode = () => {
    setDeleteMode(true);
    setSelectedIds(new Set());
  };

  const cancelDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds(new Set());
  };

  const handleDeleteRequest = async () => {
    if (selectedIds.size === 0 || isDeleting) return;

    const confirmed = window.confirm(`선택한 단어 ${selectedIds.size}개를 삭제할까요?`);
    if (!confirmed) return;

    setIsDeleting(true);
    const result = await unsaveWords([...selectedIds]);
    setIsDeleting(false);

    if (result.status !== 'removed') {
      showToast('삭제하지 못했어요. 다시 시도해 주세요.', 'error');
      return;
    }

    showToast('선택한 단어를 삭제했어요.', 'info');
    setSelectedIds(new Set());
    setDeleteMode(false);
  };

  // 인증 상태 확인 중
  if (isAuthLoading) {
    return (
      <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
        <AuthTopNav />
        <LoadingState />
        <BottomNavigation activeItem="saved" />
      </div>
    );
  }

  // 비로그인 상태
  if (!isLoggedIn) {
    return (
      <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
        <AuthTopNav />
        <EmptyState
          icon="📚"
          title="로그인하면 단어를 저장할 수 있어요"
          description="Google 계정으로 로그인하면 저장한 단어를 다시 복습하고 다른 기기에서도 이어서 학습할 수 있어요."
          actionLabel="운세 보러 가기"
          actionHref="/"
        />
        <BottomNavigation activeItem="saved" />
      </div>
    );
  }

  // 저장 단어 조회 중
  if (!isLoaded) {
    return (
      <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
        <AuthTopNav />
        <LoadingState />
        <BottomNavigation activeItem="saved" />
      </div>
    );
  }

  // 조회 실패
  if (loadError) {
    return (
      <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
        <AuthTopNav />
        <ErrorState
          title="저장한 단어를 불러오지 못했어요"
          description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
          onRetry={refresh}
        />
        <BottomNavigation activeItem="saved" />
      </div>
    );
  }

  // 저장 단어 없음
  if (savedWords.length === 0) {
    return (
      <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
        <AuthTopNav />
        <div className="px-[var(--page-padding-x)] pt-6">
          <h1 className="text-h1 text-[var(--text-primary)]">
            저장된 단어{' '}
            <span className="text-[var(--text-brand)]">0개</span>
          </h1>
        </div>
        <EmptyState
          icon="✨"
          title="아직 저장한 단어가 없어요"
          description="운세를 읽다가 모르는 단어를 저장해 보세요!"
          actionLabel="오늘의 운세 보기"
          actionHref="/"
        />
        <BottomNavigation activeItem="saved" />
      </div>
    );
  }

  const deleteButtonLabel = !deleteMode
    ? '단어 삭제하기'
    : selectedIds.size > 0
      ? `${selectedIds.size}개 삭제하기`
      : '삭제하기';

  return (
    <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
      <AuthTopNav />

      {/* 헤더 */}
      <div className="flex items-start justify-between px-[var(--page-padding-x)] pt-6">
        <h1 className="text-h1 text-[var(--text-primary)]">
          저장된 단어{' '}
          <span className="text-[var(--text-brand)]">{savedWords.length}개</span>
        </h1>

        <div className="flex flex-col items-end gap-1">
          {deleteMode && (
            <button
              type="button"
              onClick={cancelDeleteMode}
              className="text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1"
            >
              취소
            </button>
          )}
          <Button
            hierarchy="primary"
            size="small"
            disabled={deleteMode && selectedIds.size === 0}
            onClick={deleteMode ? handleDeleteRequest : enterDeleteMode}
          >
            {deleteButtonLabel}
          </Button>
        </div>
      </div>

      {/* 저장 단어 카드 목록 */}
      <div className="space-y-4 px-[var(--page-padding-x)] py-6">
        {savedWords.map((item) => {
          if (deleteMode) {
            return (
              <VocabCard
                key={item.id}
                mode="select"
                selected={selectedIds.has(item.id)}
                word={item.vocabulary.surfaceForm}
                reading={item.vocabulary.reading}
                meaning={item.vocabulary.meaning}
                onSelect={() => toggleSelect(item.id)}
                onPlayAudio={() => handlePlayAudio(item)}
              />
            );
          }

          return (
            <VocabCard
              key={item.id}
              mode="flip"
              revealed={revealedIds.has(item.id)}
              word={item.vocabulary.surfaceForm}
              reading={item.vocabulary.reading}
              meaning={item.vocabulary.meaning}
              onFlip={() => toggleReveal(item.id, item.vocabularyId)}
              onPlayAudio={() => handlePlayAudio(item)}
            />
          );
        })}
      </div>

      <BottomNavigation activeItem="saved" />
    </div>
  );
}
