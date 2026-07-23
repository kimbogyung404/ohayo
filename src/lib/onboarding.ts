// 스플래시 다음에 최초 1회만 노출되는 온보딩(1장)을 이미 봤는지 여부를 기록하는 키.
// 세션마다 초기화되는 스플래시(sessionStorage, src/lib/splash.ts)와 달리, 로그아웃해도
// 같은 브라우저에서는 다시 노출되지 않아야 하므로 영구 저장소인 localStorage를 쓴다.
export const ONBOARDING_STORAGE_KEY = 'ohayo_onboarding_completed';
