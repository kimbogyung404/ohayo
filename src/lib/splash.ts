// SplashScreen(React)이 하이드레이션되기 전, root layout의 <head>에서 동기적으로
// 실행되는 블로킹 인라인 스크립트. 목적: 이미 이번 세션에 스플래시를 본 상태라면
// 하이드레이션을 기다리지 않고 첫 페인트 전에 CSS(globals.css의
// html[data-splash-seen='true'] .splash-screen{display:none})가 즉시 숨길 수 있도록
// document.documentElement에 data attribute만 설정한다. DOM 요소를 직접 찾거나
// style을 바꾸지 않으며, 사용자 입력값 없이 고정 문자열만 사용한다.
export const SPLASH_SESSION_STORAGE_KEY = 'ohayo_splash_seen';

export const SPLASH_INIT_SCRIPT = `(function () {
  try {
    if (sessionStorage.getItem('${SPLASH_SESSION_STORAGE_KEY}')) {
      document.documentElement.dataset.splashSeen = 'true';
    } else {
      sessionStorage.setItem('${SPLASH_SESSION_STORAGE_KEY}', '1');
      document.documentElement.dataset.splashSeen = 'false';
    }
  } catch (e) {
    document.documentElement.dataset.splashSeen = 'false';
  }
})();`;
