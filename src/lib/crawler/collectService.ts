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
  date: string; // 확정된 날짜(정상 처리 시) 또는 기대했던 KST 날짜(미갱신/에러 시)
  skipped: boolean;
  skipReason?: 'not_updated_yet' | 'already_complete';
  sourceDate?: string; // not_updated_yet일 때, 공식 사이트가 실제로 반환한 날짜
  count?: number;
  errorReason?: string;
}

// 공식 JSON을 fetch(ohaasa.ts가 검증까지 완료: 12개 별자리, 1~12위 중복 없음)하고
// Supabase에 저장한다. expectedDateKst와 실제 onair_date가 다르면(=아직 갱신 전)
// 아무것도 저장하지 않고 skip 처리한다 — 어제 데이터를 오늘 데이터로 잘못 저장하는 것을 막는다.
// 단, 일요일에는 공식 사이트가 토요일 날짜를 그대로 반환하는 것이 정상 동작이므로(PRD 참고),
// 이 경우도 동일하게 skip되며 홈 화면은 이미 저장된 토요일 데이터를 계속 보여준다.
export async function runDailyCollect(
  supabase: SupabaseClient,
  expectedDateKst: string = getKstDateString()
): Promise<CollectStepResult> {
  const result = await collectHoroscope();

  if (!result.ok) {
    await supabase.from('fortune_sources').insert({
      source_date: expectedDateKst,
      source_type: determineSourceType(expectedDateKst),
      source_url: result.sourceUrl,
      fetched_at: result.fetchedAt,
      status: 'failed',
      error_message: result.errorMessage,
    });
    return { ok: false, date: expectedDateKst, skipped: false, errorReason: result.errorMessage };
  }

  const { date, entries, sourceUrl, fetchedAt } = result;

  if (date !== expectedDateKst) {
    return {
      ok: true,
      date: expectedDateKst,
      skipped: true,
      skipReason: 'not_updated_yet',
      sourceDate: date,
    };
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
