'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import StickyActionBar from '@/components/ui/StickyActionBar';
import Icon from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import { useToast } from '@/components/ui/Toast';
import {
  savePendingVocabSave,
  readPendingVocabSave,
  markPendingVocabSaveProcessing,
  revertPendingVocabSaveToPending,
  clearPendingVocabSave,
} from '@/lib/pendingVocabSave';
import {
  trackLearningStarted,
  trackVocabOpened,
  trackAllVocabViewed,
  trackReviewStarted,
  trackSaveButtonClicked,
  trackVocabSaved,
  trackLearningFeedbackSelected,
  trackLearningFeedbackReasonToggled,
  trackCompletionActionClicked,
  trackFortuneDetailExited,
} from '@/lib/analytics/events';
import type { Fortune, ZodiacId } from '@/types/fortune';

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
type LearningStep = 'study' | 'review' | 'complete';

// complete 단계의 "오늘의 학습 피드백" — UI/로컬 state만 구현한다(저장/전송 없음).
type LearningFeedback = 'helpful' | 'neutral' | 'unhelpful';

const FEEDBACK_OPTIONS: { value: LearningFeedback; label: string; icon: 'smile' | 'meh' | 'frown' }[] = [
  { value: 'helpful', label: '도움이 됐어요', icon: 'smile' },
  { value: 'neutral', label: '보통이에요', icon: 'meh' },
  { value: 'unhelpful', label: '아쉬웠어요', icon: 'frown' },
];

const UNHELPFUL_REASONS = [
  { id: 'too-hard', label: '단어가 너무 어려웠어요' },
  { id: 'reading-unclear', label: '읽는 법이 이해되지 않았어요' },
  { id: 'meaning-insufficient', label: '뜻이나 설명이 부족했어요' },
  { id: 'not-useful', label: '단어가 유용하지 않았어요' },
  { id: 'review-tedious', label: '복습 과정이 번거로웠어요' },
];

