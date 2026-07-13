'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getFortuneByZodiac, getLatestReadyDate } from '@/lib/fortune/queries';
import { getZodiac } from '@/lib/zodiac';
import FortuneSentence from '@/components/fortune/FortuneSentence';
import VocabularyPopover from '@/components/fortune/VocabularyPopover';
import ReadingReveal from '@/components/fortune/ReadingReveal';
import TranslationReveal from '@/components/fortune/TranslationReveal';
import LuckyItem from '@/components/fortune/LuckyItem';
import SourceNotice from '@/components/fortune/SourceNotice';
import LoginPromptSheet from '@/components/auth/LoginPromptSheet';
import LoadingState from '@/components/common/LoadingState';
import ErrorState from '@/components/common/ErrorState';
import { useAuth } from '@/hooks/useAuth';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import { useToast } from '@/components/ui/Toast';
import type { Fortune, ZodiacId } from '@/types/fortune';

const PENDING_SAVE_KEY = 'ohayo_pending_save';

interface PendingSave {
  returnUrl: string;
  pendingVocabularyId: string;
  zodiacId: string;
}

type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';

export default function FortuneDetailPage() {
  const params = useParams();
  const zodiacId = params.zodiacId as ZodiacId;
  const router = useRouter();

  const zodiac = getZodiac(zodiacId);

  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedVocabId, setSelectedVocabId] = useState<string | null>(null);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const { user, isLoggedIn, signInWithGoogle, waitForSession } = useAuth();
  const { isSaved, saveWord, unsaveWord } = useSavedVocabulary(user?.id ?? null);
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

  // "바로 복습" 액션: 저장한 단어 화면으로 이동한다.
  // /saved는 이미 saved_at 최신순으로 정렬되어 있어 방금 저장한 단어가 자동으로 첫 카드가 된다.
  const goToSavedReview = () => {
    router.push('/saved');
  };

  // 로그인 전에 선택했던 단어를 로그인 완료 후 자동 저장한다.
  //
  // sessionStorage의 pending 정보는 "저장 성공/중복 확인"이 끝난 뒤에만 지운다.
  // 세션이 아직 준비되지 않았거나 저장이 실패하면 pending을 그대로 남겨
  // 다음 기회(재마운트, 재시도 등)에 다시 시도할 수 있게 한다.
  useEffect(() => {
    if (!isLoggedIn) return;

    const raw = sessionStorage.getItem(PENDING_SAVE_KEY);
    if (!raw) return;

    let pending: PendingSave;
    try {
      pending = JSON.parse(raw) as PendingSave;
    } catch {
      // 복구 불가능한 손상된 데이터만 즉시 정리한다.
      sessionStorage.removeItem(PENDING_SAVE_KEY);
      return;
    }

    if (pending.zodiacId !== zodiacId) return;

    let cancelled = false;

    (async () => {
      // isLoggedIn(React state)이 true여도 브라우저 세션이 아직 준비되지
      // 않았을 수 있으므로, 실제 인증 사용자를 재확인한 뒤에만 저장을 시도한다.
      const verifiedUserId = await waitForSession();
      if (cancelled) return;

      if (!verifiedUserId) {
        // 세션 확인 실패: pending을 유지하고 조용히 종료한다 (재시도 기회를 남김).
        return;
      }

      const result = await saveWord(pending.pendingVocabularyId);
      if (cancelled) return;

      if (result.status === 'saved') {
        sessionStorage.removeItem(PENDING_SAVE_KEY);
        showToast('단어가 저장되었어요', 'success', { label: '바로 복습', onClick: goToSavedReview });
      } else if (result.status === 'duplicate') {
        sessionStorage.removeItem(PENDING_SAVE_KEY);
        showToast('이미 저장된 단어예요', 'info');
      } else {
        // save_failed / not_logged_in: pending을 유지한다. 성공 토스트는 띄우지 않는다.
        showToast('단어를 저장하지 못했어요. 다시 시도해 주세요.', 'error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, zodiacId]);

  const handleLoginStart = () => {
    signInWithGoogle(window.location.pathname);
  };

  const handleLoginSheetClose = () => {
    sessionStorage.removeItem(PENDING_SAVE_KEY);
    setShowLoginSheet(false);
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

  const selectedVocab = fortune.vocabulary.find((v) => v.id === selectedVocabId);

  const handleWordClick = (vocabId: string) => {
    setSelectedVocabId((prev) => (prev === vocabId ? null : vocabId));
  };

  const handleSave = async (vocabId: string) => {
    if (!isLoggedIn) {
      const pending: PendingSave = {
        returnUrl: window.location.pathname,
        pendingVocabularyId: vocabId,
        zodiacId,
      };
      sessionStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(pending));
      setShowLoginSheet(true);
      return;
    }

    const result = await saveWord(vocabId);
    if (result.status === 'saved') {
      showToast('단어가 저장되었어요', 'success', { label: '바로 복습', onClick: goToSavedReview });
    } else if (result.status === 'duplicate') {
      showToast('이미 저장된 단어예요', 'info');
    } else {
      showToast('단어를 저장하지 못했어요. 다시 시도해 주세요.', 'error');
    }
  };

  const handleUnsave = async (vocabId: string) => {
    const result = await unsaveWord(vocabId);
    if (result.status === 'removed') {
      showToast('저장을 해제했어요.', 'info');
    } else {
      showToast('저장 해제에 실패했어요. 다시 시도해 주세요.', 'error');
    }
  };

  const fortuneDate = new Date(fortune.date).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <div>
      {/* ─── 상단 헤더 ─── */}
      <header className="sticky top-0 z-30 bg-[var(--surface-default)] border-b border-[var(--border-default)] px-[var(--page-padding-x)] py-3 flex items-center gap-3">
        <Link
          href="/"
          aria-label="홈으로 돌아가기"
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--surface-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] flex-shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M13 4l-6 6 6 6" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-h2 text-[var(--text-primary)] truncate" lang="ja">
            {fortune.zodiacJapanese}
          </p>
          <p className="text-caption text-[var(--text-secondary)]">{fortune.zodiacKorean}</p>
        </div>
        <div className="flex-shrink-0 text-center">
          <p className="text-caption text-[var(--text-tertiary)]">{fortuneDate}</p>
          <p className="text-b1-semibold text-[var(--brand-primary)]">{fortune.rank}위</p>
        </div>
      </header>

      {/* ─── 콘텐츠 ─── */}
      <div className="px-[var(--page-padding-x)] py-6 space-y-0">
        {/* 별자리 이모지 */}
        <div className="text-center mb-6">
          <span className="text-[4rem] leading-none" aria-hidden="true">
            {zodiac.emoji}
          </span>
        </div>

        {/* 일본어 운세 원문 섹션 */}
        <section aria-label="일본어 운세 원문">
          <h2 className="text-caption text-[var(--text-tertiary)] font-semibold mb-3 tracking-wide">
            오늘의 운세
          </h2>

          {/* 핵심 단어 강조가 포함된 운세 문장 */}
          <FortuneSentence
            segments={fortune.segments}
            vocabulary={fortune.vocabulary}
            selectedVocabId={selectedVocabId}
            onWordClick={handleWordClick}
          />

          {/* 선택된 단어 팝오버 */}
          {selectedVocab && (
            <VocabularyPopover
              id={`vocab-popover-${selectedVocab.id}`}
              vocab={selectedVocab}
              isSaved={isSaved(selectedVocab.id)}
              onSave={() => handleSave(selectedVocab.id)}
              onUnsave={() => handleUnsave(selectedVocab.id)}
            />
          )}

          {/* 읽는 법 토글 */}
          <ReadingReveal readingText={fortune.readingText} />
        </section>

        {/* 구분선 */}
        <div className="border-t border-[var(--border-default)] my-6" />

        {/* 한국어 전체 해석 (기본 숨김) */}
        <section aria-label="한국어 전체 해석">
          <TranslationReveal koreanTranslation={fortune.koreanTranslation} />
        </section>

        {/* 행운의 장소 / 아이템 */}
        <LuckyItem item={fortune.luckyItem} />

        {/* 출처 및 비공식 서비스 안내 */}
        <SourceNotice
          sourceDate={fortune.sourceDate}
          sourceUrl={fortune.sourceUrl}
        />
      </div>

      {/* ─── 로그인 안내 바텀시트 ─── */}
      <LoginPromptSheet
        isOpen={showLoginSheet}
        onClose={handleLoginSheetClose}
        onLogin={handleLoginStart}
      />
    </div>
  );
}
