import { NextResponse } from 'next/server';
import { collectHoroscope } from '@/lib/crawler/ohaasa';
import { createAdminClient } from '@/lib/supabase/admin';

// M4 오하아사 운세 수집. CRON_SECRET을 검증한 요청만 실행한다.
// 이 라우트가 하는 일은 fetch(ohaasa.ts) -> 저장(Supabase)뿐이며,
// M5(Gemini 학습 데이터 생성)는 여기서 다루지 않는다.

function determineSourceType(dateStr: string): 'weekday' | 'weekend' {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await collectHoroscope();
  const supabase = createAdminClient();

  // 실패: fortune_sources에만 실패 기록. fortunes는 절대 건드리지 않는다.
  if (!result.ok) {
    const fallbackDate = new Date().toISOString().slice(0, 10);
    await supabase.from('fortune_sources').insert({
      source_date: fallbackDate,
      source_type: determineSourceType(fallbackDate),
      source_url: result.sourceUrl,
      fetched_at: result.fetchedAt,
      status: 'failed',
      error_message: result.errorMessage,
    });
    return NextResponse.json({ ok: false, error: result.errorMessage }, { status: 502 });
  }

  const { date, entries, sourceUrl, fetchedAt } = result;
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
    return NextResponse.json({ ok: false, error: 'existing data check failed' }, { status: 500 });
  }

  const existingCount = existing?.length ?? 0;

  // 이미 12개 전부 존재: 수정하지 않고 skip (성공으로 기록)
  if (existingCount === 12) {
    await supabase.from('fortune_sources').insert({
      source_date: date,
      source_type: sourceType,
      source_url: sourceUrl,
      fetched_at: fetchedAt,
      status: 'success',
      error_message: null,
    });
    return NextResponse.json({ ok: true, skipped: true, date, count: 12 });
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
    return NextResponse.json(
      { ok: false, error: `partial existing data: ${existingCount}/12` },
      { status: 500 }
    );
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

  // fortunes 12개 저장이 모두 성공한 경우에만 최종 success로 처리한다.
  // DB 저장에 실패했는데 fortune_sources만 success로 남지 않도록,
  // insert 결과를 확인한 뒤에 fortune_sources를 기록한다.
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
    return NextResponse.json({ ok: false, error: 'fortunes insert failed or incomplete' }, { status: 500 });
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

  return NextResponse.json({ ok: true, skipped: false, date, count: inserted.length });
}
