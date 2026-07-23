// 서버(Vercel 함수)는 보통 UTC로 동작하므로, "오늘 날짜"가 필요한 곳에서
// new Date()의 로컬 표기를 그대로 쓰면 한국 시간 기준 날짜와 어긋날 수 있다.
// 이 함수를 통해서만 KST 기준 "오늘"을 구한다(오하아사 수집·홈 화면 날짜 표시 등).
export function getKstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
