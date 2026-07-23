import type { ZodiacId } from '@/types/fortune';

export interface ZodiacPeriod {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

export interface ZodiacInfo {
  id: ZodiacId;
  japanese: string;
  korean: string;
  emoji: string;  // M1 임시 — 아이콘 SVG로 교체 예정
  period: ZodiacPeriod;
}

export const ZODIACS: ZodiacInfo[] = [
  { id: 'aries',       japanese: 'おひつじ座', korean: '양자리',    emoji: '♈', period: { startMonth: 3,  startDay: 21, endMonth: 4,  endDay: 19 } },
  { id: 'taurus',      japanese: 'おうし座',   korean: '황소자리',  emoji: '♉', period: { startMonth: 4,  startDay: 20, endMonth: 5,  endDay: 20 } },
  { id: 'gemini',      japanese: 'ふたご座',   korean: '쌍둥이자리', emoji: '♊', period: { startMonth: 5,  startDay: 21, endMonth: 6,  endDay: 21 } },
  { id: 'cancer',      japanese: 'かに座',     korean: '게자리',    emoji: '♋', period: { startMonth: 6,  startDay: 22, endMonth: 7,  endDay: 22 } },
  { id: 'leo',         japanese: 'しし座',     korean: '사자자리',  emoji: '♌', period: { startMonth: 7,  startDay: 23, endMonth: 8,  endDay: 22 } },
  { id: 'virgo',       japanese: 'おとめ座',   korean: '처녀자리',  emoji: '♍', period: { startMonth: 8,  startDay: 23, endMonth: 9,  endDay: 22 } },
  { id: 'libra',       japanese: 'てんびん座', korean: '천칭자리',  emoji: '♎', period: { startMonth: 9,  startDay: 23, endMonth: 10, endDay: 22 } },
  { id: 'scorpio',     japanese: 'さそり座',   korean: '전갈자리',  emoji: '♏', period: { startMonth: 10, startDay: 23, endMonth: 11, endDay: 22 } },
  { id: 'sagittarius', japanese: 'いて座',     korean: '사수자리',  emoji: '♐', period: { startMonth: 11, startDay: 23, endMonth: 12, endDay: 21 } },
  { id: 'capricorn',   japanese: 'やぎ座',     korean: '염소자리',  emoji: '♑', period: { startMonth: 12, startDay: 22, endMonth: 1,  endDay: 19 } },
  { id: 'aquarius',    japanese: 'みずがめ座', korean: '물병자리',  emoji: '♒', period: { startMonth: 1,  startDay: 20, endMonth: 2,  endDay: 18 } },
  { id: 'pisces',      japanese: 'うお座',     korean: '물고기자리', emoji: '♓', period: { startMonth: 2,  startDay: 19, endMonth: 3,  endDay: 20 } },
];

export const ZODIAC_MAP = new Map<ZodiacId, ZodiacInfo>(
  ZODIACS.map((z) => [z.id, z])
);

export function getZodiac(id: ZodiacId): ZodiacInfo | undefined {
  return ZODIAC_MAP.get(id);
}

function formatZodiacPeriod(period: ZodiacPeriod): string {
  return `${period.startMonth}월 ${period.startDay}일 ~ ${period.endMonth}월 ${period.endDay}일`;
}

// 별자리는 태어난 날짜 범위로 정해지므로, 별자리 옆 기간 표시는 오늘 날짜나 운세
// 기준일이 아니라 항상 이 매핑(ZODIACS의 period)을 따라야 한다.
export const ZODIAC_PERIOD_LABELS: Record<ZodiacId, string> = ZODIACS.reduce(
  (labels, zodiac) => {
    labels[zodiac.id] = formatZodiacPeriod(zodiac.period);
    return labels;
  },
  {} as Record<ZodiacId, string>
);
