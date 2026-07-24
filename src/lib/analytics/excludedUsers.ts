import 'server-only';

// 내부 테스트 계정 등 Mixpanel 수집에서 제외할 Supabase user.id 목록. 쉼표로 구분된
// 서버 전용 환경변수(ANALYTICS_EXCLUDED_USER_IDS)에서만 읽는다 — NEXT_PUBLIC_ 접두사가
// 없으므로 브라우저 번들에는 포함되지 않는다.
function getExcludedUserIds(): Set<string> {
  const raw = process.env.ANALYTICS_EXCLUDED_USER_IDS ?? '';
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function isExcludedUserId(userId: string): boolean {
  return getExcludedUserIds().has(userId);
}
