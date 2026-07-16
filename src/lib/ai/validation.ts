import { z } from 'zod';
import type { KoreanSegment, Segment } from '@/types/fortune';

// Gemini에게는 "원문 표기(surfaceForm)"만 요청한다.
// 사전형(word) 필드는 별도로 요청하지 않는다 — word는 항상 surfaceForm과 동일한 값을 저장한다
// (원문에 없는 활용 전 기본형이 임의로 저장되는 것을 원천 차단하기 위함).
// koreanText는 meaning(사전형/의역)과 달리 koreanTranslation 또는 luckyItemKo 안에
// 실제로 등장하는 활용형이어야 한다 — 아래 검증에서 문자열 존재 여부를 직접 확인한다.
const GeminiVocabularySchema = z.object({
  surfaceForm: z.string(),
  reading: z.string(),
  meaning: z.string(),
  koreanText: z.string(),
});

export const GeminiOutputSchema = z.object({
  readingText: z.string(),
  koreanTranslation: z.string(),
  luckyItemKo: z.string(),
  vocabulary: z.array(GeminiVocabularySchema).length(3),
});

export type GeminiOutput = z.infer<typeof GeminiOutputSchema>;

export interface ValidatedVocabularyEntry {
  surfaceForm: string;
  reading: string;
  meaning: string;
  koreanText: string;
  startIndex: number;                    // originalText 안의 위치
  koreanStartIndex: number | null;       // koreanTranslation 안의 위치 (없으면 null)
  luckyItemKoStartIndex: number | null;  // luckyItemKo 안의 위치 (없으면 null)
}

export interface ValidatedAiResult {
  readingText: string;
  koreanTranslation: string;
  luckyItemKo: string;
  vocabulary: ValidatedVocabularyEntry[]; // startIndex(원문 기준) 오름차순 정렬됨
}

export type AiValidationResult =
  | { ok: true; data: ValidatedAiResult }
  | { ok: false; reason: string };

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    count += 1;
    pos = haystack.indexOf(needle, pos + 1);
  }
  return count;
}

// koreanText가 대상 텍스트(koreanTranslation 또는 luckyItemKo) 안에 정확히 한 번만
// 등장하는지 확인한다. 프론트에서 greedy 문자열 매칭을 하지 않는 대신, 저장 전에
// 여기서 위치를 확정한다 — surfaceForm/originalText 검증과 동일한 방식이다.
type UniqueOccurrence = { kind: 'found'; startIndex: number } | { kind: 'none' } | { kind: 'ambiguous' };

function locateUniqueOccurrence(haystack: string, needle: string): UniqueOccurrence {
  if (needle.trim() === '') return { kind: 'none' };
  const count = countOccurrences(haystack, needle);
  if (count === 0) return { kind: 'none' };
  if (count > 1) return { kind: 'ambiguous' };
  return { kind: 'found', startIndex: haystack.indexOf(needle) };
}

// startIndex 기준으로 겹치는 범위가 없는지 확인한다. buildSegments의 원문 겹침 검사와
// 동일한 규칙을 koreanTranslation/luckyItemKo 각각에도 적용하기 위한 공용 함수.
function findOverlap<T extends { startIndex: number; length: number; label: string }>(
  itemsSortedByStart: T[]
): { a: string; b: string } | null {
  for (let i = 0; i < itemsSortedByStart.length - 1; i++) {
    const current = itemsSortedByStart[i];
    const next = itemsSortedByStart[i + 1];
    if (current.startIndex + current.length > next.startIndex) {
      return { a: current.label, b: next.label };
    }
  }
  return null;
}

