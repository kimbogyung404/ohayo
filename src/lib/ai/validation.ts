import { z } from 'zod';
import type { FortuneDetailCategory, KoreanSegment, Segment } from '@/types/fortune';

// Gemini에게는 "원문 표기(surfaceForm)"만 요청한다.
// 사전형(word) 필드는 별도로 요청하지 않는다 — word는 항상 surfaceForm과 동일한 값을 저장한다
// (원문에 없는 활용 전 기본형이 임의로 저장되는 것을 원천 차단하기 위함).
// koreanText는 meaning(사전형/의역)과 달리 koreanTranslation 또는 luckyItemKo 안에
// 실제로 등장하는 활용형이어야 한다 — 아래 검증에서 문자열 존재 여부를 직접 확인한다.
// difficulty는 Gemini가 스스로 선정한 난이도 태그다(외부 JLPT 공식 판정이 아니다).
//
// partOfSpeech/sourceSentenceReading/sourceSentenceTranslation은 카드 뒷면(등장 문장)
// 표시용이다. sourceKey/sourceSentence(문장 전체 문자열)는 Gemini에게 요청하지
// 않는다 — Gemini가 이미 생성한 신뢰 텍스트(원문 줄들 + detailFortunes 3종)를 놔두고
// 그 문자열을 다시 그대로 베껴 쓰게 하면(예전 방식) 베끼는 과정에서 오탈자·불일치가
// 생겨 "실제로는 존재하는 문장인데 복사가 틀려서 검증 실패" 같은 사고가 났다.
// 대신 아주 짧은 라벨인 sourceId("main_1"/"main_2"/"main_3"/"love"/"money"/"work")만
// 요청하고, validation.ts가 그 라벨이 가리키는 실제 문장을 코드로 직접 조회해
// sourceKey/sourceSentence를 확정한다. 같은 surfaceForm이 다른 출처에도 등장하는
// 것은 허용된다 — sourceId로 이미 명시적으로 지정하므로 교차 출처 모호성 자체가
// 발생하지 않는다(이전에 시도했던 "여러 출처에 등장 시 실패/무작위 선택" 방식은
// 재현성이 없어 폐기했다).
const PartOfSpeechSchema = z.enum(['noun', 'verb', 'adjective', 'expression']);

const GeminiVocabularySchema = z.object({
  surfaceForm: z.string(),
  reading: z.string(),
  meaning: z.string(),
  koreanText: z.string(),
  difficulty: z.enum(['easy', 'challenge']),
  partOfSpeech: PartOfSpeechSchema,
  sourceId: z.string(),
  sourceSentenceReading: z.string(),
  sourceSentenceTranslation: z.string(),
});

// 공식 소스에는 없는 세부 운세 3종(연애/금전/일·학업). original_text를 근거로 M5가
// 새로 생성하며, category는 love/money/work 중 하나씩 정확히 한 번 등장해야 한다.
const DetailFortuneCategorySchema = z.enum(['love', 'money', 'work']);

const GeminiDetailFortuneSchema = z.object({
  category: DetailFortuneCategorySchema,
  japaneseText: z.string(),
  koreanTranslation: z.string(),
});

export const GeminiOutputSchema = z.object({
  readingText: z.string(),
  koreanTranslation: z.string(),
  luckyItemKo: z.string(),
  detailFortunes: z.array(GeminiDetailFortuneSchema).length(3),
  vocabulary: z.array(GeminiVocabularySchema).length(3),
});

export type GeminiOutput = z.infer<typeof GeminiOutputSchema>;

// vocabulary를 제외한 나머지("core") 필드만 검증하는 스키마. vocabulary repair
// 흐름에서, 최초 응답이 vocabulary 문제로만 실패했을 때 readingText/koreanTranslation/
// luckyItemKo/detailFortunes를 안전하게 다시 꺼내기 위해 쓴다(vocabulary 필드가
// 스키마에 없으므로 vocabulary 쪽 문제와 무관하게 항상 파싱에 성공한다).
export const GeminiCoreSchema = z.object({
  readingText: z.string(),
  koreanTranslation: z.string(),
  luckyItemKo: z.string(),
  detailFortunes: z.array(GeminiDetailFortuneSchema).length(3),
});

