import 'server-only';
import { createClient } from '@supabase/supabase-js';

// 관리자 권한(Service Role) Supabase 클라이언트. RLS를 완전히 우회하므로
// Route Handler 등 서버 전용 코드에서만 사용한다.
// 'server-only'를 import했기 때문에 이 모듈을 Client Component에서 import하면
// 빌드 타임에 에러가 발생한다.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
