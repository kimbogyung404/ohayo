import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16: middleware.ts -> proxy.ts로 명칭 변경 (동작은 동일)
// Supabase 세션 쿠키를 매 요청마다 갱신한다.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 다음으로 시작하는 경로는 제외한다:
     * - _next/static, _next/image (정적 자산)
     * - favicon.ico
     * - 이미지 파일 확장자
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