export default function FortuneDetailPage() {
  const params = useParams();
  const zodiacId = params.zodiacId as ZodiacId;
  const router = useRouter();

  const zodiac = getZodiac(zodiacId);

  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const [step, setStep] = useState<LearningStep>('study');
  // 단어별 확인 응답("잘 알아요"/"몰라요"). 이 값이 있는 단어만 "확인 완료"로 친다 —
  // 카드를 열기만 하고 dim을 눌러 닫으면 응답이 기록되지 않아 재열람 시 다시 물어본다.
  const [wordKnowledgeById, setWordKnowledgeById] = useState<Record<string, 'known' | 'unknown'>>({});
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [learningFeedback, setLearningFeedback] = useState<LearningFeedback | null>(null);
  const [unhelpfulReasonIds, setUnhelpfulReasonIds] = useState<Set<string>>(new Set());

  const { user, isLoggedIn, signInWithGoogle } = useAuth();
  const { isSaved, saveWords } = useSavedVocabulary(user?.id ?? null);
  const { showToast } = useToast();

  // OAuth 왕복 후 pending 저장을 "이 마운트에서 정확히 한 번만" 복원/재개하기 위한 가드.
  // Strict Mode의 mount→cleanup→mount 이중 실행에도 같은 컴포넌트 인스턴스라 ref가
  // 유지되므로 안전하다(useSavedVocabulary의 isMountedRef와 동일한 이유).
  const restoredPendingRef = useRef(false);
  const resumeSaveAttemptedRef = useRef(false);
  // 분석 이벤트 중복 전송 방지용 가드(각 이벤트를 이 마운트에서 최초 1회만 보낸다).
  const learningStartedTrackedRef = useRef(false);
  const allVocabViewedTrackedRef = useRef(false);
  // review_started/save_button_clicked의 timeSpentMs 계산 기준 시각(ms epoch).
  // learning_started/review_started가 실제로 전송된 시점에 각각 기록한다.
  const learningStartedAtRef = useRef<number | null>(null);
  const reviewStartedAtRef = useRef<number | null>(null);
  // fortune_detail_exited 전송 시점의 checkedCount 스냅샷용. cleanup 클로저는 effect가
  // 마운트된 시점의 값을 그대로 참조하므로, 렌더마다 최신값을 여기로 동기화해 둔다.
  const checkedCountRef = useRef(0);
  // 언마운트 여부 판정을 한 틱 미루기 위한 타이머(아래 fortune_detail_exited effect 참고).
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // "확인 완료"는 응답(잘 알아요/몰라요)이 기록된 단어만 센다 — 카드를 열어보기만 한
  // 것은 확인으로 치지 않는다.
  const checkedWordIds = useMemo(() => new Set(Object.keys(wordKnowledgeById)), [wordKnowledgeById]);
  const checkedCount = [...checkedWordIds].filter((id) => requiredWordIds.has(id)).length;
  const isAllChecked = requiredWordIds.size === 3 && checkedCount === requiredWordIds.size;

  const activeWord = fortune?.vocabulary.find((v) => v.id === activeWordId) ?? null;

  // learning_started — 운세/단어 데이터가 준비되어 학습을 시작할 수 있게 된 시점에
  // 이 마운트당 정확히 한 번만 보낸다.
  useEffect(() => {
    if (status !== 'ready') return;
    if (learningStartedTrackedRef.current) return;
    learningStartedTrackedRef.current = true;
    learningStartedAtRef.current = Date.now();
    trackLearningStarted({ zodiacId });
  }, [status, zodiacId]);

  // all_vocab_viewed — 일본어 단어 3개를 모두 확인한 순간 한 번만 보낸다.
  useEffect(() => {
    if (!isAllChecked) return;
    if (allVocabViewedTrackedRef.current) return;
    allVocabViewedTrackedRef.current = true;
    trackAllVocabViewed({ zodiacId });
  }, [isAllChecked, zodiacId]);

  // checkedCountRef 동기화 — cleanup 클로저가 항상 최신 checkedCount를 읽을 수 있도록
  // 렌더 중이 아니라 effect 안에서 갱신한다.
  useEffect(() => {
    checkedCountRef.current = checkedCount;
  }, [checkedCount]);

  // fortune_detail_exited — learning_started는 발생했지만 review_started 없이 이 화면을
  // 벗어나는 경우에만 보낸다(beforeunload는 신뢰도가 낮아 쓰지 않는다). cleanup에서
  // 바로 보내지 않고 한 틱(setTimeout 0) 미룬 뒤, 같은 틱 안에서 effect가 다시 실행되면
  // 취소한다 — React Strict Mode의 개발 전용 mount→cleanup→mount 이중 호출을 실제
  // 이탈로 오인해 오탐하지 않기 위함이다.
  useEffect(() => {
    if (exitTimeoutRef.current !== null) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    return () => {
      exitTimeoutRef.current = setTimeout(() => {
        exitTimeoutRef.current = null;
        if (learningStartedAtRef.current === null) return;
        if (reviewStartedAtRef.current !== null) return;
        trackFortuneDetailExited({
          zodiacId,
          checkedCount: checkedCountRef.current,
          timeSpentMs: Date.now() - learningStartedAtRef.current,
        });
      }, 0);
    };
  }, [zodiacId]);

  // review 화면 상태(step/selectedWordIds) 복원 — 로그인 여부와 무관하게, 이 zodiac에
  // 대한 pending 저장 의도가 남아있으면 항상 복원한다. OAuth를 취소하거나 실패해서
  // 로그인하지 못한 채 이 화면으로 돌아오더라도, 사용자가 골랐던 단어를 다시 고를
  // 필요가 없게 하기 위함이다(§6 로그인 취소·실패 처리).
  useEffect(() => {
    if (restoredPendingRef.current) return;

    const pending = readPendingVocabSave(zodiacId);
    if (!pending) return;

    restoredPendingRef.current = true;
    const raf = requestAnimationFrame(() => {
      setStep('review');
      setSelectedWordIds(new Set(pending.selectedVocabIds));
    });
    return () => cancelAnimationFrame(raf);
  }, [zodiacId]);

  // 로그인이 확인된 뒤, pending 저장 의도가 있으면 기존 저장 로직(saveWords)을 정확히
  // 한 번만 재개한다. status가 이미 'processing'이면 — 직전 시도가 새로고침 등으로
  // 중단되어 결과를 알 수 없는 경우 — 자동으로 다시 저장을 시도하지 않고 payload만
  // 정리한다. 화면은 위 effect에서 이미 review로 복원되어 있으므로, 사용자가 직접
  // '저장하기'를 눌러도 안전하다(saveWords는 이미 저장된 id를 걸러내는 멱등 동작).
  useEffect(() => {
    if (!isLoggedIn) return;
    if (resumeSaveAttemptedRef.current) return;

    const pending = readPendingVocabSave(zodiacId);
    if (!pending) return;

    resumeSaveAttemptedRef.current = true;

    if (pending.status === 'processing') {
      clearPendingVocabSave();
      return;
    }

    markPendingVocabSaveProcessing();

    saveWords(pending.selectedVocabIds).then((result) => {
      if (result.status === 'saved') {
        trackVocabSaved({ zodiacId, savedCount: result.savedCount });
        clearPendingVocabSave();
        setStep('complete');
        return;
      }

      if (result.status === 'duplicate') {
        clearPendingVocabSave();
        showToast('이미 저장된 단어예요', 'info');
        return;
      }

      // 저장 실패 — review에 그대로 남기고, 다음 로드에서 한 번 더 자동 재개할 수 있도록
      // 상태만 'pending'으로 되돌린다(이 effect 자체는 매 마운트당 한 번만 실행되므로
      // 무한 자동 재시도로 이어지지 않는다).
      revertPendingVocabSaveToPending();
      showToast('단어를 저장하지 못했어요. 다시 시도해 주세요.', 'error');
    });
  }, [isLoggedIn, zodiacId, saveWords, showToast]);

  const openWordOverlay = (vocabularyId: string) => {
    trackVocabOpened({ zodiacId, vocabularyId });
    setActiveWordId(vocabularyId);
  };

  // dim 영역을 눌러 응답 없이 닫는 경우. 응답이 기록되지 않으므로 나중에 다시 열어
  // 응답할 수 있고, review 진입 시 선택 안 된 상태로 취급된다.
  const closeWordOverlay = () => setActiveWordId(null);

  // "잘 알아요"/"몰라요" 버튼 응답. 같은 단어를 다시 열어 응답을 바꿔도 키가 이미
  // 존재하므로 checkedWordIds(Object.keys 기반) 크기는 늘지 않는다 — 진행률 중복
  // 증가 없음. 응답과 동시에 카드를 닫는다.
  const respondToWord = (vocabularyId: string, knowledge: 'known' | 'unknown') => {
    setWordKnowledgeById((prev) => ({ ...prev, [vocabularyId]: knowledge }));
    setActiveWordId(null);
  };

  const goToReview = () => {
    const now = Date.now();
    trackReviewStarted({
      zodiacId,
      timeSpentMs: learningStartedAtRef.current !== null ? now - learningStartedAtRef.current : undefined,
    });
    reviewStartedAtRef.current = now;
    // "몰라요"로 응답한 단어는 저장 후보로 미리 선택해 두고, "잘 알아요"로 응답했거나
    // (이론상 도달하지 않아야 하지만 방어적으로) 응답이 없는 단어는 선택하지 않는다.
    // study로 돌아갔다가 다시 들어와도 매번 이 규칙으로 다시 계산한다.
    const initialSelected = new Set(
      (fortune?.vocabulary ?? [])
        .filter((word) => wordKnowledgeById[word.id] === 'unknown')
        .map((word) => word.id)
    );
    setSelectedWordIds(initialSelected);
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

  const selectLearningFeedback = (value: LearningFeedback) => {
    trackLearningFeedbackSelected({ zodiacId, value });
    setLearningFeedback(value);
    // '아쉬웠어요'가 아닌 다른 항목으로 바꾸면 이유 영역을 숨기고 선택도 초기화한다.
    if (value !== 'unhelpful') {
      setUnhelpfulReasonIds(new Set());
    }
  };

  const toggleUnhelpfulReason = (reasonId: string) => {
    trackLearningFeedbackReasonToggled({
      zodiacId,
      reasonId,
      checked: !unhelpfulReasonIds.has(reasonId),
    });
    setUnhelpfulReasonIds((prev) => {
      const next = new Set(prev);
      if (next.has(reasonId)) next.delete(reasonId);
      else next.add(reasonId);
      return next;
    });
  };

  const handleLoginStart = () => {
    // 저장 플로우 컨텍스트를 넘겨야만 login_started/pending 로그인 기록(분석 전용,
    // ohayo_pending_vocab_save와 무관한 별도 키)이 남는다 — 이 화면의 저장 CTA를
    // 통한 로그인만 login_started 퍼널에 집계된다.
    signInWithGoogle(window.location.pathname, {
      source: 'vocab_save',
      zodiacId,
      selectedVocabCount: selectedWordIds.size,
    });
  };

  const handleLoginSheetClose = () => {
    clearPendingVocabSave();
    setShowLoginSheet(false);
  };

  const handleSaveSelected = async () => {
    if (selectedWordIds.size === 0 || isSaving) return;

    trackSaveButtonClicked({
      zodiacId,
      selectedCount: selectedWordIds.size,
      timeSpentMs:
        reviewStartedAtRef.current !== null ? Date.now() - reviewStartedAtRef.current : undefined,
    });

    if (!isLoggedIn) {
      savePendingVocabSave({ zodiacId, selectedVocabIds: [...selectedWordIds] });
      setShowLoginSheet(true);
      return;
    }

    setIsSaving(true);
    const result = await saveWords([...selectedWordIds]);
    setIsSaving(false);

    if (result.status === 'saved') {
      trackVocabSaved({ zodiacId, savedCount: result.savedCount });
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

  // ─── complete 단계: 헤더 없이 완료 안내 + 오늘의 학습 피드백을 표시.
  // 버튼은 StickyActionBar로 하단 고정. 피드백은 UI/로컬 state만 다루며
  // 어떤 선택을 하든 하지 않든 하단 버튼 동작에는 영향을 주지 않는다. ───
  if (step === 'complete') {
    return (
      <div>
        <div className="page-content-with-sticky-cta px-[var(--page-padding-x)]">
          <div className="flex flex-col items-center justify-center gap-4 pt-24 pb-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-primary)]">
              <Icon name="check" size={32} className="text-[var(--text-inverse)]" />
            </div>
            <p className="text-h2 text-[var(--text-primary)]">단어 저장이 완료됐어요!</p>
          </div>

          {/* 오늘의 학습 피드백 — 저장/전송 없이 이 화면 안에서만 상태를 관리한다 */}
          <div className="pb-8">
            <p className="text-b1-medium text-[var(--text-primary)] text-center mb-4">
              오늘의 단어 학습이 도움이 되었나요?
            </p>

            <div
              role="radiogroup"
              aria-label="오늘의 단어 학습이 도움이 되었나요?"
              className="grid grid-cols-3 gap-2"
            >
              {FEEDBACK_OPTIONS.map((option) => {
                const active = learningFeedback === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => selectLearningFeedback(option.value)}
                    className={[
                      'flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border-[1.5px] px-2 py-3',
                      active
                        ? 'border-[var(--border-brand)] bg-[var(--surface-brand)]'
                        : 'border-[var(--border-default)] bg-[var(--color-white)]',
                    ].join(' ')}
                  >
                    <Icon
                      name={option.icon}
                      size={28}
                      aria-hidden="true"
                      className={active ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'}
                    />
                    <span
                      className={[
                        'text-caption',
                        active ? 'text-[var(--text-brand)] font-semibold' : 'text-[var(--text-secondary)]',
                      ].join(' ')}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {learningFeedback === 'unhelpful' && (
              <fieldset className="animate-fade-in m-0 mt-6 border-0 p-0">
                <legend className="text-b2-medium text-[var(--text-primary)] mb-3 p-0">
                  어떤 점이 아쉬웠나요?
                </legend>
                <div className="flex flex-col gap-2">
                  {UNHELPFUL_REASONS.map((reason) => (
                    <label
                      key={reason.id}
                      className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-default)] px-4 py-2 has-[:checked]:border-[var(--border-brand)]"
                    >
                      <input
                        type="checkbox"
                        checked={unhelpfulReasonIds.has(reason.id)}
                        onChange={() => toggleUnhelpfulReason(reason.id)}
                        className="h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
                      />
                      <span className="text-b2-regular text-[var(--text-primary)]">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </div>

        <StickyActionBar>
          <div className="flex w-full gap-3">
            <Button
              hierarchy="secondary"
              size="medium"
              fullWidth
              onClick={() => {
                trackCompletionActionClicked({ zodiacId, action: 'return_to_fortune' });
                setStep('study');
              }}
            >
              운세로 돌아가기
            </Button>
            <Button
              hierarchy="primary"
              size="medium"
              fullWidth
              onClick={() => {
                trackCompletionActionClicked({ zodiacId, action: 'view_saved' });
                router.push('/saved');
              }}
            >
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
                    partOfSpeech={vocab.partOfSpeech}
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
  // 런타임 매칭으로 대체하지 않는다 — koreanSegments/luckyItemKoSegments/
  // detailFortunes는 전부 M5가 DB에 저장해 둔 값이어야 한다. ───
  const { koreanSegments, luckyItemKoSegments, luckyItemKo, detailFortunes } = fortune;

  if (koreanSegments === null || luckyItemKoSegments === null || luckyItemKo === null || detailFortunes === null) {
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

  // 진행 안내 문구: 3/3 전에는 "확인해보세요", 3/3에서는 "모두 확인했어요"로 바뀐다.
  // 마지막 단어와 카운트 사이는 줄바꿈 시 (N/3)만 혼자 남지 않도록 nbsp로 묶는다.
  const progressText = isAllChecked
    ? '일본어 단어 3개를 모두 확인했어요'
    : '일본어 3개를 눌러서 전체 운세를 확인해보세요';

  // 세부 운세(연애/금전/일·학업)는 항상 love/money/work 3개가 있어야 화면에 닿는다
  // (위의 not-ready 가드에서 이미 detailFortunes !== null을 확인했다).
  const detailByCategory = new Map(detailFortunes.map((d) => [d.category, d]));
  const loveDetail = detailByCategory.get('love');
  const moneyDetail = detailByCategory.get('money');
  const workDetail = detailByCategory.get('work');

  return (
    <div>
      <TopNavigation
        variant="detail"
        title={`${fortune.rank}위 ${fortune.zodiacKorean}`}
        onBack={() => router.push('/')}
      />

      <div
        className={[
          'px-[var(--page-padding-x)] py-6',
          isAllChecked ? 'page-content-with-sticky-cta' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p className="text-b1-medium text-[var(--text-primary)] mb-6">
          {progressText}
          {' '}
          <span className="whitespace-nowrap text-[var(--text-brand)] font-semibold">
            ({checkedCount}/3)
          </span>
        </p>

        {/* 오늘의 운세 — 한국어 본문, 핵심 단어 3개만 확인 전 일본어 */}
        <section aria-label="오늘의 운세" className="mb-6">
          <h2 className="text-caption text-[var(--text-secondary)] font-semibold mb-3 tracking-wide">
            🔮 오늘의 운세
          </h2>
          <KoreanSegmentedText
            segments={koreanSegments}
            vocabulary={fortune.vocabulary}
            checkedWordIds={checkedWordIds}
            onWordClick={openWordOverlay}
            showFirstVocabHint
          />
        </section>

        {/* 행운의 장소와 아이템 — 동일한 방식(DB에 저장된 한국어 세그먼트) */}
        <section aria-label="행운의 장소와 아이템" className="mb-6">
          <h2 className="text-caption text-[var(--text-secondary)] font-semibold mb-3 tracking-wide">
            🍀 행운의 장소와 아이템
          </h2>
          <KoreanSegmentedText
            segments={luckyItemKoSegments}
            vocabulary={fortune.vocabulary}
            checkedWordIds={checkedWordIds}
            onWordClick={openWordOverlay}
          />
        </section>

        {/* 세부 운세(연애·금전·일학업) — 공식 오하아사 소스에는 없는 AI 보충 콘텐츠지만,
            공식 운세(위 1, 2)와 같은 섹션 형식으로 자연스럽게 이어서 보여준다. */}
        {loveDetail && (
          <section aria-label="오늘의 연애·인간관계운" className="mb-6">
            <h2 className="text-caption text-[var(--text-secondary)] font-semibold mb-3 tracking-wide">
              💖 오늘의 연애·인간관계운
            </h2>
            <KoreanSegmentedText
              segments={loveDetail.koreanSegments}
              vocabulary={fortune.vocabulary}
              checkedWordIds={checkedWordIds}
              onWordClick={openWordOverlay}
            />
          </section>
        )}

        {moneyDetail && (
          <section aria-label="오늘의 금전운" className="mb-6">
            <h2 className="text-caption text-[var(--text-secondary)] font-semibold mb-3 tracking-wide">
              💰 오늘의 금전운
            </h2>
            <KoreanSegmentedText
              segments={moneyDetail.koreanSegments}
              vocabulary={fortune.vocabulary}
              checkedWordIds={checkedWordIds}
              onWordClick={openWordOverlay}
            />
          </section>
        )}

        {workDetail && (
          <section aria-label="오늘의 일·학업운">
            <h2 className="text-caption text-[var(--text-secondary)] font-semibold mb-3 tracking-wide">
              💼 오늘의 일·학업운
            </h2>
            <KoreanSegmentedText
              segments={workDetail.koreanSegments}
              vocabulary={fortune.vocabulary}
              checkedWordIds={checkedWordIds}
              onWordClick={openWordOverlay}
            />
          </section>
        )}
      </div>

      {/* 복습 진입 CTA — 3/3을 달성한 순간에만 생성된다(항상 마운트된 채 숨겨두지 않음).
          자동으로 review로 넘어가지 않으며 사용자가 직접 눌러야 이동한다. */}
      {isAllChecked && (
        <StickyActionBar className="animate-fade-in">
          <Button hierarchy="primary" size="large" fullWidth onClick={goToReview}>
            운세 속 단어 보관하기
          </Button>
        </StickyActionBar>
      )}

      {/* 단어 카드 오버레이 — 항상 앞면(단어+읽는 법+한국어 뜻+발음 듣기)만 표시, 뒤집기 없음.
          "잘 알아요"/"몰라요" 중 하나를 누르거나 dim 영역을 눌러야만 닫힌다(자동 종료 없음). */}
      <VocabCardOverlay isOpen={activeWordId !== null} onClose={closeWordOverlay}>
        {activeWord && (
          <VocabCard
            mode="front"
            word={activeWord.surfaceForm}
            reading={activeWord.reading}
            meaning={activeWord.meaning}
            partOfSpeech={activeWord.partOfSpeech}
            onPlayAudio={() => speak(activeWord.reading || activeWord.surfaceForm)}
            knowledge={wordKnowledgeById[activeWord.id] ?? null}
            onRespond={(knowledge) => respondToWord(activeWord.id, knowledge)}
          />
        )}
      </VocabCardOverlay>
    </div>
  );
}
