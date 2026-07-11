import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 서버(Server Component, Route Handler)에서 사용하는 Supabase 클라이언트
// Next.js 16 기준 cookies()는 비동기이므로 반드시 await 후 사용한다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출된 경우 무시한다.
            // proxy.ts가 세션 갱신을 담당하므로 안전하다.
          }
        },
      },
    }
  );
}
