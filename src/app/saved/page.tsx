'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import AuthTopNav from '@/components/common/AuthTopNav';
import VocabCard, { PART_OF_SPEECH_LABELS } from '@/components/ui/VocabCard';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import { useToast } from '@/components/ui/Toast';
import BottomNavigation from '@/components/ui/BottomNavigation';
import ScrollToTopButton from '@/components/ui/ScrollToTopButton';
import { speak } from '@/lib/speak';
import { trackSavedTabViewed, trackSavedVocabFlipped } from '@/lib/analytics/events';
import type { SavedWord } from '@/types/vocabulary';
import type { PartOfSpeech } from '@/types/fortune';

type PartOfSpeechFilter = 'all' | PartOfSpeech;

const FILTER_OPTIONS: { value: PartOfSpeechFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...(Object.entries(PART_OF_SPEECH_LABELS) as [PartOfSpeech, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

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
  // 품사 필터. 목록 표시(뒤집기 모드)와 삭제 모드 모두에 동일하게 적용된다.
  const [partOfSpeechFilter, setPartOfSpeechFilter] = useState<PartOfSpeechFilter>('all');

  const filteredWords = useMemo(
    () =>
      partOfSpeechFilter === 'all'
        ? savedWords
        : savedWords.filter((w) => w.vocabulary.partOfSpeech === partOfSpeechFilter),
    [savedWords, partOfSpeechFilter]
  );

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
      <div className="page-content-with-bottom-nav min-h-dvh bg-[var(--surface-brand)]">
        <AuthTopNav />
        <LoadingState />
        <BottomNavigation activeItem="saved" />
      </div>
    );
  }

  // 비로그인 상태
  if (!isLoggedIn) {
    return (
      <div className="page-content-with-bottom-nav min-h-dvh bg-[var(--surface-brand)]">
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
      <div className="page-content-with-bottom-nav min-h-dvh bg-[var(--surface-brand)]">
        <AuthTopNav />
        <LoadingState />
        <BottomNavigation activeItem="saved" />
      </div>
    );
  }

  // 조회 실패
  if (loadError) {
    return (
      <div className="page-content-with-bottom-nav min-h-dvh bg-[var(--surface-brand)]">
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
      <div className="page-content-with-bottom-nav min-h-dvh bg-[var(--surface-brand)]">
        <AuthTopNav />
        <div className="px-[var(--page-padding-x)] pt-6">
          <h1 className="text-h1 text-[var(--text-primary)]">
            저장된 단어{' '}
            <span className="text-[var(--text-brand)]">0</span>
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

  // 삭제 모드가 활성화된 뒤("N개 삭제하기"/"삭제하기")의 라벨. 진입 전 상태("단어
  // 삭제")는 별도의 텍스트 버튼으로 분리 렌더링하므로 이 라벨에는 포함하지 않는다.
  const activeDeleteLabel = selectedIds.size > 0 ? `${selectedIds.size}개 삭제하기` : '삭제하기';

  return (
    <div className="page-content-with-bottom-nav min-h-dvh bg-[var(--surface-brand)]">
      <AuthTopNav />

      {/* 헤더. Figma(Saved Words 45:655 → Frame 45:668)가 제목과 액션을 items-center로
          맞추고 있어 기존 items-start에서 변경했다. */}
      <div className="flex items-center justify-between px-[var(--page-padding-x)] pt-6">
        <h1 className="min-w-0 text-h1 text-[var(--text-primary)]">
          저장된 단어{' '}
          <span className="text-[var(--text-brand)]">{savedWords.length}</span>
        </h1>

        {/* 삭제 모드일 때 "취소"를 "N개 삭제하기"와 같은 행에, 왼쪽에 나란히 배치한다
            (기존에는 위아래로 쌓여 있어 "삭제 버튼 옆" 배치 요구와 어긋났다). 텍스트
            버튼 스타일·토큰은 기존 그대로 재사용, 새 색상 없음. gap을 좁혀(3→2) 두
            버튼이 한 묶음처럼 보이도록 하고, shrink-0으로 제목이 길어져도(예: 두 자리
            수 저장 개수) 이 액션 영역과 삭제 버튼 문구가 절대 압축·줄바꿈되지 않도록
            보장한다(whitespace-nowrap도 방어적으로 추가). */}
        <div className="flex shrink-0 items-center gap-2">
          {deleteMode && (
            <button
              type="button"
              onClick={cancelDeleteMode}
              className="whitespace-nowrap text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1"
            >
              취소
            </button>
          )}
          {deleteMode ? (
            // 삭제 확정 상태("N개 삭제하기"/"삭제하기")는 스타일 변경 대상이 아니므로
            // 기존 Button(primary/small)을 그대로 유지한다.
            <Button
              hierarchy="primary"
              size="small"
              disabled={selectedIds.size === 0}
              onClick={handleDeleteRequest}
              className="whitespace-nowrap"
            >
              {activeDeleteLabel}
            </Button>
          ) : (
            // 진입 상태("단어 삭제")는 배경/border/shadow 없이 브랜드 보라색 텍스트만
            // 보이는 페이지 내부 텍스트 버튼. "취소" 버튼과 같은 방식(순수 <button> +
            // 기존 색상/타이포 토큰 재사용)으로 처리하고, 시각적으로 텍스트만 보여도
            // padding으로 클릭 영역과 포커스 링을 충분히 확보한다.
            <button
              type="button"
              onClick={enterDeleteMode}
              className="whitespace-nowrap rounded px-2 py-2 text-b2-medium text-[var(--text-brand)] transition-colors hover:text-[var(--brand-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
            >
              단어 삭제
            </button>
          )}
        </div>
      </div>

      {/* 저장 단어 카드 목록. 하단 padding은 ScrollToTopButton(40px 버튼 + 위아래 여백)이
          맨 아래까지 스크롤했을 때도 마지막 카드와 겹치지 않도록 기본 py-6보다 더 확보한다. */}
      <div className="space-y-4 px-[var(--page-padding-x)] pt-6 pb-[calc(var(--space-6)+var(--space-4)+40px+var(--space-4))]">
        {/* 품사 필터 */}
        <div role="group" aria-label="품사 필터" className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const active = partOfSpeechFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setPartOfSpeechFilter(option.value)}
                className={[
                  'h-[50px] rounded-[var(--radius-md)] border-[1.5px] px-4 py-3 text-b2-medium whitespace-nowrap',
                  active
                    ? 'border-[var(--border-brand)] bg-[var(--color-white)] text-[var(--text-brand)]'
                    : 'border-[var(--border-default)] bg-[var(--color-white)] text-[var(--text-secondary)]',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {filteredWords.map((item) => {
          if (deleteMode) {
            return (
              <VocabCard
                key={item.id}
                mode="select"
                selected={selectedIds.has(item.id)}
                word={item.vocabulary.surfaceForm}
                reading={item.vocabulary.reading}
                meaning={item.vocabulary.meaning}
                partOfSpeech={item.vocabulary.partOfSpeech}
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
              partOfSpeech={item.vocabulary.partOfSpeech}
              sourceSentence={item.vocabulary.sourceSentence}
              sourceSentenceReading={item.vocabulary.sourceSentenceReading}
              sourceSentenceTranslation={item.vocabulary.sourceSentenceTranslation}
              onFlip={() => toggleReveal(item.id, item.vocabularyId)}
              onPlayAudio={() => handlePlayAudio(item)}
            />
          );
        })}
      </div>

      <ScrollToTopButton />
      <BottomNavigation activeItem="saved" />
    </div>
  );
}
