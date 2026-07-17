import mixpanel from 'mixpanel-browser';

// Mixpanel 초기화 + 전송 래퍼. 분석 전송 실패가 로그인/저장/화면 이동 등 핵심 기능을
// 막으면 안 되므로, 모든 호출은 예외를 삼키고 조용히 무시한다. 토큰이 없거나
// 서버 환경이면(SSR) 아무 것도 하지 않는다 — 로컬/미설정 환경에서도 앱은 정상 동작해야 한다.
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

function init(): boolean {
  if (initialized) return true;
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return false;

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: false,
      persistence: 'localStorage',
      ip: false,
    });
    initialized = true;
  } catch {
    initialized = false;
  }
  return initialized;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    if (!init()) return;
    mixpanel.track(event, properties);
  } catch {
    // 분석 전송 실패는 무시한다 — 핵심 기능을 막지 않는다.
  }
}

// 로그인된 사용자를 Mixpanel distinct_id로 연결한다(Supabase user.id만 사용, 이메일/
// 이름 등은 쓰지 않는다). 기존 세션 복원 시에도 실행될 수 있으며, 이벤트를 전송하지
// 않는다 — login_completed는 useAuth.ts에서 실제 로그인 완료를 확인했을 때만 별도로
// 보낸다(이 함수와 완전히 분리).
export function identify(userId: string): void {
  try {
    if (!init()) return;
    mixpanel.identify(userId);
  } catch {
    // 무시
  }
}

export function resetAnalytics(): void {
  try {
    if (init()) {
      mixpanel.reset();
    }
  } catch {
    // 무시
  }
}