// vocabulary repair 호출 전용 응답 스키마. sourceKey/sourceSentence는 여기서도
// 요청하지 않는다(코드가 계산).
export const VocabularyRepairResponseSchema = z.object({
  vocabulary: z.array(GeminiVocabularySchema).length(3),
});

// vocabulary가 실제로 등장한 문장의 출처. 행운 아이템(lucky_item)은 문장이 아니라
// 짧은 명사/장소라 후보에서 제외한다.
export type VocabularySourceKey = 'main' | FortuneDetailCategory;
// vocabulary의 한국어 연결 대상(하이라이트 매칭용, 위 VocabularySourceKey와는 별개의
// 기존 로직): 본문 번역(main), 행운 아이템 번역(luckyItem), 세부 운세 3종의 번역 중
// 하나 이상.
export type KoreanSourceKey = 'main' | 'luckyItem' | FortuneDetailCategory;

export interface ValidatedDetailFortuneEntry {
  category: FortuneDetailCategory;
  japaneseText: string;
  koreanTranslation: string;
}

export interface ValidatedVocabularyEntry {
  surfaceForm: string;
  reading: string;
  meaning: string;
  koreanText: string;
  difficulty: 'easy' | 'challenge';
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'expression';
  sourceKey: VocabularySourceKey;
  sourceSentence: string;
  sourceSentenceReading: string;
  sourceSentenceTranslation: string;
  // sourceKey==='main'일 때만 채워진다(원문 전체 기준 절대 위치). 세부 운세 유래
  // 단어는 원문 위치 개념이 없어 null — fortunes.segments(원문 전용, 비표시용
  // 무결성 확인) 대상에서 제외하기 위해 사용한다.
  originalTextStartIndex: number | null;
  koreanPlacements: Partial<Record<KoreanSourceKey, number>>;  // 등장이 확인된 한국어 텍스트별 위치
}

export interface ValidatedAiResult {
  readingText: string;
  koreanTranslation: string;
  luckyItemKo: string;
  detailFortunes: ValidatedDetailFortuneEntry[]; // 항상 [love, money, work] 고정 순서
  vocabulary: ValidatedVocabularyEntry[];
}

// repairable=true는 "vocabulary 배열 내용만 문제"인 실패로, vocabulary 전용 repair
// 호출(gemini.ts의 generateVocabularyRepair)로 고칠 여지가 있다는 뜻이다. false는
// readingText/koreanTranslation/luckyItemKo/detailFortunes 등 vocabulary와 무관한
// 핵심 데이터 자체가 잘못된 경우로, repair로 해결할 수 없어 전체 생성을 실패 처리한다.
export type AiValidationResult =
  | { ok: true; data: ValidatedAiResult }
  | { ok: false; reason: string; repairable: boolean };

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

// Gemini가 지정한 sourceId("main_1"/"main_2"/.../"love"/"money"/"work")가 유효한
// 라벨인지 확인하고, 유효하다면 그 라벨이 가리키는 실제 문장(sourceKey/sourceSentence/
// lineIndex)을 코드가 직접 조회해 반환한다. 원문 줄 개수(대부분 3줄이지만 고정은
// 아님)를 기준으로 유효한 main_N 범위를 그때그때 계산한다. 텍스트를 검색해 후보를
// 추측하지 않는다 — sourceId를 Gemini가 이미 명시했으므로 조회만 하면 된다. 같은
// surfaceForm이 다른 출처에도 등장할 수 있다는 사실은 여기서 전혀 문제가 되지
// 않는다(sourceId가 어느 한 곳을 명확히 지정하기 때문). 동일한 입력(Gemini 응답)에
// 대해 항상 동일한 결과를 반환하는 결정적(deterministic) 함수다 — 무작위성 없음.
function resolveSourceId(
  originalLines: string[],
  detailJapaneseTextByCategory: Record<FortuneDetailCategory, string>,
  sourceId: string
): { kind: 'valid'; sourceKey: VocabularySourceKey; sentence: string; lineIndex: number | null } | { kind: 'invalid' } {
  const mainMatch = /^main_(\d+)$/.exec(sourceId);
  if (mainMatch) {
    const lineIndex = Number(mainMatch[1]) - 1;
    if (lineIndex < 0 || lineIndex >= originalLines.length) return { kind: 'invalid' };
    return { kind: 'valid', sourceKey: 'main', sentence: originalLines[lineIndex], lineIndex };
  }
  if (sourceId === 'love' || sourceId === 'money' || sourceId === 'work') {
    return { kind: 'valid', sourceKey: sourceId, sentence: detailJapaneseTextByCategory[sourceId], lineIndex: null };
  }
  return { kind: 'invalid' };
}

