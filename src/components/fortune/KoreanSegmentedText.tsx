'use client';

import { useMemo } from 'react';
import VocabHighlight from '@/components/ui/VocabHighlight';
import type { KoreanSegment, Vocabulary } from '@/types/fortune';

interface KoreanSegmentedTextProps {
  segments: KoreanSegment[];
  vocabulary: Vocabulary[];
  checkedWordIds: Set<string>;
  onWordClick: (vocabularyId: string) => void;
  // 이 섹션의 첫 번째 단어 하이라이트에 "눌러서 뜻 보기" 안내를 보여줄지. 페이지 전체에서
  // 가장 먼저 등장하는 섹션(오늘의 운세)에서만 true로 전달한다.
  showFirstVocabHint?: boolean;
}

const FIRST_VOCAB_HINT_TEXT = '눌러서 뜻 보기';

// koreanSegments/luckyItemKoSegments 전용 렌더러. 일반 text 세그먼트는 항상 한국어
// (Pretendard 18px, .text-b1-medium)로 표시하고, vocabulary 세그먼트는 확인 여부에 따라
// surfaceForm(일본어, 비활성)과 segment.koreanText(한국어 활용형, 활성)를 토글한다.
// 본문과 하이라이트 단어의 글자 크기를 동일한 18px로 맞춘다(VocabHighlight 참고).
// 세그먼트는 전부 M5가 DB에 미리 저장해 둔 값이며, 이 컴포넌트는 문자열 매칭을 하지 않는다.
export default function KoreanSegmentedText({
  segments,
  vocabulary,
  checkedWordIds,
  onWordClick,
  showFirstVocabHint = false,
}: KoreanSegmentedTextProps) {
  const surfaceFormById = useMemo(
    () => new Map(vocabulary.map((v) => [v.id, v.surfaceForm])),
    [vocabulary]
  );

  const firstVocabIndex = useMemo(
    () => segments.findIndex((s) => s.type === 'vocabulary'),
    [segments]
  );

  return (
    <p
      className={[
        'text-b1-medium text-[var(--text-primary)] leading-[1.4]',
        // 첫 하이라이트 안내 툴팁이 위로 뜰 공간을 확보한다 — 섹션 제목과의 기존 여백(12px)만으로는
        // 툴팁(약 25px + 2px 간격)이 들어갈 자리가 없어 제목과 겹친다.
        showFirstVocabHint ? 'mt-5' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      lang="ko"
    >
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.text}</span>;
        }

        const checked = checkedWordIds.has(segment.vocabularyId);
        const surfaceForm = surfaceFormById.get(segment.vocabularyId) ?? segment.koreanText;

        return (
          <VocabHighlight
            key={index}
            selected={checked}
            hint={showFirstVocabHint && index === firstVocabIndex ? FIRST_VOCAB_HINT_TEXT : undefined}
            lang={checked ? 'ko' : 'ja'}
            onClick={() => onWordClick(segment.vocabularyId)}
          >
            {checked ? segment.koreanText : surfaceForm}
          </VocabHighlight>
        );
      })}
    </p>
  );
}
