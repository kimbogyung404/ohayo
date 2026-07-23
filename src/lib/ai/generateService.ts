import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { KoreanSegment } from '@/types/fortune';
import { generateFortuneStudyData, generateVocabularyRepair } from './gemini';
import {
  validateAiResult,
  buildSegments,
  buildKoreanSegments,
  GeminiCoreSchema,
  VocabularyRepairResponseSchema,
  type KoreanSourceKey,
  type ValidatedAiResult,
} from './validation';

const KOREAN_SOURCE_KEYS: readonly KoreanSourceKey[] = ['main', 'luckyItem', 'love', 'money', 'work'];

// M5 생성 로직의 단일 소스. /api/cron/generate(수동 재실행용)와 /api/cron/daily(자동
// 실행용) 양쪽에서 이 함수 하나만 호출한다. M4가 저장한 original_text/lucky_item/rank는
// 절대 수정하지 않는다 — Gemini는 번역·문장 분리·단어 생성에만 관여한다.

const DELAY_BETWEEN_CALLS_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fortune 1건당 Gemini 호출은 최대 2회로 제한한다: (1) 최초 전체 생성 1회,
// (2) vocabulary만 다시 뽑는 repair 최대 1회. 검증 실패가 vocabulary 배열
// 내용만의 문제(validateAiResult의 repairable: true)일 때만 repair를 시도하고,
// readingText/koreanTranslation/luckyItemKo/detailFortunes 등 core 데이터 자체가
// 잘못된 경우(repairable: false)나 Gemini 호출 자체가 실패한 경우는 곧바로 실패
// 처리한다(전체를 다시 생성하는 재시도는 더 이상 하지 않는다 — Stage 8B-1의
// "전체 재시도" 정책을 이 repair 정책으로 대체한다).
export type GenerateAndValidateOutcome =
  | { ok: true; data: ValidatedAiResult; usedRepair: boolean; totalCalls: number }
  | { ok: false; reason: string; usedRepair: boolean; totalCalls: number };

export async function generateAndValidateWithRetry(
  originalText: string,
  luckyItem: string
): Promise<GenerateAndValidateOutcome> {
  // 1. 최초 전체 생성
  const geminiResult = await generateFortuneStudyData(originalText, luckyItem);
  if (!geminiResult.ok) {
    return { ok: false, reason: geminiResult.errorMessage, usedRepair: false, totalCalls: 1 };
  }

  const initialValidation = validateAiResult(geminiResult.json, originalText);
  if (initialValidation.ok) {
    return { ok: true, data: initialValidation.data, usedRepair: false, totalCalls: 1 };
  }

  if (!initialValidation.repairable) {
    // core 데이터 자체가 잘못됨 — vocabulary repair로 고칠 수 없다. 즉시 실패 처리.
    return { ok: false, reason: initialValidation.reason, usedRepair: false, totalCalls: 1 };
  }

  // 2. vocabulary 전용 repair (최대 1회). core 필드(readingText/koreanTranslation/
  // luckyItemKo/detailFortunes)는 최초 응답에서 이미 검증을 통과했으므로 그대로
  // 재사용하고 절대 다시 만들지 않는다 — GeminiCoreSchema로 안전하게 다시 꺼낸다.
  const coreParsed = GeminiCoreSchema.safeParse(geminiResult.json);
  if (!coreParsed.success) {
    // repairable: true인 경우 core는 항상 파싱에 성공해야 하지만 방어적으로 처리.
    return { ok: false, reason: initialValidation.reason, usedRepair: false, totalCalls: 1 };
  }
  const { readingText, koreanTranslation, luckyItemKo, detailFortunes } = coreParsed.data;

  const originalLines = originalText.split('\n');
  const orderedDetails = (['love', 'money', 'work'] as const).map(
    (category) => detailFortunes.find((d) => d.category === category)!
  );

  const repairResult = await generateVocabularyRepair(originalLines, koreanTranslation, orderedDetails);
  if (!repairResult.ok) {
    return {
      ok: false,
      reason: `initial validation failed (${initialValidation.reason}); repair call failed: ${repairResult.errorMessage}`,
      usedRepair: true,
      totalCalls: 2,
    };
  }

  const repairParsed = VocabularyRepairResponseSchema.safeParse(repairResult.json);
  if (!repairParsed.success) {
    return {
      ok: false,
      reason: `initial validation failed (${initialValidation.reason}); repair response schema invalid: ${repairParsed.error.message.slice(0, 200)}`,
      usedRepair: true,
      totalCalls: 2,
    };
  }

  // 3. 최초 응답의 core 데이터 + repair된 vocabulary를 합쳐 전체 validation을
  // 처음부터 다시 실행한다(detailFortunes는 최초 응답 그대로, 다시 만들지 않음).
  const mergedJson = {
    readingText,
    koreanTranslation,
    luckyItemKo,
    detailFortunes,
    vocabulary: repairParsed.data.vocabulary,
  };

  const finalValidation = validateAiResult(mergedJson, originalText);
  if (!finalValidation.ok) {
    return {
      ok: false,
      reason: `initial validation failed (${initialValidation.reason}); after repair: ${finalValidation.reason}`,
      usedRepair: true,
      totalCalls: 2,
    };
  }

  return { ok: true, data: finalValidation.data, usedRepair: true, totalCalls: 2 };
}

