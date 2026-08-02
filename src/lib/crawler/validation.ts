import { z } from 'zod';
import { getZodiac } from '@/lib/zodiac';
import type { ZodiacId } from '@/types/fortune';

// 오하아사 공개 JSON 엔드포인트의 원본 응답 스키마.
// https://www.asahi.co.jp/data/ohaasa2020/horoscope.json
const RawDetailSchema = z.object({
  horoscope_detail_id: z.string(),
  horoscope_id: z.string(),
  ranking_no: z.string(),
  horoscope_st: z.string(),
  horoscope_text: z.string(),
});

const RawHoroscopeEntrySchema = z.object({
  horoscope_id: z.string(),
  onair_date: z.string(),
  detail: z.array(RawDetailSchema),
});

export const RawHoroscopeResponseSchema = z.array(RawHoroscopeEntrySchema);

// horoscope_st 코드 -> 우리 ZodiacId. 실제 사이트의 main.min.js에서 확인한 매핑과 동일하다.
const HOROSCOPE_ST_TO_ZODIAC: Record<string, ZodiacId> = {
  '01': 'aries',
  '02': 'taurus',
  '03': 'gemini',
  '04': 'cancer',
  '05': 'leo',
  '06': 'virgo',
  '07': 'libra',
  '08': 'scorpio',
  '09': 'sagittarius',
  '10': 'capricorn',
  '11': 'aquarius',
  '12': 'pisces',
};

export interface ValidatedFortuneEntry {
  zodiacId: ZodiacId;
  zodiacJapanese: string;
  zodiacKorean: string;
  rank: number;
  originalText: string;
  luckyItem: string;
}

export interface ValidatedHoroscope {
  date: string; // YYYY-MM-DD (onair_date 기준)
  entries: ValidatedFortuneEntry[]; // 정확히 12개, rank 오름차순
}

export type ValidationResult =
  | { ok: true; data: ValidatedHoroscope }
  | { ok: false; reason: string };

// onair_date("20260713")를 검증하고 "2026-07-13" 형태로 변환한다.
// 존재하지 않는 날짜(예: 20260231)는 실패로 처리한다.
function parseOnairDate(onairDate: string): string | null {
  if (!/^\d{8}$/.test(onairDate)) return null;

  const year = Number(onairDate.slice(0, 4));
  const month = Number(onairDate.slice(4, 6));
  const day = Number(onairDate.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// horoscope_text를 탭(\t)으로 분리한다.
// - 마지막 필드 = 행운 아이템
// - 나머지 필드 중 빈 값만 제외하고 줄바꿈(\n)으로 연결 = 원문
// 문장부호를 추가하거나 내용을 요약/수정하지 않는다.
function splitHoroscopeText(text: string): { originalText: string; luckyItem: string } | null {
  const fields = text.split('\t');
  if (fields.length < 2) return null;

  const luckyItem = fields[fields.length - 1];
  const originalText = fields.slice(0, -1).filter((f) => f !== '').join('\n');

  if (luckyItem === '' || originalText === '') return null;

  return { originalText, luckyItem };
}

// 스키마 검증 + 비즈니스 규칙 검증(12개 별자리, 순위 1~12 중복 없음, 날짜 유효성, 원문/행운아이템 비어있지 않음)
// 하나라도 실패하면 전체를 실패로 처리한다(부분 통과 없음).
export function validateHoroscopeResponse(json: unknown): ValidationResult {
  const parsed = RawHoroscopeResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `schema validation failed: ${parsed.error.message}` };
  }

  if (parsed.data.length !== 1) {
    return { ok: false, reason: `expected exactly 1 horoscope entry, got ${parsed.data.length}` };
  }

  const entry = parsed.data[0];

  const isoDate = parseOnairDate(entry.onair_date);
  if (!isoDate) {
    return { ok: false, reason: `invalid onair_date: ${entry.onair_date}` };
  }

  // 오하아사(평일)·오하아사 토요일판 모두 일요일에는 방송이 없다 — onair_date가 일요일이면
  // 사이트 응답 이상(파싱 오류 등)으로 보고 거부한다. 실제로는 발생 시 collectService의
  // "이미 저장된 최신 날짜보다 최신인가" 검사에서도 걸러지지만, 여기서 한 번 더 방어한다.
  if (new Date(`${isoDate}T00:00:00Z`).getUTCDay() === 0) {
    return { ok: false, reason: `onair_date falls on a Sunday, which this show never broadcasts: ${isoDate}` };
  }

  if (entry.detail.length !== 12) {
    return { ok: false, reason: `expected 12 detail entries, got ${entry.detail.length}` };
  }

  const seenZodiacIds = new Set<ZodiacId>();
  const seenRanks = new Set<number>();
  const entries: ValidatedFortuneEntry[] = [];

  for (const detail of entry.detail) {
    const zodiacId = HOROSCOPE_ST_TO_ZODIAC[detail.horoscope_st];
    if (!zodiacId) {
      return { ok: false, reason: `unknown horoscope_st code: ${detail.horoscope_st}` };
    }
    if (seenZodiacIds.has(zodiacId)) {
      return { ok: false, reason: `duplicate zodiac detected: ${zodiacId}` };
    }
    seenZodiacIds.add(zodiacId);

    const rank = Number(detail.ranking_no);
    if (!Number.isInteger(rank) || rank < 1 || rank > 12) {
      return { ok: false, reason: `invalid ranking_no: ${detail.ranking_no}` };
    }
    if (seenRanks.has(rank)) {
      return { ok: false, reason: `duplicate rank detected: ${rank}` };
    }
    seenRanks.add(rank);

    const split = splitHoroscopeText(detail.horoscope_text);
    if (!split) {
      return { ok: false, reason: `empty original text or lucky item (zodiac code ${detail.horoscope_st})` };
    }

    const zodiacInfo = getZodiac(zodiacId);
    if (!zodiacInfo) {
      return { ok: false, reason: `zodiac info not found for id: ${zodiacId}` };
    }

    entries.push({
      zodiacId,
      zodiacJapanese: zodiacInfo.japanese,
      zodiacKorean: zodiacInfo.korean,
      rank,
      originalText: split.originalText,
      luckyItem: split.luckyItem,
    });
  }

  if (seenZodiacIds.size !== 12 || seenRanks.size !== 12) {
    return { ok: false, reason: 'zodiac or rank set incomplete after processing' };
  }

  entries.sort((a, b) => a.rank - b.rank);

  return { ok: true, data: { date: isoDate, entries } };
}

