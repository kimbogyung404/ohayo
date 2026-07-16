'use client';

import { useMemo } from 'react';
import VocabHighlight from '@/components/ui/VocabHighlight';
import type { KoreanSegment, Vocabulary } from '@/types/fortune';

interface KoreanSegmentedTextProps {
  segments: KoreanSegment[];
  vocabulary: Vocabulary[];
  checkedWordIds: Set<string>;
  onWordClick: (vocabularyId: string) => void;
}

// koreanSegments/luckyItemKoSegments 전용 렌더러. 일반 text 세그먼트는 항상 한국어
// (Pretendard 24px, .text-h1)로 표시하고, vocabulary 세그먼트는 확인 여부에 따라
// surfaceForm(일본어, 비활성)과 segment.koreanText(한국어 활용형, 활성)를 토글한다.
// 세그먼트는 전부 M5가 DB에 미리 저장해 둔 값이며, 이 컴포넌트는 문자열 매칭을 하지 않는다.
export default function KoreanSegmentedText({
  segments,
  vocabulary,
  checkedWordIds,
  onWordClick,
}: KoreanSegmentedTextProps) {
  const surfaceFormById = useMemo(
    () => new Map(vocabulary.map((v) => [v.id, v.surfaceForm])),
    [vocabulary]
  );

  return (
    <p className="text-h1 text-[var(--text-primary)] leading-[1.4]" lang="ko">
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
            language={checked ? 'ko' : 'ja'}
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