interface PendingFortune {
  id: string;
  zodiac_id: string;
  rank: number;
  original_text: string;
  lucky_item: string;
  date: string;
}

export interface ProcessFortuneResult {
  zodiacId: string;
  rank: number;
  status: 'success' | 'failed';
  reason?: string;
}

async function processFortune(
  supabase: SupabaseClient,
  fortune: PendingFortune
): Promise<ProcessFortuneResult> {
  const dateNoDash = fortune.date.replaceAll('-', '');

  // 1~2. 최초 전체 생성 + 검증, 필요하면 vocabulary만 다시 뽑는 repair 최대 1회
  // (fortune 1건당 Gemini 호출 최대 2회). 이 fortune 행 하나에만 영향을 주며,
  // 같은 배치의 다른 별자리에는 영향을 주지 않는다(processFortune은 항상
  // 별자리 1개 단위로 순차 호출된다).
  const result = await generateAndValidateWithRetry(fortune.original_text, fortune.lucky_item);
  if (!result.ok) {
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: result.reason.slice(0, 300) })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason: result.reason };
  }
  const validation: { ok: true; data: ValidatedAiResult } = { ok: true, data: result.data };

  // 3. deterministic vocabulary id 3개 생성 (원문/세부 운세 내 등장 순서 기준)
  const vocabWithIds = validation.data.vocabulary.map((v, index) => ({
    vocabularyId: `${fortune.zodiac_id}-${dateNoDash}-${String(index + 1).padStart(2, '0')}`,
    surfaceForm: v.surfaceForm,
    reading: v.reading,
    meaning: v.meaning,
    koreanText: v.koreanText,
    difficulty: v.difficulty,
    partOfSpeech: v.partOfSpeech,
    sourceKey: v.sourceKey,
    sourceSentence: v.sourceSentence,
    sourceSentenceReading: v.sourceSentenceReading,
    sourceSentenceTranslation: v.sourceSentenceTranslation,
    originalTextStartIndex: v.originalTextStartIndex,
    koreanPlacements: v.koreanPlacements,
  }));

  // 일본어 segments(비표시용, 무결성 확인 전용)는 원문(main)에 실제로 위치한
  // 단어만 대상으로 한다 — 세부 운세에서 나온 단어는 originalText 기준 위치가 없다.
  const originalAnchoredVocab = vocabWithIds
    .filter((v) => v.sourceKey === 'main' && v.originalTextStartIndex !== null)
    .map((v) => ({
      vocabularyId: v.vocabularyId,
      surfaceForm: v.surfaceForm,
      startIndex: v.originalTextStartIndex as number,
    }));

  const { segments, reconstructed } = buildSegments(fortune.original_text, originalAnchoredVocab);
  if (reconstructed !== fortune.original_text) {
    // 이론상 발생하지 않아야 하지만, 방어적으로 실패 처리한다.
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: 'segments reconstruction mismatch' })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason: 'segments reconstruction mismatch' };
  }

  // 3-1. 한국어 세그먼트도 동일하게 결정론적으로 조립하고, 각 출처 텍스트(본문 번역/
  // 행운 아이템 번역/세부 운세 3종 번역)와 글자 단위로 완전히 일치하는지 다시 확인한다.
  const koreanSourceTexts: Record<KoreanSourceKey, string> = {
    main: validation.data.koreanTranslation,
    luckyItem: validation.data.luckyItemKo,
    love: validation.data.detailFortunes[0].koreanTranslation,
    money: validation.data.detailFortunes[1].koreanTranslation,
    work: validation.data.detailFortunes[2].koreanTranslation,
  };

  const koreanSegmentsBySource: Partial<Record<KoreanSourceKey, KoreanSegment[]>> = {};

  for (const key of KOREAN_SOURCE_KEYS) {
    const sourceText = koreanSourceTexts[key];
    const placements = vocabWithIds
      .filter((v) => v.koreanPlacements[key] !== undefined)
      .map((v) => ({
        vocabularyId: v.vocabularyId,
        koreanText: v.koreanText,
        startIndex: v.koreanPlacements[key] as number,
      }));
    const { segments: builtSegments, reconstructed: builtReconstructed } = buildKoreanSegments(sourceText, placements);
    if (builtReconstructed !== sourceText) {
      const reason = `${key} segments reconstruction mismatch`;
      await supabase.from('fortunes').update({ ai_status: 'failed', ai_error_message: reason }).eq('id', fortune.id);
      return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason };
    }
    koreanSegmentsBySource[key] = builtSegments;
  }

  // 3-2. 핵심 단어 3개가 5개 한국어 출처 중 최소 한 곳에는 실제로 연결됐는지 최종
  // 확인한다(개별 vocab 검증에서 이미 보장되지만 방어적으로 재확인).
  const unconnected = vocabWithIds.filter((v) => Object.keys(v.koreanPlacements).length === 0);
  if (unconnected.length > 0) {
    const reason = `vocabulary not connected to any Korean segment: ${unconnected.map((v) => v.surfaceForm).join(', ')}`;
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: reason.slice(0, 300) })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason };
  }

  const vocabularyIds = vocabWithIds.map((v) => v.vocabularyId);

  // 4. vocabulary 3개를 동일 ID 기준으로 upsert
  const { error: upsertError } = await supabase.from('vocabulary').upsert(
    vocabWithIds.map((v) => ({
      id: v.vocabularyId,
      fortune_id: fortune.id,
      word: v.surfaceForm, // word도 surfaceForm과 동일한 원문 표기를 저장한다 (사전형 미사용)
      surface_form: v.surfaceForm,
      reading: v.reading,
      meaning: v.meaning,
      difficulty: v.difficulty,
      part_of_speech: v.partOfSpeech,
      source_key: v.sourceKey,
      source_sentence: v.sourceSentence,
      source_sentence_reading: v.sourceSentenceReading,
      source_sentence_translation: v.sourceSentenceTranslation,
    })),
    { onConflict: 'id' }
  );

  if (upsertError) {
    const reason = `vocabulary upsert failed: ${upsertError.message.slice(0, 200)}`;
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: reason.slice(0, 300) })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason };
  }

  // 5. 실제로 해당 fortune_id에 3개가 저장되었는지 재조회
  const { data: savedVocab, error: recheckError } = await supabase
    .from('vocabulary')
    .select('id')
    .in('id', vocabularyIds);

  if (recheckError || !savedVocab || savedVocab.length !== 3) {
    const reason = recheckError
      ? `vocabulary recheck failed: ${recheckError.message.slice(0, 200)}`
      : `vocabulary recheck incomplete: ${savedVocab?.length ?? 0}/3`;

    // 이번 처리에서 생성한 해당 fortune_id의 vocabulary만 정리한다.
    await supabase.from('vocabulary').delete().eq('fortune_id', fortune.id).in('id', vocabularyIds);

    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: reason.slice(0, 300) })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason };
  }

  // 6. 검증된 경우에만 fortunes를 최종 업데이트한다.
  const detailFortunesForDb = (['love', 'money', 'work'] as const).map((category, index) => ({
    category,
    japaneseText: validation.data.detailFortunes[index].japaneseText,
    koreanTranslation: validation.data.detailFortunes[index].koreanTranslation,
    koreanSegments: koreanSegmentsBySource[category]!,
  }));

  const { error: finalUpdateError } = await supabase
    .from('fortunes')
    .update({
      reading_text: validation.data.readingText,
      korean_translation: validation.data.koreanTranslation,
      segments,
      korean_segments: koreanSegmentsBySource.main!,
      lucky_item_ko: validation.data.luckyItemKo,
      lucky_item_ko_segments: koreanSegmentsBySource.luckyItem!,
      detail_fortunes: detailFortunesForDb,
      ai_status: 'success',
      ai_error_message: null,
    })
    .eq('id', fortune.id);

  if (finalUpdateError) {
    // 최종 업데이트 실패: 이번에 만든 vocabulary 3개만 정리하고, 다른 운세는 건드리지 않는다.
    await supabase.from('vocabulary').delete().eq('fortune_id', fortune.id).in('id', vocabularyIds);

    const reason = `fortunes final update failed: ${finalUpdateError.message.slice(0, 200)}`;
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: reason.slice(0, 300) })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason };
  }

  return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'success' };
}

