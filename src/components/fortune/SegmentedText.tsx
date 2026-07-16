'use client';

import VocabHighlight from '@/components/ui/VocabHighlight';
import type { Segment } from '@/types/fortune';

interface SegmentedTextProps {
  segments: Segment[];
  checkedWordIds: Set<string>;
  onWordClick: (vocabularyId: string) => void;
}

// originalText의 실제 segments와, luckyItem의 런타임 매칭 결과 segments를
// 동일한 방식으로 렌더링하기 위한 공용 컴포넌트.
export default function SegmentedText({ segments, checkedWordIds, onWordClick }: SegmentedTextProps) {
  return (
    <p
      className="text-b1-medium text-[var(--text-primary)] leading-[1.8]"
      lang="ja"
      style={{ wordBreak: 'keep-all' }}
    >
      {segments.map((segment, index) => {
        if (segment.vocabularyId === null) {
          return <span key={index}>{segment.text}</span>;
        }

        const vocabularyId = segment.vocabularyId;
        return (
          <VocabHighlight
            key={index}
            selected={checkedWordIds.has(vocabularyId)}
            onClick={() => onWordClick(vocabularyId)}
          >
            {segment.text}
          </VocabHighlight>
        );
      })}
    </p>
  );
}
