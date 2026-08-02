import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_MESSAGE_LENGTH = 500;

// 홈 화면 "의견 보내기" 저장. user_feedback은 RLS만 켜져 있고 정책이 없어 anon/
// authenticated 역할은 어떤 접근도 할 수 없다(006_user_feedback.sql 참고) — 그래서
// 로그인 여부 확인은 쿠키 기반 일반 세션 클라이언트로, 실제 INSERT는 admin
// client(service role, server-only)로만 수행한다. 이메일/이름/프로필 이미지/IP/
// user agent/토큰은 어디에서도 읽거나 저장하지 않는다.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const rawMessage = (body as { message?: unknown } | null)?.message;
  if (typeof rawMessage !== 'string') {
    return NextResponse.json({ success: false, error: 'invalid_message' }, { status: 400 });
  }

  const message = rawMessage.trim();
  if (message.length < 1 || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ success: false, error: 'invalid_length' }, { status: 400 });
  }

  const sessionClient = await createClient();
  const { data } = await sessionClient.auth.getUser();
  const userId = data.user?.id ?? null;

  const adminClient = createAdminClient();
  const { error } = await adminClient.from('user_feedback').insert({
    message,
    user_id: userId,
    source: 'home',
  });

  if (error) {
    // Supabase 원본 오류 메시지·스택·내부 경로는 응답에 절대 포함하지 않는다.
    return NextResponse.json({ success: false, error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