export interface GenerateStepResult {
  ok: boolean;
  date: string;
  processed: number;
  succeeded: number;
  failed: number;
  results: ProcessFortuneResult[];
  errorReason?: string;
}

// date의 ai_status='pending'(옵션으로 'failed' 포함) 운세만 골라 Gemini 처리한다.
// 이미 success인 행은 절대 대상에 포함하지 않는다 — 같은 날짜를 여러 번 실행해도
// 이미 성공한 운세는 재생성되지 않는다(idempotent).
export async function runGenerateForDate(
  supabase: SupabaseClient,
  date: string,
  options?: { includeFailed?: boolean; limit?: number }
): Promise<GenerateStepResult> {
  const statuses = options?.includeFailed ? ['pending', 'failed'] : ['pending'];

  let query = supabase
    .from('fortunes')
    .select('id, zodiac_id, rank, original_text, lucky_item, date')
    .eq('date', date)
    .in('ai_status', statuses)
    .order('rank', { ascending: true });

  if (options?.limit && Number.isInteger(options.limit) && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data: pending, error: fetchError } = await query;

  if (fetchError) {
    return { ok: false, date, processed: 0, succeeded: 0, failed: 0, results: [], errorReason: 'failed to fetch pending fortunes' };
  }

  if (!pending || pending.length === 0) {
    return { ok: true, date, processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  const results: ProcessFortuneResult[] = [];

  for (let i = 0; i < pending.length; i++) {
    const result = await processFortune(supabase, pending[i] as PendingFortune);
    results.push(result);

    if (i < pending.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  const succeeded = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  return { ok: true, date, processed: results.length, succeeded, failed, results };
}
