import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { collectHoroscope } from './ohaasa';
import { getKstDateString } from '@/lib/date/kst';

// M4 수집 로직의 단일 소스. /api/cron/collect(수동 재실행용)와 /api/cron/daily(자동
// 실행용) 양쪽에서 이 함수 하나만 호출한다 — DB 저장 규칙(중복 방지, 부분 데이터 거부 등)을
// 두 곳에 따로 구현하지 않기 위함이다.

function determineSourceType(dateStr: string): 'weekday' | 'weekend' {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

export interface CollectStepResult {
  ok: boolean;
  date: string; // 확정된 날짜(정상 처리 시) 또는 기대했던 날짜(미갱신/에러 시)
  skipped: boolean;
  skipReason?: 'not_updated_yet' | 'already_complete';
  sourceDate?: string; // not_updated_yet일 때, 공식 사이트가 실제로 반환한 날짜
  count?: number;
  errorReason?: string;
}

// fortunes에 이미 저장된 것 중 가장 최신 날짜. M4는 12개를 전부 성공해야만 insert하므로
// (existingCount===0 게이트 + insert 개수 검증) 이 테이블에 존재하는 날짜는 항상 12개가
// 온전히 저장되어 있다고 신뢰할 수 있다 — "새 공식 데이터가 나왔는가"를 판단하는 기준으로 쓴다.
async function getLatestCollectedDate(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('fortunes')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { date: string } | null)?.date ?? null;
}

function isFutureDate(dateStr: string, todayKst: string): boolean {
  return dateStr > todayKst;
}

