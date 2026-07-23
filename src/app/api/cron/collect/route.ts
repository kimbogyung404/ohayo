import { NextResponse } from 'next/server';
import { runDailyCollect } from '@/lib/crawler/collectService';
import { createAdminClient } from '@/lib/supabase/admin';

// M4 오하아사 운세 수집(수동 재실행/디버깅용). CRON_SECRET을 검증한 요청만 실행한다.
// 자동 실행은 /api/cron/daily(vercel.json)가 담당하며, 여기서는 같은
// runDailyCollect를 호출해 로직을 중복 구현하지 않는다.
export const maxDuration = 300; // /api/cron/daily와 동일한 한도(Hobby+Fluid Compute 최대치)로 맞춘다.

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date');

  const supabase = createAdminClient();
  const result = dateParam
    ? await runDailyCollect(supabase, dateParam)
    : await runDailyCollect(supabase);

  console.log('[cron/collect]', {
    date: result.date,
    ok: result.ok,
    skipped: result.skipped,
    skipReason: result.skipReason,
    count: result.count,
    errorReason: result.errorReason,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.errorReason, date: result.date }, { status: 502 });
  }

  if (result.skipReason === 'not_updated_yet') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'source_not_updated_yet',
      expectedDate: result.date,
      sourceDate: result.sourceDate,
    });
  }

  return NextResponse.json({ ok: true, skipped: result.skipped, date: result.date, count: result.count ?? 12 });
}
