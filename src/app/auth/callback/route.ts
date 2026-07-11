import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Google OAuth 콜백 처리 (화면 없음)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 코드가 없거나 교환에 실패하면 홈으로 복귀 (기존 화면 유지 원칙에 따라 next로 재시도하지 않음)
  return NextResponse.redirect(`${origin}/?login_error=1`);
}