// Gemini 원본 JSON + original_text를 받아 스키마/비즈니스 규칙을 모두 검증한다.
// 하나라도 실패하면 전체를 실패로 처리한다(부분 통과 없음).
export function validateAiResult(json: unknown, originalText: string): AiValidationResult {
  const parsed = GeminiOutputSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message.slice(0, 200)}` };
  }

  const { readingText, koreanTranslation, luckyItemKo, vocabulary } = parsed.data;

  if (readingText.trim() === '') {
    return { ok: false, reason: 'readingText is empty' };
  }
  if (koreanTranslation.trim() === '') {
    return { ok: false, reason: 'koreanTranslation is empty' };
  }
  if (luckyItemKo.trim() === '') {
    return { ok: false, reason: 'luckyItemKo is empty' };
  }

  // 읽는 법은 원문과 같은 줄 구조(줄 수)를 유지해야 한다.
  const originalLineCount = originalText.split('\n').length;
  const readingLineCount = readingText.split('\n').length;
  if (originalLineCount !== readingLineCount) {
    return {
      ok: false,
      reason: `line count mismatch: original=${originalLineCount}, reading=${readingLineCount}`,
    };
  }

  // 3개 surfaceForm이 서로 달라야 한다.
  const surfaceForms = vocabulary.map((v) => v.surfaceForm);
  if (new Set(surfaceForms).size !== 3) {
    return { ok: false, reason: 'duplicate surfaceForm detected' };
  }

  const withPositions: ValidatedVocabularyEntry[] = [];

  for (const v of vocabulary) {
    if (v.surfaceForm.trim() === '') {
      return { ok: false, reason: 'empty surfaceForm' };
    }
    if (v.reading.trim() === '') {
      return { ok: false, reason: `empty reading for surfaceForm "${v.surfaceForm}"` };
    }
    if (v.meaning.trim() === '') {
      return { ok: false, reason: `empty meaning for surfaceForm "${v.surfaceForm}"` };
    }
    if (v.koreanText.trim() === '') {
      return { ok: false, reason: `empty koreanText for surfaceForm "${v.surfaceForm}"` };
    }

    const occurrences = countOccurrences(originalText, v.surfaceForm);
    if (occurrences === 0) {
      return { ok: false, reason: `surfaceForm not found in original text: "${v.surfaceForm}"` };
    }
    if (occurrences > 1) {
      return {
        ok: false,
        reason: `ambiguous surfaceForm occurrence (${occurrences}x), position unclear: "${v.surfaceForm}"`,
      };
    }

    const startIndex = originalText.indexOf(v.surfaceForm);

    // koreanText는 koreanTranslation 또는 luckyItemKo 중 최소 한 곳에 정확히 한 번
    // 등장해야 한다. 둘 다에 없으면(=번역문 어디에도 연결되지 않으면) 실패 처리한다.
    const inKorean = locateUniqueOccurrence(koreanTranslation, v.koreanText);
    if (inKorean.kind === 'ambiguous') {
      return {
        ok: false,
        reason: `ambiguous koreanText occurrence in koreanTranslation, position unclear: "${v.koreanText}"`,
      };
    }
    const inLuckyItem = locateUniqueOccurrence(luckyItemKo, v.koreanText);
    if (inLuckyItem.kind === 'ambiguous') {
      return {
        ok: false,
        reason: `ambiguous koreanText occurrence in luckyItemKo, position unclear: "${v.koreanText}"`,
      };
    }
    if (inKorean.kind === 'none' && inLuckyItem.kind === 'none') {
      return {
        ok: false,
        reason: `koreanText not found in koreanTranslation or luckyItemKo: "${v.koreanText}"`,
      };
    }

    withPositions.push({
      surfaceForm: v.surfaceForm,
      reading: v.reading,
      meaning: v.meaning,
      koreanText: v.koreanText,
      startIndex,
      koreanStartIndex: inKorean.kind === 'found' ? inKorean.startIndex : null,
      luckyItemKoStartIndex: inLuckyItem.kind === 'found' ? inLuckyItem.startIndex : null,
    });
  }

  withPositions.sort((a, b) => a.startIndex - b.startIndex);

  // 겹치는 범위 거부 (원문 기준)
  const originalOverlap = findOverlap(
    withPositions.map((v) => ({ startIndex: v.startIndex, length: v.surfaceForm.length, label: v.surfaceForm }))
  );
  if (originalOverlap) {
    return {
      ok: false,
      reason: `overlapping vocabulary ranges: "${originalOverlap.a}" / "${originalOverlap.b}"`,
    };
  }

  // 겹치는 범위 거부 (koreanTranslation 기준 — koreanStartIndex가 있는 항목만)
  const koreanPlacements = withPositions
    .filter((v) => v.koreanStartIndex !== null)
    .map((v) => ({ startIndex: v.koreanStartIndex as number, length: v.koreanText.length, label: v.koreanText }))
    .sort((a, b) => a.startIndex - b.startIndex);
  const koreanOverlap = findOverlap(koreanPlacements);
  if (koreanOverlap) {
    return {
      ok: false,
      reason: `overlapping koreanText ranges in koreanTranslation: "${koreanOverlap.a}" / "${koreanOverlap.b}"`,
    };
  }

  // 겹치는 범위 거부 (luckyItemKo 기준 — luckyItemKoStartIndex가 있는 항목만)
  const luckyItemPlacements = withPositions
    .filter((v) => v.luckyItemKoStartIndex !== null)
    .map((v) => ({
      startIndex: v.luckyItemKoStartIndex as number,
      length: v.koreanText.length,
      label: v.koreanText,
    }))
    .sort((a, b) => a.startIndex - b.startIndex);
  const luckyItemOverlap = findOverlap(luckyItemPlacements);
  if (luckyItemOverlap) {
    return {
      ok: false,
      reason: `overlapping koreanText ranges in luckyItemKo: "${luckyItemOverlap.a}" / "${luckyItemOverlap.b}"`,
    };
  }

  return {
    ok: true,
    data: { readingText, koreanTranslation, luckyItemKo, vocabulary: withPositions },
  };
}

export interface VocabularyWithId {
  vocabularyId: string;
  surfaceForm: string;
  startIndex: number;
}

// vocabularyId가 배정된 뒤(저장 직전) 호출한다. 위치 정보를 기준으로
// original_text를 조각내 segments를 결정론적으로 만든다(AI가 직접 만들지 않음).
export function buildSegments(
  originalText: string,
  vocabulary: VocabularyWithId[]
): { segments: Segment[]; reconstructed: string } {
  const sorted = [...vocabulary].sort((a, b) => a.startIndex - b.startIndex);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const v of sorted) {
    if (v.startIndex > cursor) {
      segments.push({ text: originalText.slice(cursor, v.startIndex), vocabularyId: null });
    }
    segments.push({ text: v.surfaceForm, vocabularyId: v.vocabularyId });
    cursor = v.startIndex + v.surfaceForm.length;
  }

  if (cursor < originalText.length) {
    segments.push({ text: originalText.slice(cursor), vocabularyId: null });
  }

  const reconstructed = segments.map((s) => s.text).join('');
  return { segments, reconstructed };
}

export interface KoreanVocabularyPlacement {
  vocabularyId: string;
  koreanText: string;
  startIndex: number;
}

// vocabularyId가 배정된 뒤(저장 직전) 호출한다. koreanTranslation 또는 luckyItemKo를
// koreanStartIndex/luckyItemKoStartIndex 기준으로 결정론적으로 조각낸다(AI가 세그먼트
// 배열 자체를 만들지 않는다 — buildSegments와 동일한 방식). placements가 비어 있으면
// 전체를 하나의 text 세그먼트로 반환한다(해당 텍스트에 연결된 vocabulary가 없는 경우).
export function buildKoreanSegments(
  text: string,
  placements: KoreanVocabularyPlacement[]
): { segments: KoreanSegment[]; reconstructed: string } {
  const sorted = [...placements].sort((a, b) => a.startIndex - b.startIndex);
  const segments: KoreanSegment[] = [];
  let cursor = 0;

  for (const p of sorted) {
    if (p.startIndex > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, p.startIndex) });
    }
    segments.push({ type: 'vocabulary', vocabularyId: p.vocabularyId, koreanText: p.koreanText });
    cursor = p.startIndex + p.koreanText.length;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', text });
  }

  const reconstructed = segments.map((s) => (s.type === 'text' ? s.text : s.koreanText)).join('');
  return { segments, reconstructed };
}

// ─────────────────────────────────────────────────────────────
// 백필 전용 검증: 기존에 확정된 koreanTranslation/vocabulary id 목록을 입력으로
// 받아, Gemini가 새로 만든 koreanText/luckyItemKo만 검증한다. 정방향 M5의
// validateAiResult와 같은 규칙(정확히 한 번 등장, 겹침 없음)을 재사용한다.
// ─────────────────────────────────────────────────────────────

const BackfillVocabularySchema = z.object({
  id: z.string(),
  koreanText: z.string(),
});

export const BackfillOutputSchema = z.object({
  luckyItemKo: z.string(),
  vocabulary: z.array(BackfillVocabularySchema),
});

export interface ValidatedBackfillVocabularyEntry {
  id: string;
  koreanText: string;
  koreanStartIndex: number | null;
  luckyItemKoStartIndex: number | null;
}

export interface ValidatedBackfillResult {
  luckyItemKo: string;
  vocabulary: ValidatedBackfillVocabularyEntry[];
}

export type BackfillValidationResult =
  | { ok: true; data: ValidatedBackfillResult }
  | { ok: false; reason: string };

export function validateBackfillResult(
  json: unknown,
  koreanTranslation: string,
  expectedVocabularyIds: string[]
): BackfillValidationResult {
  const parsed = BackfillOutputSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message.slice(0, 200)}` };
  }

  const { luckyItemKo, vocabulary } = parsed.data;
  if (luckyItemKo.trim() === '') {
    return { ok: false, reason: 'luckyItemKo is empty' };
  }

  const expectedSet = new Set(expectedVocabularyIds);
  const returnedSet = new Set(vocabulary.map((v) => v.id));
  if (vocabulary.length !== expectedVocabularyIds.length || returnedSet.size !== expectedSet.size) {
    return {
      ok: false,
      reason: `vocabulary id count mismatch: expected ${expectedVocabularyIds.length}, got ${vocabulary.length}`,
    };
  }
  for (const id of expectedVocabularyIds) {
    if (!returnedSet.has(id)) {
      return { ok: false, reason: `missing koreanText for vocabulary id: ${id}` };
    }
  }

  const withPositions: ValidatedBackfillVocabularyEntry[] = [];
  for (const v of vocabulary) {
    if (v.koreanText.trim() === '') {
      return { ok: false, reason: `empty koreanText for id "${v.id}"` };
    }

    const inKorean = locateUniqueOccurrence(koreanTranslation, v.koreanText);
    if (inKorean.kind === 'ambiguous') {
      return {
        ok: false,
        reason: `ambiguous koreanText occurrence in koreanTranslation, position unclear: "${v.koreanText}"`,
      };
    }
    const inLuckyItem = locateUniqueOccurrence(luckyItemKo, v.koreanText);
    if (inLuckyItem.kind === 'ambiguous') {
      return {
        ok: false,
        reason: `ambiguous koreanText occurrence in luckyItemKo, position unclear: "${v.koreanText}"`,
      };
    }
    if (inKorean.kind === 'none' && inLuckyItem.kind === 'none') {
      return {
        ok: false,
        reason: `koreanText not found in koreanTranslation or luckyItemKo: "${v.koreanText}"`,
      };
    }

    withPositions.push({
      id: v.id,
      koreanText: v.koreanText,
      koreanStartIndex: inKorean.kind === 'found' ? inKorean.startIndex : null,
      luckyItemKoStartIndex: inLuckyItem.kind === 'found' ? inLuckyItem.startIndex : null,
    });
  }

  const koreanOverlap = findOverlap(
    withPositions
      .filter((v) => v.koreanStartIndex !== null)
      .map((v) => ({ startIndex: v.koreanStartIndex as number, length: v.koreanText.length, label: v.koreanText }))
      .sort((a, b) => a.startIndex - b.startIndex)
  );
  if (koreanOverlap) {
    return {
      ok: false,
      reason: `overlapping koreanText ranges in koreanTranslation: "${koreanOverlap.a}" / "${koreanOverlap.b}"`,
    };
  }

  const luckyItemOverlap = findOverlap(
    withPositions
      .filter((v) => v.luckyItemKoStartIndex !== null)
      .map((v) => ({
        startIndex: v.luckyItemKoStartIndex as number,
        length: v.koreanText.length,
        label: v.koreanText,
      }))
      .sort((a, b) => a.startIndex - b.startIndex)
  );
  if (luckyItemOverlap) {
    return {
      ok: false,
      reason: `overlapping koreanText ranges in luckyItemKo: "${luckyItemOverlap.a}" / "${luckyItemOverlap.b}"`,
    };
  }

  return { ok: true, data: { luckyItemKo, vocabulary: withPositions } };
}
