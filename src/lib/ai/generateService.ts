import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { KoreanSegment } from '@/types/fortune';
import { generateFortuneStudyData } from './gemini';
import { validateAiResult, buildSegments, buildKoreanSegments, type KoreanSourceKey } from './validation';

const KOREAN_SOURCE_KEYS: readonly KoreanSourceKey[] = ['main', 'luckyItem', 'love', 'money', 'work'];

// M5 생성 로직의 단일 소스. /api/cron/generate(수동 재실행용)와 /api/cron/daily(자동
// 실행용) 양쪽에서 이 함수 하나만 호출한다. M4가 저장한 original_text/lucky_item/rank는
// 절대 수정하지 않는다 — Gemini는 번역·문장 분리·단어 생성에만 관여한다.

const DELAY_BETWEEN_CALLS_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // 1. Gemini 응답 생성
  const geminiResult = await generateFortuneStudyData(fortune.original_text, fortune.lucky_item);
  if (!geminiResult.ok) {
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: geminiResult.errorMessage.slice(0, 300) })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason: geminiResult.errorMessage };
  }

  // 2. Zod + 원문 일치 검증
  const validation = validateAiResult(geminiResult.json, fortune.original_text);
  if (!validation.ok) {
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: validation.reason.slice(0, 300) })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason: validation.reason };
  }

  // 3. deterministic vocabulary id 3개 생성 (원문/세부 운세 내 등장 순서 기준)
  const vocabWithIds = validation.data.vocabulary.map((v, index) => ({
    vocabularyId: `${fortune.zodiac_id}-${dateNoDash}-${String(index + 1).padStart(2, '0')}`,
    surfaceForm: v.surfaceForm,
    reading: v.reading,
    meaning: v.meaning,
    koreanText: v.koreanText,
    difficulty: v.difficulty,
    japaneseSourceKey: v.japaneseSourceKey,
    startIndex: v.startIndex,
    koreanPlacements: v.koreanPlacements,
  }));

  // 일본어 segments(비표시용, 무결성 확인 전용)는 원문(original)에 실제로 위치한
  // 단어만 대상으로 한다 — 세부 운세에서 나온 단어는 originalText 기준 위치가 없다.
  const originalAnchoredVocab = vocabWithIds
    .filter((v) => v.japaneseSourceKey === 'original')
    .map((v) => ({ vocabularyId: v.vocabularyId, surfaceForm: v.surfaceForm, startIndex: v.startIndex }));

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
