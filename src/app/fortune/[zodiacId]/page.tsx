'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getFortuneByZodiac, getLatestReadyDate } from '@/lib/fortune/queries';
import { getZodiac } from '@/lib/zodiac';
import { buildLuckyItemSegments } from '@/lib/luckyItemSegments';
import { speak } from '@/lib/speak';
import SegmentedText from '@/components/fortune/SegmentedText';
import VocabCardOverlay from '@/components/fortune/VocabCardOverlay';
import SourceNotice from '@/components/fortune/SourceNotice';
import LoginPromptSheet from '@/components/auth/LoginPromptSheet';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import TopNavigation from '@/components/ui/TopNavigation';
import VocabCard from '@/components/ui/VocabCard';
import Button from '@/components/ui/Button';
import Tooltip from '@/components/ui/Tooltip';
import Icon from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import { useToast } from '@/components/ui/Toast';
import type { Fortune, ZodiacId } from '@/types/fortune';

const PENDING_REVIEW_SAVE_KEY = 'ohayo_pending_review_save';

interface PendingReviewSave {
  zodiacId: string;
  selectedWordIds: string[];
  returnStep: 'review';
}

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
type LearningStep = 'study' | 'review' | 'complete';

export default function FortuneDetailPage() {
  const params = useParams();
  const zodiacId = params.zodiacId as ZodiacId;
  const router = useRouter();

  const zodiac = getZodiac(zodiacId);

  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const [step, setStep] = useState<LearningStep>('study');
  const [checkedWordIds, setCheckedWordIds] = useState<Set<string>>(new Set());
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [overlayRevealed, setOverlayRevealed] = useState(false);
  const [translationVisible, setTranslationVisible] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const { user, isLoggedIn, signInWithGoogle } = useAuth();
  const { isSaved, saveWords } = useSavedVocabulary(user?.id ?? null);
  const { showToast } = useToast();

  // Supabase에서 실제 운세 데이터를 조회한다(공개 RLS, 브라우저 클라이언트로 충분).
  // zodiacId 자체가 잘못된 경우는 이 effect보다 먼저(렌더 시점에) notFound()로 처리되므로
  // 여기서는 항상 zodiac이 유효하다고 가정한다.
  useEffect(() => {
    if (!zodiac) return;

    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const date = await getLatestReadyDate(supabase);
      if (cancelled) return;

      if (!date) {
        setStatus('not-found');
        return;
      }

      const result = await getFortuneByZodiac(supabase, date, zodiacId);
      if (cancelled) return;

      if (!result) {
        setStatus('not-found');
        return;
      }

      setFortune(result);
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, [zodiacId, zodiac, reloadKey]);

  // luckyItem에는 originalText 같은 사전 계산 segments가 없어(DB/AI 파이프라인 미변경),
  // vocabulary.surfaceForm과 정확히 일치하는 부분만 런타임에 하이라이트로 변환한다.
  const luckyItemSegments = useMemo(
    () => (fortune ? buildLuckyItemSegments(fortune.luckyItem, fortune.vocabulary) : []),
    [fortune]
  );

  const requiredWordIds = useMemo(
    () => new Set((fortune?.vocabulary ?? []).map((word) => word.id)),
    [fortune]
  );
  const checkedCount = [...checkedWordIds].filter((id) => requiredWordIds.has(id)).length;
  const isAllChecked = requiredWordIds.size === 3 && checkedCount === requiredWordIds.size;

  const activeWord = fortune?.vocabulary.find((v) => v.id === activeWordId) ?? null;

  // 로그인 완료 후, 저장하려고 선택했던 단어 목록을 복원한다(자동 저장하지 않음 —
  // 사용자가 review 화면에서 저장하기를 다시 눌러야 실제 저장이 진행된다).
  useEffect(() => {
    if (!isLoggedIn) return;

    queueMicrotask(() => {
      const raw = sessionStorage.getItem(PENDING_REVIEW_SAVE_KEY);
      if (!raw) return;

      let pending: PendingReviewSave;
      try {
        pending = JSON.parse(raw) as PendingReviewSave;
      } catch {
        sessionStorage.removeItem(PENDING_REVIEW_SAVE_KEY);
        return;
      }

      if (pending.zodiacId !== zodiacId) return;

      setStep(pending.returnStep);
      setSelectedWordIds(new Set(pending.selectedWordIds));
      sessionStorage.removeItem(PENDING_REVIEW_SAVE_KEY);
    });
  }, [isLoggedIn, zodiacId]);

  const openWordOverlay = (vocabularyId: string) => {
    setActiveWordId(vocabularyId);
    setOverlayRevealed(false);
    // Set이라 이미 들어있는 id를 다시 추가해도 크기가 늘지 않는다 —
    // 같은 단어를 여러 위치에서 눌러도 확인 개수가 한 번만 증가하는 이유.
    setCheckedWordIds((prev) => {
      if (prev.has(vocabularyId)) return prev;
      const next = new Set(prev);
      next.add(vocabularyId);
      return next;
    });
  };

  const closeWordOverlay = () => setActiveWordId(null);

  const goToReview = () => {
    // 매번 새 복습 세션으로 취급한다 — study로 돌아갔다가 다시 들어와도
    // 이전 선택을 이어받지 않고 항상 미선택 상태로 시작한다.
    setSelectedWordIds(new Set());
    setStep('review');
  };

  const toggleSelectWord = (vocabularyId: string) => {
    setSelectedWordIds((prev) => {
      const next = new Set(prev);
      if (next.has(vocabularyId)) next.delete(vocabularyId);
      else next.add(vocabularyId);
      return next;
    });
  };

  const handleLoginStart = () => {
    signInWithGoogle(window.location.pathname);
  };

  const handleLoginSheetClose = () => {
    sessionStorage.removeItem(PENDING_REVIEW_SAVE_KEY);
    setShowLoginSheet(false);
  };

  const handleSaveSelected = async () => {
    if (selectedWordIds.size === 0 || isSaving) return;

    if (!isLoggedIn) {
      const pending: PendingReviewSave = {
        zodiacId,
        selectedWordIds: [...selectedWordIds],
        returnStep: 'review',
      };
      sessionStorage.setItem(PENDING_REVIEW_SAVE_KEY, JSON.stringify(pending));
      setShowLoginSheet(true);
      return;
    }

    setIsSaving(true);
    const result = await saveWords([...selectedWordIds]);
    setIsSaving(false);

    if (result.status === 'saved') {
      setStep('complete');
      return;
    }

    if (result.status === 'duplicate') {
      // 선택 시점에는 저장되지 않은 단어였지만, 저장 요청 사이에 다른 곳에서
      // 이미 저장된 경우(레이스 컨디션)에만 도달한다. 새로 저장된 것이 없으므로
      // complete로 넘어가지 않고 review에 머무른다.
      showToast('이미 저장된 단어예요', 'info');
      return;
    }

    showToast('단어를 저장하지 못했어요. 다시 시도해 주세요.', 'error');
  };

  if (!zodiac) {
    notFound();
  }

  if (status === 'loading') {
    return (
      <div>
        <LoadingState message="운세를 불러오는 중이에요..." />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="px-[var(--page-padding-x)]">
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  if (status === 'not-found' || !fortune) {
    notFound();
  }

  // ─── complete 단계: 헤더 없이 완료 안내만 표시 ───
  if (step === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-[var(--page-padding-x)] py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)]">
          <Icon name="check" size={32} className="text-[var(--text-inverse)]" />
        </div>
        <p className="text-h2 text-[var(--text-primary)]">단어 저장이 완료됐어요!</p>
        <div className="mt-4 flex w-full gap-3">
          <Button hierarchy="secondary" size="medium" fullWidth onClick={() => setStep('study')}>
            운세로 돌아가기
          </Button>
          <Button hierarchy="primary" size="medium" fullWidth onClick={() => router.push('/saved')}>
            저장된 단어 보기
          </Button>
        </div>
      </div>
    );
  }

  // ─── review 단계: 방금 확인한 핵심 단어 3개를 복습하고 저장할 단어를 고른다 ───
  if (step === 'review') {
    const saveLabel = selectedWordIds.size > 0 ? `${selectedWordIds.size}개 저장하기` : '저장하기';

    return (
      <div>
        <TopNavigation variant="detail" title="단어 복습하기" onBack={() => setStep('study')} />

        <div className="px-[var(--page-padding-x)] py-6">
          <p className="text-b1-semibold text-[var(--text-brand)]">오늘의 단어 학습 완료!</p>
          <p className="text-b2-regular text-[var(--text-secondary)] mt-1 mb-6">
            방금 공부한 단어들을 단어장에 저장할까요?
          </p>

          <div className="space-y-4">
            {fortune.vocabulary.map((vocab) => {
              const alreadySaved = isSaved(vocab.id);
              return (
                <div key={vocab.id}>
                  <VocabCard
                    mode="select"
                    selected={alreadySaved || selectedWordIds.has(vocab.id)}
                    word={vocab.surfaceForm}
                    meaning={vocab.meaning}
                    onSelect={alreadySaved ? () => {} : () => toggleSelectWord(vocab.id)}
                    onPlayAudio={() => speak(vocab.reading || vocab.surfaceForm)}
                  />
                  {alreadySaved && (
                    <p className="mt-1 text-caption text-[var(--text-tertiary)]">이미 저장된 단어예요</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 px-[var(--page-padding-x)] pb-8">
          <Button hierarchy="secondary" size="medium" className="shrink-0" onClick={() => setStep('study')}>
            종료하기
          </Button>
          <Button
            hierarchy="primary"
            size="medium"
            fullWidth
            disabled={selectedWordIds.size === 0 || isSaving}
            onClick={handleSaveSelected}
          >
            {saveLabel}
          </Button>
        </div>

        <LoginPromptSheet
          isOpen={showLoginSheet}
          onClose={handleLoginSheetClose}
          onLogin={handleLoginStart}
        />
      </div>
    );
  }

  // ─── study 단계 ───
  const translationButtonLabel = isAllChecked ? '한국어 해석 보기' : `한국어 해석 보기 ${checkedCount}/3`;

  return (
    <div>
      <TopNavigation
        variant="detail"
        title={`${fortune.rank}위 ${fortune.zodiacKorean}`}
        onBack={() => router.push('/')}
      />

      <div className="px-[var(--page-padding-x)] py-6">
        {/* 일본어 운세 원문 섹션 */}
        <section aria-label="오늘의 운세" className="mb-6">
          <h2 className="text-caption text-[var(--text-tertiary)] font-semibold mb-3 tracking-wide">
            1. 오늘의 운세
          </h2>
          <SegmentedText
            segments={fortune.segments}
            checkedWordIds={checkedWordIds}
            onWordClick={openWordOverlay}
          />
          {translationVisible && (
            <div className="mt-3 p-4 rounded-[var(--radius-lg)] bg-[var(--surface-subtle)]">
              <p className="text-b2-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                {fortune.koreanTranslation}
              </p>
            </div>
          )}
        </section>

        {/* 행운의 장소와 아이템 섹션 (런타임 문자열 매칭으로 하이라이트) */}
        <section aria-label="행운의 장소와 아이템" className="mb-6">
          <h2 className="text-caption text-[var(--text-tertiary)] font-semibold mb-3 tracking-wide">
            2. 행운의 장소와 아이템
          </h2>
          <SegmentedText
            segments={luckyItemSegments}
            checkedWordIds={checkedWordIds}
            onWordClick={openWordOverlay}
          />
          {/* 행운의 장소·아이템에 대응하는 실제 한국어 해석 필드가 아직 없어(originalText의
              koreanTranslation 재사용 금지), 이 섹션에는 해석 박스를 표시하지 않는다. */}
        </section>

        {/* 한국어 해석 보기 / 다음 단계 진입 */}
        {!translationVisible ? (
          <div className="flex flex-col items-center gap-2">
            {!isAllChecked && (
              <Tooltip>일본어 단어 3개를 확인하면 한국어 해석이 열려요</Tooltip>
            )}
            <Button
              hierarchy="primary"
              size="large"
              fullWidth
              disabled={!isAllChecked}
              onClick={() => setTranslationVisible(true)}
            >
              {translationButtonLabel}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setTranslationVisible(false)}
              className="text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1"
            >
              한국어 해석 가리기
            </button>
            <Button hierarchy="primary" size="large" fullWidth onClick={goToReview}>
              다음
            </Button>
          </div>
        )}

        {/* 출처 및 비공식 서비스 안내 */}
        <SourceNotice sourceDate={fortune.sourceDate} sourceUrl={fortune.sourceUrl} />
      </div>

      {/* 단어 카드 오버레이 */}
      <VocabCardOverlay isOpen={activeWordId !== null} onClose={closeWordOverlay}>
        {activeWord && !overlayRevealed && (
          <VocabCard
            mode="flip"
            revealed={false}
            word={activeWord.surfaceForm}
            onFlip={() => setOverlayRevealed(true)}
          />
        )}
        {activeWord && overlayRevealed && (
          <VocabCard
            mode="flip"
            revealed
            word={activeWord.surfaceForm}
            meaning={activeWord.meaning}
            onFlip={() => setOverlayRevealed(false)}
            onPlayAudio={() => speak(activeWord.reading || activeWord.surfaceForm)}
          />
        )}
      </VocabCardOverlay>
    </div>
  );
}
