import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { collectHoroscope } from './ohaasa';
import type { ValidatedFortuneEntry } from './validation';
import { generateFallbackFortunes } from '@/lib/ai/fallbackFortune';
import { getKstDateString } from '@/lib/date/kst';

// M4 수집 로직의 단일 소스. /api/cron/collect(수동 재실행용)와 /api/cron/daily(자동
// 실행용) 양쪽에서 이 함수 하나만 호출한다 — DB 저장 규칙(중복 방지, 부분 데이터 거부 등)을
// 두 곳에 따로 구현하지 않기 위함이다.
//
// 정책(2026-08 개정): "공식 데이터가 없으면 어제 데이터를 유지한다"는 더 이상 쓰지
// 않는다. 매일 오늘 날짜의 운세 12개가 반드시 존재해야 하며, 공식 데이터가 없으면
// (수집 실패, 아직 게시 안 됨, 일요일 등 이유 불문) Gemini로 오늘 전용 운세를 새로
// 만든다(ai_fallback). 공식 데이터인 것처럼 저장하지 않는다.

type FortuneSourceType = 'official' | 'ai_fallback';

function determineSourceType(dateStr: string): 'weekday' | 'weekend' {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

function isFutureDate(dateStr: string, todayKst: string): boolean {
  return dateStr > todayKst;
}

export interface CollectStepResult {
  ok: boolean;
  date: string; // 확정된 날짜(정상 처리 시) 또는 대상 날짜(에러/스킵 시)
  skipped: boolean;
  skipReason?: 'not_updated_yet' | 'already_complete';
  sourceDate?: string; // not_updated_yet일 때, 공식 사이트가 실제로 반환한 날짜
  sourceType?: FortuneSourceType; // 정상 처리 시 실제로 사용된 출처
  count?: number;
  errorReason?: string;
}

interface ExistingFortuneRow {
  id: string;
  source_type: FortuneSourceType;
  ai_status: 'pending' | 'success' | 'failed';
}

async function getExistingRows(
  supabase: SupabaseClient,
  date: string
): Promise<{ rows: ExistingFortuneRow[] | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from('fortunes')
    .select('id, source_type, ai_status')
    .eq('date', date);
  return { rows: data as ExistingFortuneRow[] | null, error };
}

async function insertFortuneRows(
  supabase: SupabaseClient,
  date: string,
  entries: ValidatedFortuneEntry[],
  sourceType: FortuneSourceType,
  sourceUrl: string | null
): Promise<{ ok: true; count: number } | { ok: false; errorMessage: string }> {
  const rows = entries.map((entry) => ({
    date,
    zodiac_id: entry.zodiacId,
    zodiac_japanese: entry.zodiacJapanese,
    zodiac_korean: entry.zodiacKorean,
    rank: entry.rank,
    original_text: entry.originalText,
    lucky_item: entry.luckyItem,
    // ai_fallback 행에는 공식 URL을 붙이지 않는다(공식 원문인 것처럼 보이지 않게).
    source_url: sourceType === 'official' ? sourceUrl : null,
    source_type: sourceType,
    ai_status: 'pending' as const,
  }));

  const { data: inserted, error } = await supabase.from('fortunes').insert(rows).select('id');

  if (error || !inserted || inserted.length !== 12) {
    return {
      ok: false,
      errorMessage: error
        ? `fortunes insert failed: ${error.message}`
        : `fortunes insert incomplete: ${inserted?.length ?? 0}/12`,
    };
  }

  return { ok: true, count: inserted.length };
}

async function logFortuneSourceAttempt(
  supabase: SupabaseClient,
  input: {
    date: string;
    sourceUrl: string;
    fetchedAt: string;
    status: 'success' | 'failed';
    errorMessage: string | null;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('fortune_sources')
    .insert({
      source_date: input.date,
      source_type: determineSourceType(input.date),
      source_url: input.sourceUrl,
      fetched_at: input.fetchedAt,
      status: input.status,
      error_message: input.errorMessage,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function runDailyCollect(
  supabase: SupabaseClient,
  options?: { date?: string }
): Promise<CollectStepResult> {
  const officialResult = await collectHoroscope();

  // ─────────────────────────────────────────────────────────────
  // 수동 지정 모드(디버깅/재검증 전용): 특정 날짜의 공식 데이터가 실제로 올라왔는지만
  // 정확히 확인한다. AI 대체를 트리거하지 않는다 — 반복 호출해도 Gemini 비용이 들지
  // 않는 저비용 확인 도구로 유지한다.
  // ─────────────────────────────────────────────────────────────
  if (options?.date) {
    const targetDate = options.date;

    if (!officialResult.ok) {
      await logFortuneSourceAttempt(supabase, {
        date: targetDate,
        sourceUrl: officialResult.sourceUrl,
        fetchedAt: officialResult.fetchedAt,
        status: 'failed',
        errorMessage: officialResult.errorMessage,
      });
      return { ok: false, date: targetDate, skipped: false, errorReason: officialResult.errorMessage };
    }

    if (officialResult.date !== targetDate) {
      return {
        ok: true,
        date: targetDate,
        skipped: true,
        skipReason: 'not_updated_yet',
        sourceDate: officialResult.date,
      };
    }

    return runOfficialInsert(supabase, targetDate, officialResult.entries, officialResult.sourceUrl, officialResult.fetchedAt);
  }

  // ─────────────────────────────────────────────────────────────
  // 자동(cron) 모드: 오늘 KST 날짜의 운세가 반드시 존재하게 만든다. 공식 데이터가
  // 오늘 날짜로 올라와 있으면 그것을 쓰고, 아니면(수집 실패·미게시·일요일 등 이유
  // 불문) Gemini로 오늘 전용 운세를 새로 만든다. 전날 데이터를 오늘 데이터로
  // 재사용하지 않는다.
  // ─────────────────────────────────────────────────────────────
  const todayKst = getKstDateString();

  if (officialResult.ok && isFutureDate(officialResult.date, todayKst)) {
    return {
      ok: false,
      date: todayKst,
      skipped: false,
      errorReason: `source onair_date ${officialResult.date} is after today (${todayKst})`,
    };
  }

  const officialReady = officialResult.ok && officialResult.date === todayKst;

  const { rows: existingRows, error: existingError } = await getExistingRows(supabase, todayKst);
  if (existingError) {
    await logFortuneSourceAttempt(supabase, {
      date: todayKst,
      sourceUrl: officialResult.sourceUrl,
      fetchedAt: officialResult.fetchedAt,
      status: 'failed',
      errorMessage: `existing data check failed: ${existingError.message}`,
    });
    return { ok: false, date: todayKst, skipped: false, errorReason: 'existing data check failed' };
  }

  const existingCount = existingRows?.length ?? 0;

  // 1~11개만 존재: 애매한 상태. 수정·삭제하지 않고 오류로 종료한다(기존과 동일).
  if (existingCount > 0 && existingCount < 12) {
    await logFortuneSourceAttempt(supabase, {
      date: todayKst,
      sourceUrl: officialResult.sourceUrl,
      fetchedAt: officialResult.fetchedAt,
      status: 'failed',
      errorMessage: `partial existing data: ${existingCount}/12 rows found for ${todayKst}`,
    });
    return { ok: false, date: todayKst, skipped: false, errorReason: `partial existing data: ${existingCount}/12` };
  }

  if (existingCount === 12) {
    // 오늘 데이터가 ai_fallback으로 이미 채워져 있고, 아직 하나도 M5(단어 생성)를
    // 통과하지 못했다면(=vocabulary가 하나도 없어 사용자가 저장할 수 없는 상태) 공식
    // 데이터가 지금 유효할 때만 official로 교체한다. 하나라도 success면(=vocabulary가
    // 존재해 사용자가 이미 저장했을 수 있음) saved_vocabulary 보호를 위해 절대 건드리지
    // 않는다.
    const allFallbackNotYetSaved =
      existingRows!.every((row) => row.source_type === 'ai_fallback' && row.ai_status !== 'success');

    if (officialReady && officialResult.ok && allFallbackNotYetSaved) {
      const { error: deleteError } = await supabase.from('fortunes').delete().eq('date', todayKst);
      if (!deleteError) {
        // 교체 삽입이 실패해도(반환값 그대로 전달) 오늘 데이터가 비는 것뿐, 다른
        // 날짜 데이터에는 영향이 없다.
        return runOfficialInsert(
          supabase,
          todayKst,
          officialResult.entries,
          officialResult.sourceUrl,
          officialResult.fetchedAt
        );
      }
      // 삭제 자체가 실패하면 기존 ai_fallback을 그대로 둔다(안전한 쪽으로).
    }

    await logFortuneSourceAttempt(supabase, {
      date: todayKst,
      sourceUrl: officialResult.sourceUrl,
      fetchedAt: officialResult.fetchedAt,
      status: officialResult.ok ? 'success' : 'failed',
      errorMessage: officialResult.ok ? null : officialResult.errorMessage,
    });
    return { ok: true, date: todayKst, skipped: true, skipReason: 'already_complete', count: 12 };
  }

  // existingCount === 0: 공식 데이터를 우선 시도하고, 실패/미게시면 AI 대체로 넘어간다.
  if (officialReady && officialResult.ok) {
    return runOfficialInsert(supabase, todayKst, officialResult.entries, officialResult.sourceUrl, officialResult.fetchedAt);
  }

  // 공식 데이터 사용 불가 사유를 감사 목적으로 기록한다(민감정보·원문 전체 없음).
  await logFortuneSourceAttempt(supabase, {
    date: todayKst,
    sourceUrl: officialResult.sourceUrl,
    fetchedAt: officialResult.fetchedAt,
    status: 'failed',
    errorMessage: officialResult.ok
      ? `official onair_date ${officialResult.date} does not match today (${todayKst})`
      : officialResult.errorMessage,
  });

  const fallback = await generateFallbackFortunes(todayKst);
  if (!fallback.ok) {
    // 재시도까지 실패 — 아무 것도 저장하지 않는다(기존 데이터 없음, 어제 데이터로
    // 대체 노출하지 않음). 실패 원인은 호출부(cron 라우트)가 서버 로그에 남긴다.
    return { ok: false, date: todayKst, skipped: false, errorReason: fallback.errorMessage };
  }

  const insertResult = await insertFortuneRows(supabase, todayKst, fallback.entries, 'ai_fallback', null);
  if (!insertResult.ok) {
    return { ok: false, date: todayKst, skipped: false, errorReason: insertResult.errorMessage };
  }

  return { ok: true, date: todayKst, skipped: false, sourceType: 'ai_fallback', count: insertResult.count };
}

async function runOfficialInsert(
  supabase: SupabaseClient,
  date: string,
  entries: ValidatedFortuneEntry[],
  sourceUrl: string,
  fetchedAt: string
): Promise<CollectStepResult> {
  const insertResult = await insertFortuneRows(supabase, date, entries, 'official', sourceUrl);

  if (!insertResult.ok) {
    await logFortuneSourceAttempt(supabase, {
      date,
      sourceUrl,
      fetchedAt,
      status: 'failed',
      errorMessage: insertResult.errorMessage,
    });
    return { ok: false, date, skipped: false, errorReason: insertResult.errorMessage };
  }

  const sourceRowId = await logFortuneSourceAttempt(supabase, {
    date,
    sourceUrl,
    fetchedAt,
    status: 'success',
    errorMessage: null,
  });

  // source_id 역참조는 부가 정보이므로, 이 갱신이 실패해도 fortunes 저장 자체는 이미 성공한 상태다.
  if (sourceRowId) {
    await supabase.from('fortunes').update({ source_id: sourceRowId }).eq('date', date);
  }

  return { ok: true, date, skipped: false, sourceType: 'official', count: insertResult.count };
}
