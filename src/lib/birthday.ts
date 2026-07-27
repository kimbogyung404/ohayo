import { ZODIACS, type ZodiacInfo, type ZodiacPeriod } from '@/lib/zodiac';
import { BIRTHDAY_STORAGE_KEY } from '@/lib/onboarding';

export interface Birthday {
  month: number;
  day: number;
}

// 연도를 받지 않으므로(온보딩에서 생년을 물어보지 않음) 2월은 항상 29일까지 유효한
// 것으로 취급한다 — 실제 그 해가 윤년인지는 따지지 않는다.
const DAYS_IN_MONTH: Record<number, number> = {
  1: 31,
  2: 29,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
};

export function isValidMonth(month: unknown): month is number {
  return typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= 12;
}

export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month] ?? 31;
}

export function isValidBirthday(month: unknown, day: unknown): month is number {
  if (!isValidMonth(month)) return false;
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1) return false;
  return day <= daysInMonth(month);
}

// 월 변경 시 기존에 선택한 일이 새 월에서 유효하지 않으면(예: 1월 31일 → 4월) 새 월의
// 마지막 날짜로 보정한다(예: 4월 30일, 2월은 29일).
export function clampDayToMonth(day: number, month: number): number {
  return Math.min(day, daysInMonth(month));
}

function isDateInPeriod(month: number, day: number, period: ZodiacPeriod): boolean {
  const value = month * 100 + day;
  const start = period.startMonth * 100 + period.startDay;
  const end = period.endMonth * 100 + period.endDay;
  // 염소자리(12/22~1/19)처럼 연말을 걸치는 기간은 start > end가 되므로 두 구간으로 나눠 판정한다.
  return start <= end ? value >= start && value <= end : value >= start || value <= end;
}

export function getZodiacByBirthday(month: number, day: number): ZodiacInfo | null {
  if (!isValidBirthday(month, day)) return null;
  return ZODIACS.find((zodiac) => isDateInPeriod(month, day, zodiac.period)) ?? null;
}

// OnboardingScreen은 별도 라우트가 아니라 이미 마운트되어 있던 홈 화면(/) 위의
// 오버레이라서, 생일 저장 이후 router.push('/')를 호출해도 같은 라우트라 ZodiacBanner가
// 리마운트되지 않는다(마운트 시점 1회만 실행되는 effect라 저장 전 상태를 그대로 유지).
// 그래서 저장 시점에 이 이벤트를 쏴서 ZodiacBanner가 즉시 다시 읽도록 한다.
export const BIRTHDAY_UPDATED_EVENT = 'ohayo:birthday-updated';

export function saveBirthday(month: number, day: number): void {
  if (!isValidBirthday(month, day)) return;
  try {
    window.localStorage.setItem(BIRTHDAY_STORAGE_KEY, JSON.stringify({ month, day }));
    window.dispatchEvent(new Event(BIRTHDAY_UPDATED_EVENT));
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 저장 실패해도 이번 온보딩 흐름은 막지 않는다.
  }
}

// 저장된 값이 없거나 JSON 파싱에 실패하거나 유효하지 않은 월/일이면 항상 null을 반환한다.
// 손상된 값을 임의로 보정하지 않고 "생일 정보 없음"으로 안전하게 취급한다.
export function readBirthday(): Birthday | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(BIRTHDAY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      isValidBirthday((parsed as Record<string, unknown>).month, (parsed as Record<string, unknown>).day)
    ) {
      const { month, day } = parsed as { month: number; day: number };
      return { month, day };
    }
    return null;
  } catch {
    return null;
  }
}
