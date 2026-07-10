'use client';

import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { getMockFortune } from '@/lib/fortune/mock';
import { getZodiac } from '@/lib/zodiac';
import FortuneSentence from '@/components/fortune/FortuneSentence';
import VocabularyPopover from '@/components/fortune/VocabularyPopover';
import ReadingReveal from '@/components/fortune/ReadingReveal';
import TranslationReveal from '@/components/fortune/TranslationReveal';
import LuckyItem from '@/components/fortune/LuckyItem';
import SourceNotice from '@/components/fortune/SourceNotice';
import LoginPromptSheet from '@/components/auth/LoginPromptSheet';
import { useSavedVocabulary } from '@/hooks/useSavedVocabulary';
import { useToast } from '@/components/ui/Toast';
import type { ZodiacId } from '@/types/fortune';

export default function FortuneDetailPage() {
  const params = useParams();
  const zodiacId = params.zodiacId as ZodiacId;

  const fortune = getMockFortune(zodiacId);
  const zodiac = getZodiac(zodiacId);

  const [selectedVocabId, setSelectedVocabId] = useState<string | null>(null);
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  // M1: 로컬 저장 상태 (M2에서 Supabase로 교체)
  const { isSaved, saveWord, unsaveWord } = useSavedVocabulary();
  const { showToast } = useToast();

  // M1: 로그인 상태 시뮬레이션 (항상 비로그인)
  const isLoggedIn = false;

  if (!fortune || !zodiac) {
    notFound();
  }

  const selectedVocab = fortune.vocabulary.find((v) => v.id === selectedVocabId);

  const handleWordClick = (vocabId: string) => {
    setSelectedVocabId((prev) => (prev === vocabId ? null : vocabId));
  };

  const handleSave = (vocabId: string) => {
    if (!isLoggedIn) {
      setShowLoginSheet(true);
      return;
    }
    saveWord(fortune, vocabId);
    showToast('단어를 저장했어요!', 'success');
  };

  const handleUnsave = (vocabId: string) => {
    unsaveWord(vocabId);
    showToast('저장을 해제했어요.', 'info');
  };

  const handleLoginComplete = () => {
    // M2에서 실제 OAuth 연결 후 선택했던 단어를 자동 저장할 예정
    setShowLoginSheet(false);
    showToast('M2 단계에서 Google 로그인이 연결됩니다.', 'info');
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
            {zodiac.japanese}
          </p>
          <p className="text-caption text-[var(--text-secondary)]">{zodiac.korean}</p>
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
        onClose={() => setShowLoginSheet(false)}
        onLogin={handleLoginComplete}
      />
    </div>
  );
}
