import { NextResponse } from 'next/server';
import { runDailyCollect } from '@/lib/crawler/collectService';
import { runGenerateForDate } from '@/lib/ai/generateService';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKstDateString } from '@/lib/date/kst';

// M4(수집) + M5(생성) 통합 일일 실행. vercel.json이 매일 KST 09:10 이후 이 라우트
// 하나만 호출한다 — Hobby 플랜은 지정 시각으로부터 최대 1시간까지 실행이 밀릴 수 있어,
// 수집·생성을 서로 다른 시간대의 별도 Cron 두 개로 등록하면 생성이 수집보다 먼저 실행될
// 위험이 있다. 하나의 요청 안에서 수집 완료를 확인한 뒤에만 생성을 시작해 순서를 보장한다.
// 수동 재실행이 필요하면 /api/cron/collect, /api/cron/generate를 각각 호출할 수 있다.
//
// Gemini 12개를 순차 호출하므로(동시성 제한 없이 한 번에 12개를 병렬 요청하지 않음)
// 실행 시간이 상대적으로 길다. Vercel Hobby 플랜은 Fluid Compute 기준 기본/최대
// maxDuration이 300초라 이 값으로 명시했다(실측 최악 케이스인 12개 전부 신규 처리도
// 수십 초 수준이라 여유가 충분하다).
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createAdminClient();
  const todayKst = getKstDateString();

  const collectStartedAt = Date.now();
  const collectResult = await runDailyCollect(supabase, todayKst);
  const collectDurationMs = Date.now() - collectStartedAt;

  console.log('[cron/daily] collect', {
    expectedDate: todayKst,
    date: collectResult.date,
    ok: collectResult.ok,
    skipped: collectResult.skipped,
    skipReason: collectResult.skipReason,
    count: collectResult.count,
    errorReason: collectResult.errorReason,
    durationMs: collectDurationMs,
  });

  // 수집 실패: 생성을 시작하지 않고 종료한다. 기존 정상 데이터는 collectService가
  // DELETE를 쓰지 않으므로 그대로 보존된다.
  if (!collectResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'collect',
        date: collectResult.date,
        error: collectResult.errorReason,
        durationMs: Date.now() - startedAt,
      },
      { status: 502 }
    );
  }

  // 공식 사이트가 아직 오늘 날짜로 갱신되지 않음(또는 일요일이라 토요일 데이터가
  // 그대로 반환됨): 아무것도 저장하지 않았으므로 생성도 시작하지 않는다.
  if (collectResult.skipReason === 'not_updated_yet') {
    console.log('[cron/daily] skipped: source not updated yet', {
      expectedDate: todayKst,
      sourceDate: collectResult.sourceDate,
    });
    return NextResponse.json({
      ok: true,
      stage: 'collect',
      skipped: true,
      reason: 'source_not_updated_yet',
      expectedDate: todayKst,
      sourceDate: collectResult.sourceDate,
      durationMs: Date.now() - startedAt,
    });
  }

  const date = collectResult.date;

  const generateStartedAt = Date.now();
  const generateResult = await runGenerateForDate(supabase, date);
  const generateDurationMs = Date.now() - generateStartedAt;

  console.log('[cron/daily] generate', {
    date: generateResult.date,
    ok: generateResult.ok,
    processed: generateResult.processed,
    succeeded: generateResult.succeeded,
    failed: generateResult.failed,
    errorReason: generateResult.errorReason,
    durationMs: generateDurationMs,
  });

  const totalDurationMs = Date.now() - startedAt;

  if (!generateResult.ok) {
    return NextResponse.json(
      { ok: false, stage: 'generate', date, error: generateResult.errorReason, durationMs: totalDurationMs },
      { status: 500 }
    );
  }

  console.log('[cron/daily] total', { date, collectDurationMs, generateDurationMs, totalDurationMs });

  return NextResponse.json({
    ok: true,
    date,
    collect: { skipped: collectResult.skipped, count: collectResult.count ?? 12, durationMs: collectDurationMs },
    generate: {
      processed: generateResult.processed,
      succeeded: generateResult.succeeded,
      failed: generateResult.failed,
      durationMs: generateDurationMs,
    },
    durationMs: totalDurationMs,
  });
}