// 공식 JSON을 fetch(ohaasa.ts가 검증까지 완료: 12개 별자리, 1~12위 중복 없음, 일요일 날짜
// 거부)하고 Supabase에 저장한다.
//
// options.date를 넘기면(수동 재실행/디버깅 전용) 그 날짜와 실제 onair_date가 정확히
// 일치할 때만 진행한다 — 특정 날짜를 의도적으로 겨냥해 재시도할 때 쓴다.
//
// options.date를 넘기지 않으면(=/api/cron/daily의 자동 실행 경로) "오늘 KST 날짜와
// 정확히 일치하는가" 대신 "이미 저장된 최신 날짜보다 새 날짜인가"로 판단한다. 오하아사는
// 평일판·토요일판이 같은 엔드포인트 하나만 쓰고(공식 사이트 조사로 확인, PRD 참고) 주말·
// 공휴일에는 마지막 평일 값이 그대로 유지되며, 그 갱신 시점도 매일 09:10 KST 정각에 딱
// 맞는다는 보장이 없다 — "오늘 날짜와 정확히 일치"를 요구하면 그 하루의 실행 시점에 아직
// 안 올라와 있으면 그 날짜의 공식 데이터를 영원히 놓친다(과거 토요일이 매번 이 이유로
// 누락되어 fortune_sources에 weekend 성공 기록이 한 번도 없었다). "저장된 것보다 최신인가"만
// 확인하면 소스가 언제 갱신되든(당일이든 다음날이든) 그 다음 실행에서 자동으로 따라잡는다.
// 일요일에는 소스가 토요일 날짜 그대로이므로 latest와 같아 자연히 skip되어 토요일 데이터가
// 유지된다 — 별도의 요일 분기 코드가 필요 없다.
export async function runDailyCollect(
  supabase: SupabaseClient,
  options?: { date?: string }
): Promise<CollectStepResult> {
  const result = await collectHoroscope();

  if (!result.ok) {
    const fallbackDate = options?.date ?? getKstDateString();
    await supabase.from('fortune_sources').insert({
      source_date: fallbackDate,
      source_type: determineSourceType(fallbackDate),
      source_url: result.sourceUrl,
      fetched_at: result.fetchedAt,
      status: 'failed',
      error_message: result.errorMessage,
    });
    return { ok: false, date: fallbackDate, skipped: false, errorReason: result.errorMessage };
  }

  const { date, entries, sourceUrl, fetchedAt } = result;

  if (options?.date) {
    if (date !== options.date) {
      return {
        ok: true,
        date: options.date,
        skipped: true,
        skipReason: 'not_updated_yet',
        sourceDate: date,
      };
    }
  } else {
    const todayKst = getKstDateString();

    // 사이트 응답 이상 방어: 미래 날짜는 받아들이지 않는다.
    if (isFutureDate(date, todayKst)) {
      return {
        ok: false,
        date: todayKst,
        skipped: false,
        errorReason: `source onair_date ${date} is after today (${todayKst})`,
      };
    }

    const latest = await getLatestCollectedDate(supabase);
    if (latest !== null && date <= latest) {
      return {
        ok: true,
        date: latest,
        skipped: true,
        skipReason: 'not_updated_yet',
        sourceDate: date,
      };
    }
  }

  const sourceType = determineSourceType(date);

  // 기존 데이터 보호: 같은 날짜의 fortunes를 먼저 조회한다.
  const { data: existing, error: existingError } = await supabase
    .from('fortunes')
    .select('id, zodiac_id')
    .eq('date', date);

  if (existingError) {
    await supabase.from('fortune_sources').insert({
      source_date: date,
      source_type: sourceType,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      status: 'failed',
      error_message: `existing data check failed: ${existingError.message}`,
    });
    return { ok: false, date, skipped: false, errorReason: 'existing data check failed' };
  }

  const existingCount = existing?.length ?? 0;

  // 이미 12개 전부 존재: 수정하지 않고 skip (같은 날짜 재실행 시 중복 방지)
  if (existingCount === 12) {
    await supabase.from('fortune_sources').insert({
      source_date: date,
      source_type: sourceType,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      status: 'success',
      error_message: null,
    });
    return { ok: true, date, skipped: true, skipReason: 'already_complete', count: 12 };
  }

  // 1~11개만 존재: 애매한 상태. 수정·삭제하지 않고 오류로 종료한다.
  if (existingCount > 0 && existingCount < 12) {
    await supabase.from('fortune_sources').insert({
      source_date: date,
      source_type: sourceType,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      status: 'failed',
      error_message: `partial existing data: ${existingCount}/12 rows found for ${date}`,
    });
    return { ok: false, date, skipped: false, errorReason: `partial existing data: ${existingCount}/12` };
  }

  // existingCount === 0: 검증된 12개를 insert한다.
  // ai_status='pending'은 최초 insert 시에만 설정한다(M5가 나중에 채울 필드).
  const rows = entries.map((entry) => ({
    date,
    zodiac_id: entry.zodiacId,
    zodiac_japanese: entry.zodiacJapanese,
    zodiac_korean: entry.zodiacKorean,
    rank: entry.rank,
    original_text: entry.originalText,
    lucky_item: entry.luckyItem,
    source_url: sourceUrl,
    ai_status: 'pending' as const,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('fortunes')
    .insert(rows)
    .select('id');

  if (insertError || !inserted || inserted.length !== 12) {
    await supabase.from('fortune_sources').insert({
      source_date: date,
      source_type: sourceType,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      status: 'failed',
      error_message: insertError
        ? `fortunes insert failed: ${insertError.message}`
        : `fortunes insert incomplete: ${inserted?.length ?? 0}/12`,
    });
    return { ok: false, date, skipped: false, errorReason: 'fortunes insert failed or incomplete' };
  }

  const { data: sourceRow, error: sourceInsertError } = await supabase
    .from('fortune_sources')
    .insert({
      source_date: date,
      source_type: sourceType,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      status: 'success',
      error_message: null,
    })
    .select('id')
    .single();

  // source_id 역참조는 부가 정보이므로, 이 갱신이 실패해도 fortunes 저장 자체는 이미 성공한 상태다.
  if (!sourceInsertError && sourceRow) {
    await supabase.from('fortunes').update({ source_id: sourceRow.id }).eq('date', date);
  }

  return { ok: true, date, skipped: false, count: inserted.length };
}
