import { z } from 'zod';
import type { Segment } from '@/types/fortune';

// Gemini에게는 "원문 표기(surfaceForm)"만 요청한다.
// 사전형(word) 필드는 별도로 요청하지 않는다 — word는 항상 surfaceForm과 동일한 값을 저장한다
// (원문에 없는 활용 전 기본형이 임의로 저장되는 것을 원천 차단하기 위함).
const GeminiVocabularySchema = z.object({
  surfaceForm: z.string(),
  reading: z.string(),
  meaning: z.string(),
});

export const GeminiOutputSchema = z.object({
  readingText: z.string(),
  koreanTranslation: z.string(),
  vocabulary: z.array(GeminiVocabularySchema).length(3),
});

export type GeminiOutput = z.infer<typeof GeminiOutputSchema>;

export interface ValidatedVocabularyEntry {
  surfaceForm: string;
  reading: string;
  meaning: string;
  startIndex: number;
}

export interface ValidatedAiResult {
  readingText: string;
  koreanTranslation: string;
  vocabulary: ValidatedVocabularyEntry[]; // startIndex 오름차순 정렬됨
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

// Gemini 원본 JSON + original_text를 받아 스키마/비즈니스 규칙을 모두 검증한다.
// 하나라도 실패하면 전체를 실패로 처리한다(부분 통과 없음).
export function validateAiResult(json: unknown, originalText: string): AiValidationResult {
  const parsed = GeminiOutputSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message.slice(0, 200)}` };
  }

  const { readingText, koreanTranslation, vocabulary } = parsed.data;

  if (readingText.trim() === '') {
    return { ok: false, reason: 'readingText is empty' };
  }
  if (koreanTranslation.trim() === '') {
    return { ok: false, reason: 'koreanTranslation is empty' };
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
    withPositions.push({
      surfaceForm: v.surfaceForm,
      reading: v.reading,
      meaning: v.meaning,
      startIndex,
    });
  }

  withPositions.sort((a, b) => a.startIndex - b.startIndex);

  // 겹치는 범위 거부
  for (let i = 0; i < withPositions.length - 1; i++) {
    const current = withPositions[i];
    const next = withPositions[i + 1];
    const currentEnd = current.startIndex + current.surfaceForm.length;
    if (currentEnd > next.startIndex) {
      return {
        ok: false,
        reason: `overlapping vocabulary ranges: "${current.surfaceForm}" / "${next.surfaceForm}"`,
      };
    }
  }

  return {
    ok: true,
    data: { readingText, koreanTranslation, vocabulary: withPositions },
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
