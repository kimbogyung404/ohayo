import type { Segment, Vocabulary } from '@/types/fortune';

// luckyItem에는 originalText처럼 AI가 미리 만들어 둔 segments가 없다(DB/AI 파이프라인 미변경).
// 대신 프론트 런타임에서 vocabulary.surfaceForm과 문자열이 정확히 일치하는 부분만 찾아
// 강조 대상으로 변환한다. 여러 단어가 겹치면 긴 surfaceForm을 먼저 매칭해 우선권을 주고,
// 이미 매칭된 범위는 다른 단어가 다시 차지하지 않는다. 일치하는 단어가 없으면 원문 그대로
// 하나의 일반 텍스트 조각으로 반환한다.
export function buildLuckyItemSegments(luckyItem: string, vocabulary: Vocabulary[]): Segment[] {
  const claimed = new Array(luckyItem.length).fill(false);
  const matches: { start: number; end: number; vocabularyId: string }[] = [];

  const sortedBySurfaceFormLengthDesc = [...vocabulary]
    .filter((v) => v.surfaceForm.length > 0)
    .sort((a, b) => b.surfaceForm.length - a.surfaceForm.length);

  for (const vocab of sortedBySurfaceFormLengthDesc) {
    const { surfaceForm, id } = vocab;
    let fromIndex = 0;
    while (fromIndex <= luckyItem.length - surfaceForm.length) {
      const idx = luckyItem.indexOf(surfaceForm, fromIndex);
      if (idx === -1) break;

      const end = idx + surfaceForm.length;
      const overlapsClaimedRange = claimed.slice(idx, end).some(Boolean);
      if (!overlapsClaimedRange) {
        for (let i = idx; i < end; i++) claimed[i] = true;
        matches.push({ start: idx, end, vocabularyId: id });
      }
      fromIndex = idx + 1;
    }
  }

  if (matches.length === 0) {
    return [{ text: luckyItem, vocabularyId: null }];
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({ text: luckyItem.slice(cursor, match.start), vocabularyId: null });
    }
    segments.push({ text: luckyItem.slice(match.start, match.end), vocabularyId: match.vocabularyId });
    cursor = match.end;
  }
  if (cursor < luckyItem.length) {
    segments.push({ text: luckyItem.slice(cursor), vocabularyId: null });
  }

  return segments;
}