// Gemini 원본 JSON + original_text를 받아 스키마/비즈니스 규칙을 모두 검증한다.
// 하나라도 실패하면 전체를 실패로 처리한다(부분 통과 없음).
//
// vocabulary의 sourceKey/sourceSentence는 Gemini가 지정하지 않는다 — Gemini는 짧은
// 라벨인 sourceId만 지정하고, 코드가 resolveSourceId로 그 라벨이 가리키는 실제 문장
// (원문 줄들 + detailFortunes 3종의 japaneseText 중 하나, 이미 이번 호출에서 생성된
// 신뢰 가능한 원본 텍스트)을 조회해 결정한다. 그 결과에 따라 sourceSentenceReading/
// sourceSentenceTranslation 중 코드가 독립적으로 재구성 가능한 쪽을 덮어쓴다:
//   - sourceKey === 'main'  → sourceSentenceReading은 readingText의 같은 줄에서
//     그대로 가져온다(이미 줄 수가 원문과 일치함이 검증되어 있어 100% 신뢰 가능).
//     sourceSentenceTranslation은 문장 단위 번역이 별도로 존재하지 않아 Gemini
//     값을 그대로 쓴다.
//   - sourceKey ∈ {love, money, work} → sourceSentenceTranslation은 이미 검증된
//     detailFortunes[category].koreanTranslation을 그대로 가져온다(100% 신뢰 가능).
//     sourceSentenceReading은 문장 단위 읽는 법이 별도로 존재하지 않아 Gemini
//     값을 그대로 쓴다.
// 즉 단어마다 reading/translation 중 하나는 항상 코드가 보장하고, 나머지 하나만
// Gemini를 신뢰한다 — 완전히 임의로 지어낸 문장을 저장할 위험을 구조적으로 줄인다.
// koreanText는 koreanTranslation/luckyItemKo/세부 운세 3종의 koreanTranslation 총
// 5개 텍스트 중 하나 이상에서 등장해야 한다(기존 로직 그대로 유지).
export function validateAiResult(json: unknown, originalText: string): AiValidationResult {
  const parsed = GeminiOutputSchema.safeParse(json);
  if (!parsed.success) {
    // 스키마 실패가 전부 vocabulary 경로에서만 났다면(예: 배열 길이가 3이 아님,
    // vocabulary 항목에 필수 필드 누락/잘못된 enum 값) vocabulary repair로 고칠 수
    // 있는 문제로 본다. readingText 등 다른 필드도 함께 깨졌다면 repair 대상이 아니다.
    const allIssuesAreVocabulary =
      parsed.error.issues.length > 0 && parsed.error.issues.every((issue) => issue.path[0] === 'vocabulary');
    return {
      ok: false,
      reason: `schema validation failed: ${parsed.error.message.slice(0, 200)}`,
      repairable: allIssuesAreVocabulary,
    };
  }

  const { readingText, koreanTranslation, luckyItemKo, detailFortunes, vocabulary } = parsed.data;

  // ── 아래부터 detailFortunes 검증까지는 전부 vocabulary와 무관한 "core" 데이터
  // 실패다. repair로 고칠 수 없으므로 전부 repairable: false. ──
  if (readingText.trim() === '') {
    return { ok: false, reason: 'readingText is empty', repairable: false };
  }
  if (koreanTranslation.trim() === '') {
    return { ok: false, reason: 'koreanTranslation is empty', repairable: false };
  }
  if (luckyItemKo.trim() === '') {
    return { ok: false, reason: 'luckyItemKo is empty', repairable: false };
  }

  // 읽는 법은 원문과 같은 줄 구조(줄 수)를 유지해야 한다.
  const originalLineCount = originalText.split('\n').length;
  const readingLineCount = readingText.split('\n').length;
  if (originalLineCount !== readingLineCount) {
    return {
      ok: false,
      reason: `line count mismatch: original=${originalLineCount}, reading=${readingLineCount}`,
      repairable: false,
    };
  }

  // detailFortunes: love/money/work가 각각 정확히 한 번씩 있어야 한다.
  const categories = detailFortunes.map((d) => d.category);
  if (new Set(categories).size !== 3) {
    return {
      ok: false,
      reason: `detailFortunes categories must be love/money/work exactly once each, got: ${categories.join(',')}`,
      repairable: false,
    };
  }
  for (const d of detailFortunes) {
    if (d.japaneseText.trim() === '') {
      return { ok: false, reason: `detailFortunes[${d.category}].japaneseText is empty`, repairable: false };
    }
    if (d.koreanTranslation.trim() === '') {
      return { ok: false, reason: `detailFortunes[${d.category}].koreanTranslation is empty`, repairable: false };
    }
  }
  // 이후 고정 순서(love, money, work)로 다룬다 — DB/프론트가 항상 이 순서를 기대한다.
  const orderedDetails = (['love', 'money', 'work'] as const).map(
    (category) => detailFortunes.find((d) => d.category === category)!
  );

  // sourceId별로 신뢰할 수 있는 "실제 출처 텍스트". main_N은 원문의 줄 목록, 나머지는
  // 방금 생성한 detailFortunes의 japaneseText/koreanTranslation(이미 위에서 빈 문자열
  // 아님이 검증됨). resolveSourceId가 이 텍스트들만 조회하므로 Gemini가 지어낸 문장은
  // 애초에 결과가 될 수 없다.
  const originalLines = originalText.split('\n');
  const readingLines = readingText.split('\n'); // 위에서 originalLines와 줄 수가 같음이 이미 검증됨
  const detailJapaneseTextByCategory: Record<FortuneDetailCategory, string> = {
    love: orderedDetails[0].japaneseText,
    money: orderedDetails[1].japaneseText,
    work: orderedDetails[2].japaneseText,
  };
  const detailKoreanTranslationByCategory: Record<FortuneDetailCategory, string> = {
    love: orderedDetails[0].koreanTranslation,
    money: orderedDetails[1].koreanTranslation,
    work: orderedDetails[2].koreanTranslation,
  };

  // vocabulary의 한국어 검색 풀(하이라이트 매칭용, 기존 로직 그대로): 본문 번역 +
  // 행운 아이템 번역 + 세부 운세 3종 번역.
  const koreanSources: { key: KoreanSourceKey; text: string }[] = [
    { key: 'main', text: koreanTranslation },
    { key: 'luckyItem', text: luckyItemKo },
    { key: 'love', text: orderedDetails[0].koreanTranslation },
    { key: 'money', text: orderedDetails[1].koreanTranslation },
    { key: 'work', text: orderedDetails[2].koreanTranslation },
  ];

  // ── 여기서부터 끝까지는 전부 vocabulary 배열 내용에 관한 검증이다. 실패하면
  // 전부 repairable: true — vocabulary 전용 repair 호출로 고칠 여지가 있다. ──

  // 3개 surfaceForm이 서로 달라야 한다.
  const surfaceForms = vocabulary.map((v) => v.surfaceForm);
  if (new Set(surfaceForms).size !== 3) {
    return { ok: false, reason: 'duplicate surfaceForm detected', repairable: true };
  }

  // 난이도 구성: 쉬운 단어 2개 + 도전 단어 1개.
  const easyCount = vocabulary.filter((v) => v.difficulty === 'easy').length;
  const challengeCount = vocabulary.filter((v) => v.difficulty === 'challenge').length;
  if (easyCount !== 2 || challengeCount !== 1) {
    return {
      ok: false,
      reason: `vocabulary difficulty mix must be 2 easy + 1 challenge, got ${easyCount} easy / ${challengeCount} challenge`,
      repairable: true,
    };
  }

  const withPositions: ValidatedVocabularyEntry[] = [];

  for (const v of vocabulary) {
    if (v.surfaceForm.trim() === '') {
      return { ok: false, reason: 'empty surfaceForm', repairable: true };
    }
    if (v.reading.trim() === '') {
      return { ok: false, reason: `empty reading for surfaceForm "${v.surfaceForm}"`, repairable: true };
    }
    if (v.meaning.trim() === '') {
      return { ok: false, reason: `empty meaning for surfaceForm "${v.surfaceForm}"`, repairable: true };
    }
    if (v.koreanText.trim() === '') {
      return { ok: false, reason: `empty koreanText for surfaceForm "${v.surfaceForm}"`, repairable: true };
    }
    if (v.sourceSentenceReading.trim() === '') {
      return { ok: false, reason: `empty sourceSentenceReading for surfaceForm "${v.surfaceForm}"`, repairable: true };
    }
    if (v.sourceSentenceTranslation.trim() === '') {
      return {
        ok: false,
        reason: `empty sourceSentenceTranslation for surfaceForm "${v.surfaceForm}"`,
        repairable: true,
      };
    }

    // Gemini가 지정한 sourceId가 유효한 라벨인지 확인하고, 유효하다면 그 라벨이
    // 가리키는 실제 문장을 코드가 조회한다(텍스트 검색으로 추측하지 않음 — 결정적).
    const resolved = resolveSourceId(originalLines, detailJapaneseTextByCategory, v.sourceId);
    if (resolved.kind === 'invalid') {
      return {
        ok: false,
        reason: `invalid sourceId "${v.sourceId}" for surfaceForm "${v.surfaceForm}" (expected main_1..main_${originalLines.length} or love/money/work)`,
        repairable: true,
      };
    }
    const { sourceKey, sentence: sourceSentence, lineIndex } = resolved;

    // surfaceForm은 sourceId가 가리키는 그 문장 안에서 정확히 한 번만 등장해야
    // 한다. 같은 surfaceForm이 다른 출처 문장에도 등장하는지는 더 이상 확인하지
    // 않는다(허용됨) — sourceId가 이미 명확히 어느 문장인지 지정했기 때문이다.
    const occurrencesInSourceSentence = countOccurrences(sourceSentence, v.surfaceForm);
    if (occurrencesInSourceSentence === 0) {
      return {
        ok: false,
        reason: `surfaceForm not found in the sentence indicated by sourceId "${v.sourceId}": "${v.surfaceForm}"`,
        repairable: true,
      };
    }
    if (occurrencesInSourceSentence > 1) {
      return {
        ok: false,
        reason: `surfaceForm occurs multiple times within the sentence indicated by sourceId "${v.sourceId}", position unclear: "${v.surfaceForm}"`,
        repairable: true,
      };
    }

    // reading/translation 중 코드가 독립적으로 재구성 가능한 쪽을 덮어써 Gemini
    // 신뢰 범위를 절반으로 줄인다(위 validateAiResult 상단 주석 참고).
    let sourceSentenceReading: string;
    let sourceSentenceTranslation: string;
    let originalTextStartIndex: number | null = null;

    if (sourceKey === 'main') {
      const derivedReading = readingLines[lineIndex as number];
      if (!derivedReading || derivedReading.trim() === '') {
        return {
          ok: false,
          reason: `derived sourceSentenceReading (readingText line ${lineIndex}) is empty for surfaceForm "${v.surfaceForm}"`,
          repairable: true,
        };
      }
      sourceSentenceReading = derivedReading;
      sourceSentenceTranslation = v.sourceSentenceTranslation; // 문장 단위 번역 소스가 없어 Gemini 값 유지

      // fortunes.segments(원문 전용, 비표시용 무결성 확인)용 절대 위치.
      const lineOccurrences = countOccurrences(originalText, sourceSentence);
      if (lineOccurrences !== 1) {
        return {
          ok: false,
          reason: `matched original-text line is not uniquely locatable in original text for surfaceForm "${v.surfaceForm}"`,
          repairable: true,
        };
      }
      const lineStart = originalText.indexOf(sourceSentence);
      const withinSentenceIndex = sourceSentence.indexOf(v.surfaceForm);
      originalTextStartIndex = lineStart + withinSentenceIndex;
    } else {
      sourceSentenceReading = v.sourceSentenceReading; // 문장 단위 읽는 법 소스가 없어 Gemini 값 유지
      sourceSentenceTranslation = detailKoreanTranslationByCategory[sourceKey];
      originalTextStartIndex = null;
    }

    // 읽는 법과 번역이 뒤바뀌는 사고를 최소한으로 막는다(완전 자동 판정은 하지 않는다).
    // 최종 확정값(코드가 덮어쓴 값 포함) 기준으로 확인한다.
    if (sourceSentenceReading === sourceSentenceTranslation) {
      return {
        ok: false,
        reason: `sourceSentenceReading and sourceSentenceTranslation must not be identical for surfaceForm "${v.surfaceForm}" (likely swapped)`,
        repairable: true,
      };
    }

    // koreanText는 5개 한국어 소스 중 하나 이상에 정확히 한 번씩 등장해야 한다(기존
    // 로직 그대로). 등장이 확인된 곳은 전부 기록한다(여러 섹션에서 동시에 핫스팟이
    // 될 수 있다).
    const koreanPlacements: Partial<Record<KoreanSourceKey, number>> = {};
    for (const src of koreanSources) {
      const located = locateUniqueOccurrence(src.text, v.koreanText);
      if (located.kind === 'ambiguous') {
        return {
          ok: false,
          reason: `ambiguous koreanText occurrence in ${src.key}, position unclear: "${v.koreanText}"`,
          repairable: true,
        };
      }
      if (located.kind === 'found') {
        koreanPlacements[src.key] = located.startIndex;
      }
    }
    if (Object.keys(koreanPlacements).length === 0) {
      return {
        ok: false,
        reason: `koreanText not found in any Korean text (main/luckyItem/love/money/work): "${v.koreanText}"`,
        repairable: true,
      };
    }

    withPositions.push({
      surfaceForm: v.surfaceForm,
      reading: v.reading,
      meaning: v.meaning,
      koreanText: v.koreanText,
      difficulty: v.difficulty,
      partOfSpeech: v.partOfSpeech,
      sourceKey,
      sourceSentence,
      sourceSentenceReading,
      sourceSentenceTranslation,
      originalTextStartIndex,
      koreanPlacements,
    });
  }

  // 겹치는 범위 거부 (같은 sourceSentence를 공유하는 단어끼리만 비교 — 문장이 다르면
  // 애초에 위치를 비교할 이유가 없다). 3개 단어가 우연히 같은 한 줄짜리 문장을
  // 공유하는 경우에도 서로 다른 부분 문자열을 가리키는지 방어적으로 확인한다.
  const bySentence = new Map<string, ValidatedVocabularyEntry[]>();
  for (const v of withPositions) {
    const list = bySentence.get(v.sourceSentence) ?? [];
    list.push(v);
    bySentence.set(v.sourceSentence, list);
  }
  for (const entries of bySentence.values()) {
    if (entries.length < 2) continue;
    const itemsInSentence = entries
      .map((v) => ({
        startIndex: v.sourceSentence.indexOf(v.surfaceForm),
        length: v.surfaceForm.length,
        label: v.surfaceForm,
      }))
      .sort((a, b) => a.startIndex - b.startIndex);
    const overlap = findOverlap(itemsInSentence);
    if (overlap) {
      return {
        ok: false,
        reason: `overlapping vocabulary ranges in the same sourceSentence: "${overlap.a}" / "${overlap.b}"`,
        repairable: true,
      };
    }
  }

  // 겹치는 범위 거부 (한국어 소스별로 그룹화, 기존 로직 그대로)
  for (const src of koreanSources) {
    const itemsInSource = withPositions
      .filter((v) => v.koreanPlacements[src.key] !== undefined)
      .map((v) => ({
        startIndex: v.koreanPlacements[src.key] as number,
        length: v.koreanText.length,
        label: v.koreanText,
      }))
      .sort((a, b) => a.startIndex - b.startIndex);
    const overlap = findOverlap(itemsInSource);
    if (overlap) {
      return {
        ok: false,
        reason: `overlapping koreanText ranges in ${src.key}: "${overlap.a}" / "${overlap.b}"`,
        repairable: true,
      };
    }
  }

  return {
    ok: true,
    data: {
      readingText,
      koreanTranslation,
      luckyItemKo,
      detailFortunes: orderedDetails,
      vocabulary: withPositions,
    },
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
