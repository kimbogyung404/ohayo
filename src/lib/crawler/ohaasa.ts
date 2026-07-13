import 'server-only';
import { validateHoroscopeResponse, type ValidatedFortuneEntry } from './validation';

// 평일/토요일 페이지 모두 이 공개 JSON 엔드포인트 하나를 사용한다(조사 결과 확인됨).
// HTML을 파싱하지 않는다 — Cheerio 불필요.
export const HOROSCOPE_URL = 'https://www.asahi.co.jp/data/ohaasa2020/horoscope.json';

const RETRY_DELAY_MS = 2000;

export type CollectResult =
  | {
      ok: true;
      date: string;
      entries: ValidatedFortuneEntry[];
      sourceUrl: string;
      fetchedAt: string;
    }
  | {
      ok: false;
      errorMessage: string;
      sourceUrl: string;
      fetchedAt: string;
    };

async function fetchHoroscopeOnce(): Promise<unknown> {
  const res = await fetch(HOROSCOPE_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// 오하아사 공개 JSON을 fetch(실패 시 1회 재시도)하고 검증한다.
// Supabase 저장은 이 함수의 책임이 아니다(Route Handler에서 처리).
// 원본 JSON 전체는 로그에 남기지 않는다.
export async function collectHoroscope(): Promise<CollectResult> {
  const fetchedAt = new Date().toISOString();

  let json: unknown;
  try {
    json = await fetchHoroscopeOnce();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      json = await fetchHoroscopeOnce();
    } catch (secondError) {
      return {
        ok: false,
        errorMessage: `fetch failed after retry: ${(secondError as Error).message}`,
        sourceUrl: HOROSCOPE_URL,
        fetchedAt,
      };
    }
  }

  const result = validateHoroscopeResponse(json);
  if (!result.ok) {
    return {
      ok: false,
      errorMessage: result.reason,
      sourceUrl: HOROSCOPE_URL,
      fetchedAt,
    };
  }

  return {
    ok: true,
    date: result.data.date,
    entries: result.data.entries,
    sourceUrl: HOROSCOPE_URL,
    fetchedAt,
  };
}
