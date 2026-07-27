// 스플래시 다음에 최초 1회만 노출되는 온보딩(소개 1장 + 생일 선택)을 이미 완료했는지
// 기록하는 키. 세션마다 초기화되는 스플래시(sessionStorage, src/lib/splash.ts)와 달리,
// 로그아웃해도 같은 브라우저에서는 다시 노출되지 않아야 하므로 영구 저장소인
// localStorage를 쓴다. 생일 선택 화면(BirthdaySelectStep)까지 완료해야 저장되며,
// 소개 화면만 보고 이탈한 경우에는 저장되지 않는다.
export const ONBOARDING_STORAGE_KEY = 'ohayo_onboarding_completed';

// 온보딩의 생일 선택 단계에서 저장하는 사용자 생일(월·일만, 연도 없음) 키. 로그인 전
// 신규 사용자도 사용해야 하고 새 DB 마이그레이션은 만들지 않으므로, 다른 온보딩 플래그와
// 동일하게 localStorage에 저장한다. 값 형식과 읽기/쓰기/검증 로직은 src/lib/birthday.ts 참고.
export const BIRTHDAY_STORAGE_KEY = 'ohayo_birthday';
