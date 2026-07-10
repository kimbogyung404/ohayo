'use client';

import type { Segment, Vocabulary } from '@/types/fortune';
import HighlightedWord from './HighlightedWord';

interface FortuneSentenceProps {
  segments: Segment[];
  vocabulary: Vocabulary[];
  selectedVocabId: string | null;
  onWordClick: (vocabId: string) => void;
}

export default function FortuneSentence({
  segments,
  vocabulary,
  selectedVocabId,
  onWordClick,
}: FortuneSentenceProps) {
  const vocabMap = new Map(vocabulary.map((v) => [v.id, v]));

  return (
    <p
      className="text-b1-medium text-[var(--text-primary)] leading-[1.8]"
      lang="ja"
      style={{ wordBreak: 'keep-all' }}
    >
      {segments.map((seg, i) => {
        if (seg.vocabularyId === null) {
          return <span key={i}>{seg.text}</span>;
        }

        const vocab = vocabMap.get(seg.vocabularyId);
        if (!vocab) return <span key={i}>{seg.text}</span>;

        const isSelected = selectedVocabId === seg.vocabularyId;

        return (
          <HighlightedWord
            key={i}
            vocabularyId={seg.vocabularyId}
            isSelected={isSelected}
            aria-expanded={isSelected}
            onClick={() => onWordClick(seg.vocabularyId!)}
          >
            {seg.text}
          </HighlightedWord>
        );
      })}
    </p>
  );
}
