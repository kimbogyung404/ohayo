// OAuth 콜백 등 서버 리다이렉트에 쓰이는 next 파라미터가 외부 사이트로 열리는
// open redirect가 되지 않도록, 같은 사이트 내부의 상대 경로인지 검증한다.
// 하나라도 의심스러우면 fallback(기본값 '/')으로 되돌린다.
export function getSafeRedirectPath(rawNext: string | null, fallback = '/'): string {
  if (!rawNext) return fallback;
  if (!rawNext.startsWith('/')) return fallback;
  if (rawNext.startsWith('//')) return fallback;
  if (rawNext.startsWith('/\\')) return fallback;
  if (rawNext.includes('://')) return fallback;
  return rawNext;
}
