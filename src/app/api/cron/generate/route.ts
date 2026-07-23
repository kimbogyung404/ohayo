import { NextResponse } from 'next/server';
import { runGenerateForDate } from '@/lib/ai/generateService';
import { createAdminClient } from '@/lib/supabase/admin';
import { getKstDateString } from '@/lib/date/kst';

// M5 일본어 학습 데이터 생성(수동 재실행/디버깅용). CRON_SECRET을 검증한 요청만 실행한다.
// M4가 저장한 original_text/lucky_item은 절대 수정하지 않는다.
// 자동 실행은 /api/cron/daily(vercel.json)가 담당하며, 여기서는 같은
// runGenerateForDate를 호출해 로직을 중복 구현하지 않는다.
export const maxDuration = 300; // /api/cron/daily와 동일한 한도(Hobby+Fluid Compute 최대치)로 맞춘다.

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? getKstDateString();
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;
  const includeFailed = url.searchParams.get('includeFailed') === 'true';

  const supabase = createAdminClient();
  const result = await runGenerateForDate(supabase, date, { includeFailed, limit });

  console.log('[cron/generate]', {
    date: result.date,
    ok: result.ok,
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    errorReason: result.errorReason,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.errorReason }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    date: result.date,
    processed: result.processed,
    results: result.results,
  });
}
