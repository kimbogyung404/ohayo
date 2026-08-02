import 'server-only';
import { generateFallbackHoroscope } from './gemini';
import { validateFallbackHoroscope, type ValidatedFortuneEntry } from '@/lib/crawler/validation';

export type FallbackFortuneResult =
  | { ok: true; entries: ValidatedFortuneEntry[] }
  | { ok: false; errorMessage: string };

// 공식 오하아사 데이터가 해당 날짜에 없을 때 Gemini로 12개 별자리 운세를 통째로
// 새로 만든다(공식 원문의 대체품, 공식 데이터가 아님). 실패(호출 실패/검증 실패)하면
// 최대 1회 재시도하고, 그래도 실패하면 포기한다 — 이 함수는 아무것도 DB에 쓰지 않으므로
// 실패해도 기존 데이터에는 영향이 없다(호출부 collectService.ts가 저장을 담당).
export async function generateFallbackFortunes(dateStr: string): Promise<FallbackFortuneResult> {
  let lastError = 'unknown error';

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generateFallbackHoroscope(dateStr);
    if (!raw.ok) {
      lastError = raw.errorMessage;
      continue;
    }

    const validated = validateFallbackHoroscope(raw.json, dateStr);
    if (validated.ok) {
      return { ok: true, entries: validated.data.entries };
    }
    lastError = validated.reason;
  }

  return { ok: false, errorMessage: `fallback fortune generation failed after retry: ${lastError}` };
}
