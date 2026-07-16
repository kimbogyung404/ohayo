import { NextResponse } from 'next/server';
import { generateFortuneStudyData } from '@/lib/ai/gemini';
import { validateAiResult, buildSegments, buildKoreanSegments } from '@/lib/ai/validation';
import { createAdminClient } from '@/lib/supabase/admin';

// M5 일본어 학습 데이터 생성. CRON_SECRET을 검증한 요청만 실행한다.
// M4가 저장한 original_text/lucky_item은 절대 수정하지 않는다.

const DELAY_BETWEEN_CALLS_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface PendingFortune {
  id: string;
  zodiac_id: string;
  rank: number;
  original_text: string;
  lucky_item: string;
  date: string;
}

async function processFortune(
  supabase: ReturnType<typeof createAdminClient>,
  fortune: PendingFortune
): Promise<{ zodiacId: string; rank: number; status: 'success' | 'failed'; reason?: string }> {
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

  // 3. deterministic vocabulary id 3개 생성 (원문 내 등장 순서 기준)
  const vocabWithIds = validation.data.vocabulary.map((v, index) => ({
    vocabularyId: `${fortune.zodiac_id}-${dateNoDash}-${String(index + 1).padStart(2, '0')}`,
    surfaceForm: v.surfaceForm,
    reading: v.reading,
    meaning: v.meaning,
    koreanText: v.koreanText,
    startIndex: v.startIndex,
    koreanStartIndex: v.koreanStartIndex,
    luckyItemKoStartIndex: v.luckyItemKoStartIndex,
  }));

  const { segments, reconstructed } = buildSegments(fortune.original_text, vocabWithIds);
  if (reconstructed !== fortune.original_text) {
    // 이론상 발생하지 않아야 하지만, 방어적으로 실패 처리한다.
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: 'segments reconstruction mismatch' })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason: 'segments reconstruction mismatch' };
  }

  // 3-1. 한국어 세그먼트도 동일하게 결정론적으로 조립하고, 원문(koreanTranslation/
  // luckyItemKo)과 글자 단위로 완전히 일치하는지 다시 확인한다.
  const koreanPlacements = vocabWithIds
    .filter((v) => v.koreanStartIndex !== null)
    .map((v) => ({ vocabularyId: v.vocabularyId, koreanText: v.koreanText, startIndex: v.koreanStartIndex as number }));
  const { segments: koreanSegments, reconstructed: koreanReconstructed } = buildKoreanSegments(
    validation.data.koreanTranslation,
    koreanPlacements
  );
  if (koreanReconstructed !== validation.data.koreanTranslation) {
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: 'koreanSegments reconstruction mismatch' })
      .eq('id', fortune.id);
    return { zodiacId: fortune.zodiac_id, rank: fortune.rank, status: 'failed', reason: 'koreanSegments reconstruction mismatch' };
  }

  const luckyItemKoPlacements = vocabWithIds
    .filter((v) => v.luckyItemKoStartIndex !== null)
    .map((v) => ({
      vocabularyId: v.vocabularyId,
      koreanText: v.koreanText,
      startIndex: v.luckyItemKoStartIndex as number,
    }));
  const { segments: luckyItemKoSegments, reconstructed: luckyItemKoReconstructed } = buildKoreanSegments(
    validation.data.luckyItemKo,
    luckyItemKoPlacements
  );
  if (luckyItemKoReconstructed !== validation.data.luckyItemKo) {
    await supabase
      .from('fortunes')
      .update({ ai_status: 'failed', ai_error_message: 'luckyItemKoSegments reconstruction mismatch' })
      .eq('id', fortune.id);
    return {
      zodiacId: fortune.zodiac_id,
      rank: fortune.rank,
      status: 'failed',
      reason: 'luckyItemKoSegments reconstruction mismatch',
    };
  }

  // 3-2. 핵심 단어 3개가 두 섹션(koreanSegments, luckyItemKoSegments) 중 최소 한 곳에는
  // 실제로 연결됐는지 최종 확인한다(개별 vocab 검증에서 이미 보장되지만 방어적으로 재확인).
  const connectedVocabularyIds = new Set([
    ...koreanPlacements.map((p) => p.vocabularyId),
    ...luckyItemKoPlacements.map((p) => p.vocabularyId),
  ]);
  const unconnected = vocabWithIds.filter((v) => !connectedVocabularyIds.has(v.vocabularyId));
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
  const { error: finalUpdateError } = await supabase
    .from('fortunes')
    .update({
      reading_text: validation.data.readingText,
      korean_translation: validation.data.koreanTranslation,
      segments,
      korean_segments: koreanSegments,
      lucky_item_ko: validation.data.luckyItemKo,
      lucky_item_ko_segments: luckyItemKoSegments,
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

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? getTodayDateString();
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;
  const includeFailed = url.searchParams.get('includeFailed') === 'true';

  const supabase = createAdminClient();

  // 기본은 pending만 처리한다. includeFailed=true일 때만 failed 행도 재처리 대상에 포함한다.
  // success 행은 어떤 경우에도 대상에서 제외한다.
  const statuses = includeFailed ? ['pending', 'failed'] : ['pending'];

  let query = supabase
    .from('fortunes')
    .select('id, zodiac_id, rank, original_text, lucky_item, date')
    .eq('date', date)
    .in('ai_status', statuses)
    .order('rank', { ascending: true });

  if (limit && Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data: pending, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json({ ok: false, error: 'failed to fetch pending fortunes' }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, date, processed: 0, results: [] });
  }

  const results: Awaited<ReturnType<typeof processFortune>>[] = [];

  for (let i = 0; i < pending.length; i++) {
    const result = await processFortune(supabase, pending[i] as PendingFortune);
    results.push(result);

    if (i < pending.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  return NextResponse.json({
    ok: true,
    date,
    processed: results.length,
    results,
  });
}
