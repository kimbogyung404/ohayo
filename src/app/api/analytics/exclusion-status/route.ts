import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isExcludedUserId } from '@/lib/analytics/excludedUsers';

// 현재 인증된 사용자가 Mixpanel 수집 제외 대상인지 서버에서 판정한다. 판정 자체는
// 쿠키 세션으로 서버가 직접 확인한 user.id 기준이며(클라이언트가 넘긴 값을 신뢰하지
// 않음), 응답에는 boolean 하나만 담아 user.id/이메일이 브라우저로 노출되지 않는다.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  const excluded = data.user ? isExcludedUserId(data.user.id) : false;

  return NextResponse.json({ excluded }, { headers: { 'Cache-Control': 'no-store' } });
}
