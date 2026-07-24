import mixpanel from 'mixpanel-browser';

// Mixpanel 초기화 + 전송 래퍼. 분석 전송 실패가 로그인/저장/화면 이동 등 핵심 기능을
// 막으면 안 되므로, 모든 호출은 예외를 삼키고 조용히 무시한다. 토큰이 없거나
// 서버 환경이면(SSR) 아무 것도 하지 않는다 — 로컬/미설정 환경에서도 앱은 정상 동작해야 한다.
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

function init(): boolean {
  if (initialized) return true;
  if (typeof window === 'undefined') return false;
  if (!MIXPANEL_TOKEN) {
    // 토큰 미설정은 로컬 개발에서는 정상 상태이지만, 프로덕션에서 발생하면
    // 배포 환경(Vercel)에 NEXT_PUBLIC_MIXPANEL_TOKEN이 빠져 있다는 신호이므로
    // 반드시 콘솔에서 보여야 한다. 값 자체는 로그에 남기지 않는다.
    if (process.env.NODE_ENV === 'production') {
      console.error('[mixpanel] NEXT_PUBLIC_MIXPANEL_TOKEN is not set; analytics disabled');
    }
    return false;
  }

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: false,
      persistence: 'localStorage',
      ip: false,
      // Web Session Replay 활성화. 마스킹은 Mixpanel 기본 정책을 그대로 따른다
      // (record_mask_all_text/record_mask_all_inputs 등 전역 마스킹 해제 옵션은
      // 건드리지 않는다 — 이메일/이름/Google 계정 정보/토큰/사용자 입력값 노출 방지).
      record_sessions_percent: 100,
      // 개발 환경에서만 콘솔/Network 탭에 전송 로그를 남긴다. 프로덕션 빌드에서는
      // NODE_ENV가 'production'이므로 항상 false로 컴파일된다.
      debug: process.env.NODE_ENV === 'development',
    });
    initialized = true;
  } catch (error) {
    // 에러 객체는 그대로 남기되(스택 확인용), 토큰 등 민감정보를 별도로 포함하지 않는다.
    console.error('[mixpanel] init failed', error);
    initialized = false;
  }
  return initialized;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  try {
    if (!init()) return;
    mixpanel.track(event, properties);
  } catch (error) {
    // 분석 전송 실패는 무시한다 — 핵심 기능을 막지 않는다. 원인 파악을 위해 로그만 남긴다.
    console.error('[mixpanel] track failed', error);
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
  } catch (error) {
    console.error('[mixpanel] identify failed', error);
  }
}

export function resetAnalytics(): void {
  try {
    if (init()) {
      mixpanel.reset();
    }
  } catch (error) {
    console.error('[mixpanel] reset failed', error);
  }
}

// 이 브라우저가 이미 Mixpanel 공식 opt-out 상태로 저장되어 있는지 동기적으로 확인한다.
// opt-out 상태는 mixpanel.reset()이 지우는 저장소와 별도로 보관되므로 로그아웃 후에도
// 유지된다 — 네트워크 호출 없이 즉시 판단 가능하다.
function isLocallyOptedOut(): boolean {
  try {
    return init() && mixpanel.has_opted_out_tracking();
  } catch (error) {
    console.error('[mixpanel] has_opted_out_tracking failed', error);
    return false;
  }
}

// 분석 제외 대상 브라우저를 Mixpanel 공식 opt-out 상태로 전환한다. 이후 track/identify와
// Session Replay 시작 시도는 SDK가 내부적으로 무시하며, 이미 시작된 Session Replay가
// 있다면 즉시 중단된다.
export function optOutAnalytics(): void {
  try {
    if (!init()) return;
    mixpanel.opt_out_tracking();
  } catch (error) {
    console.error('[mixpanel] opt_out_tracking failed', error);
  }
}

// 이전에 제외 대상 계정 로그인으로 opt-out된 브라우저를, 지금 로그인한 계정이 제외
// 대상이 아님을 서버로 확인한 뒤 공식 opt_in_tracking()으로 복구한다. 특정 브라우저가
// 영구적으로 막히지 않고, "현재 로그인한 계정" 기준으로 상태가 갱신되도록 한다.
// Session Replay는 opt_in_tracking()만으로는 이번 페이지 로드에서 자동 재개되지 않으므로
// (다음 init()부터 정상 시작) 즉시 재개되도록 명시적으로 시작한다.
function optInAnalytics(): void {
  try {
    if (!init()) return;
    mixpanel.opt_in_tracking();
    mixpanel.start_session_recording();
  } catch (error) {
    console.error('[mixpanel] opt_in_tracking failed', error);
  }
}

let lastCheckedUserId: string | null = null;
let lastCheckedExcluded = false;

// 로그인된 사용자를 identify하기 전에 서버(/api/analytics/exclusion-status)로 분석 제외
// 대상 여부를 매번 확인한다 — 이 브라우저가 이전에 opt-out되었더라도 재확인을 생략하지
// 않는다(생략하면 이후 일반 계정이 로그인해도 영구히 차단된다). 같은 userId에 대한 중복
// 호출(예: getUser().then과 onAuthStateChange가 같은 세션에서 동시에 실행되는 경우)만
// 네트워크 호출 없이 캐시된 결과를 재사용한다.
//
// 제외 대상으로 확인되면 identify()를 호출하지 않고 opt-out 처리한다. 제외 대상이
// 아니면서 이 브라우저가 이전에 opt-out 상태였다면(과거 제외 계정 로그인 이력)
// opt_in_tracking()으로 복구한 뒤 identify를 진행한다.
//
// 확인 요청 자체가 실패하면(오프라인 등): 이미 opt-out 상태인 브라우저는 안전한 쪽으로
// opt-out을 유지하고(오검증으로 제외 대상을 되살리지 않는다), 그 외에는 로그인 등 핵심
// 기능을 막지 않기 위해 일반 사용자로 간주해 identify를 진행한다.
export async function syncIdentity(userId: string): Promise<void> {
  if (lastCheckedUserId === userId) {
    if (lastCheckedExcluded) {
      optOutAnalytics();
    } else {
      identify(userId);
    }
    return;
  }

  let excluded: boolean;
  try {
    const res = await fetch('/api/analytics/exclusion-status', { cache: 'no-store' });
    const data: { excluded?: boolean } = res.ok ? await res.json() : {};
    excluded = !!data.excluded;
  } catch (error) {
    console.error('[mixpanel] exclusion status check failed', error);
    if (isLocallyOptedOut()) return;
    identify(userId);
    return;
  }

  lastCheckedUserId = userId;
  lastCheckedExcluded = excluded;

  if (excluded) {
    optOutAnalytics();
    return;
  }

  if (isLocallyOptedOut()) {
    optInAnalytics();
  }
  identify(userId);
}