// ─────────────────────────────────────────────────────────────
// AI 대체 운세(ai_fallback) 응답 검증. 공식 응답(RawHoroscopeResponseSchema)과 달리
// horoscope_st 코드나 탭 구분 텍스트가 없다 — Gemini가 zodiacId/rank/originalText/
// luckyItem을 직접 필드로 반환한다. 검증 통과 시 공식 경로와 동일한
// ValidatedFortuneEntry[] 형태로 반환해, 이후 파이프라인(collectService/
// generateService)이 출처를 구분할 필요 없이 그대로 재사용할 수 있게 한다.
// ─────────────────────────────────────────────────────────────

const FallbackEntrySchema = z.object({
  zodiacId: z.enum([
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ]),
  rank: z.number(),
  originalText: z.string(),
  luckyItem: z.string(),
});

const RawFallbackResponseSchema = z.object({
  entries: z.array(FallbackEntrySchema),
});

export function validateFallbackHoroscope(json: unknown, targetDate: string): ValidationResult {
  const parsed = RawFallbackResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: `fallback schema validation failed: ${parsed.error.message}` };
  }

  const { entries: rawEntries } = parsed.data;

  if (rawEntries.length !== 12) {
    return { ok: false, reason: `expected 12 fallback entries, got ${rawEntries.length}` };
  }

  const seenZodiacIds = new Set<ZodiacId>();
  const seenRanks = new Set<number>();
  const seenOriginalTexts = new Set<string>();
  const entries: ValidatedFortuneEntry[] = [];

  for (const raw of rawEntries) {
    const zodiacId = raw.zodiacId as ZodiacId;

    if (seenZodiacIds.has(zodiacId)) {
      return { ok: false, reason: `duplicate zodiac detected in fallback: ${zodiacId}` };
    }
    seenZodiacIds.add(zodiacId);

    if (!Number.isInteger(raw.rank) || raw.rank < 1 || raw.rank > 12) {
      return { ok: false, reason: `invalid fallback rank: ${raw.rank}` };
    }
    if (seenRanks.has(raw.rank)) {
      return { ok: false, reason: `duplicate fallback rank detected: ${raw.rank}` };
    }
    seenRanks.add(raw.rank);

    const originalText = raw.originalText.trim();
    const luckyItem = raw.luckyItem.trim();

    if (!originalText || !luckyItem) {
      return { ok: false, reason: `empty fallback original text or lucky item (zodiac ${zodiacId})` };
    }

    // 12개 별자리 내용이 서로 겹치지 않아야 한다는 요구를 구조적으로도 강제한다
    // (프롬프트 지시만으로는 완전히 보장되지 않으므로 방어적으로 재확인).
    if (seenOriginalTexts.has(originalText)) {
      return { ok: false, reason: `duplicate fallback original text detected (zodiac ${zodiacId})` };
    }
    seenOriginalTexts.add(originalText);

    const zodiacInfo = getZodiac(zodiacId);
    if (!zodiacInfo) {
      return { ok: false, reason: `zodiac info not found for id: ${zodiacId}` };
    }

    entries.push({
      zodiacId,
      zodiacJapanese: zodiacInfo.japanese,
      zodiacKorean: zodiacInfo.korean,
      rank: raw.rank,
      originalText,
      luckyItem,
    });
  }

  if (seenZodiacIds.size !== 12 || seenRanks.size !== 12) {
    return { ok: false, reason: 'fallback zodiac or rank set incomplete after processing' };
  }

  entries.sort((a, b) => a.rank - b.rank);

  return { ok: true, data: { date: targetDate, entries } };
}
