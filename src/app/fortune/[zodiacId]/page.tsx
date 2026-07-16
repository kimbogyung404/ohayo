'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getFortuneByZodiac, getLatestReadyDate } from '@/lib/fortune/queries';
import { getZodiac } from '@/lib/zodiac';
import { speak } from '@/lib/speak';
import KoreanSegmentedText from '@/components/fortune/KoreanSegmentedText';
import VocabCardOverlay from '@/components/fortune/VocabCardOverlay';
import LoginPromptSheet from '@/components/auth/LoginPromptSheet';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import TopNavigation from '@/components/ui/TopNavigation';
import VocabCard from '@/components/ui/VocabCard';
import Button from '@/components/ui/Button';
import Tooltip from '@/components/ui/Tooltip';
import StickyActionBar from '@/components/ui/StickyActionBar';
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
  // 같은 단어를 다시 눌러도 3초 자동 종료 타이머가 재시작되도록 하는 카운터.
  // activeWordId만으로는 같은 값으로 다시 set할 때 React가 재렌더를 스킵해
  // 아래 useEffect가 재실행되지 않는다.
  const [openToken, setOpenToken] = useState(0);
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

  // 단어 카드 오버레이 3초 자동 종료. activeWordId(와 openToken) 변경마다 새로
  // 실행되며, cleanup이 이전 타이머를 정리한다 — 그래서 새 단어를 열거나, 같은
  // 단어를 다시 열거나, 수동으로 닫거나, 언마운트될 때 모두 정확히 하나의
  // 타이머만 살아있다. Strict Mode의 mount→cleanup→mount 이중 실행도 동일한
  // 이유로 안전하다(첫 번째 타이머가 cleanup에서 즉시 정리된다).
  useEffect(() => {
    if (activeWordId === null) return;
    const timer = setTimeout(() => {
      setActiveWordId(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [activeWordId, openToken]);

  const openWordOverlay = (vocabularyId: string) => {
    setActiveWordId(vocabularyId);
    setOpenToken((t) => t + 1);
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

  // ─── complete 단계: 헤더 없이 완료 안내만 표시. 버튼은 StickyActionBar로 하단 고정 ───
  if (step === 'complete') {
    return (
      <div>
        <div className="page-content-with-sticky-cta flex flex-col items-center justify-center gap-4 px-[var(--page-padding-x)] py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)]">
            <Icon name="check" size={32} className="text-[var(--text-inverse)]" />
          </div>
          <p className="text-h2 text-[var(--text-primary)]">단어 저장이 완료됐어요!</p>
        </div>

        <StickyActionBar>
          <div className="flex w-full gap-3">
            <Button hierarchy="secondary" size="medium" fullWidth onClick={() => setStep('study')}>
              운세로 돌아가기
            </Button>
            <Button hierarchy="primary" size="medium" fullWidth onClick={() => router.push('/saved')}>
              저장된 단어 보기
            </Button>
          </div>
        </StickyActionBar>
      </div>
    );
  }

  // ─── review 단계: 방금 확인한 핵심 단어 3개를 복습하고 저장할 단어를 고른다 ───
  if (step === 'review') {
    const saveLabel = selectedWordIds.size > 0 ? `${selectedWordIds.size}개 저장하기` : '저장하기';

    return (
      <div>
        <TopNavigation variant="detail" title="단어 복습하기" onBack={() => setStep('study')} />

        <div className="page-content-with-sticky-cta px-[var(--page-padding-x)] py-6">
          <p className="text-b1-semibold text-[var(--text-brand)]">오늘의 단어를 복습해보세요</p>
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
                    reading={vocab.reading}
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

        <StickyActionBar>
          <div className="flex w-full gap-3">
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
        </StickyActionBar>

        <LoginPromptSheet
          isOpen={showLoginSheet}
          onClose={handleLoginSheetClose}
          onLogin={handleLoginStart}
        />
      </div>
    );
  }

  // ─── study 단계: 한국어 세그먼트 데이터가 아직 없는(백필/생성 실패) 운세는
  // 상호작용 없는 준비 중 안내만 보여준다. 프론트에서 임의로 일본어 원문
  // 런타임 매칭으로 대체하지 않는다 — koreanSegments/luckyItemKoSegments는
  // 전부 M5가 DB에 저장해 둔 값이어야 한다. ───
  const { koreanSegments, luckyItemKoSegments, luckyItemKo } = fortune;

  if (koreanSegments === null || luckyItemKoSegments === null || luckyItemKo === null) {
    return (
      <div>
        <TopNavigation
          variant="detail"
          title={`${fortune.rank}위 ${fortune.zodiacKorean}`}
          onBack={() => router.push('/')}
        />
        <div className="flex flex-col items-center justify-center gap-3 px-[var(--page-padding-x)] py-24 text-center">
          <p className="text-b1-medium text-[var(--text-primary)]">한국어 학습 데이터를 준비하고 있어요.</p>
          <p className="text-b2-regular text-[var(--text-tertiary)]">잠시 후 다시 확인해 주세요.</p>
          <Button hierarchy="secondary" size="medium" onClick={() => router.push('/')} className="mt-2">
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const ctaLabel = isAllChecked ? '확인한 단어 복습하기' : `단어 확인하기 ${checkedCount}/3`;

  return (
    <div>
      <TopNavigation
        variant="detail"
        title={`${fortune.rank}위 ${fortune.zodiacKorean}`}
        onBack={() => router.push('/')}
      />

      <div className="page-content-with-sticky-cta px-[var(--page-padding-x)] py-6">
        {/* 오늘의 운세 — 한국어 본문, 핵심 단어 3개만 확인 전 일본어 */}
        <section aria-label="오늘의 운세" className="mb-6">
          <h2 className="text-caption text-[var(--text-tertiary)] font-semibold mb-3 tracking-wide">
            1. 오늘의 운세
          </h2>
          <KoreanSegmentedText
            segments={koreanSegments}
            vocabulary={fortune.vocabulary}
            checkedWordIds={checkedWordIds}
            onWordClick={openWordOverlay}
          />
        </section>

        {/* 행운의 장소와 아이템 — 동일한 방식(DB에 저장된 한국어 세그먼트) */}
        <section aria-label="행운의 장소와 아이템" className="mb-6">
          <h2 className="text-caption text-[var(--text-tertiary)] font-semibold mb-3 tracking-wide">
            2. 행운의 장소와 아이템
          </h2>
          <KoreanSegmentedText
            segments={luckyItemKoSegments}
            vocabulary={fortune.vocabulary}
            checkedWordIds={checkedWordIds}
            onWordClick={openWordOverlay}
          />
        </section>
      </div>

      {/* 단어 확인 진행 / 복습 진입 — 화면 최하단 고정. 3/3이어도 자동 이동하지 않고
          사용자가 버튼을 눌러야 review로 넘어간다. */}
      <StickyActionBar>
        {!isAllChecked && <Tooltip>강조된 일본어 단어 3개를 눌러 뜻을 확인해보세요</Tooltip>}
        <Button hierarchy="primary" size="large" fullWidth disabled={!isAllChecked} onClick={goToReview}>
          {ctaLabel}
        </Button>
      </StickyActionBar>

      {/* 단어 카드 오버레이 — 항상 앞면(단어+읽는 법+발음 듣기)만 표시, 뒤집기 없음, 3초 뒤 자동 종료 */}
      <VocabCardOverlay isOpen={activeWordId !== null} onClose={closeWordOverlay}>
        {activeWord && (
          <VocabCard
            mode="front"
            word={activeWord.surfaceForm}
            reading={activeWord.reading}
            onPlayAudio={() => speak(activeWord.reading || activeWord.surfaceForm)}
          />
        )}
      </VocabCardOverlay>
    </div>
  );
}
