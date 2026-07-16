import type { ZodiacId } from '@/types/fortune';

export interface ZodiacInfo {
  id: ZodiacId;
  japanese: string;
  korean: string;
  emoji: string;  // M1 임시 — 아이콘 SVG로 교체 예정
}

export const ZODIACS: ZodiacInfo[] = [
  { id: 'aries',       japanese: 'おひつじ座', korean: '양자리',    emoji: '♈' },
  { id: 'taurus',      japanese: 'おうし座',   korean: '황소자리',  emoji: '♉' },
  { id: 'gemini',      japanese: 'ふたご座',   korean: '쌍둥이자리', emoji: '♊' },
  { id: 'cancer',      japanese: 'かに座',     korean: '게자리',    emoji: '♋' },
  { id: 'leo',         japanese: 'しし座',     korean: '사자자리',  emoji: '♌' },
  { id: 'virgo',       japanese: 'おとめ座',   korean: '처녀자리',  emoji: '♍' },
  { id: 'libra',       japanese: 'てんびん座', korean: '천칭자리',  emoji: '♎' },
  { id: 'scorpio',     japanese: 'さそり座',   korean: '전갈자리',  emoji: '♏' },
  { id: 'sagittarius', japanese: 'いて座',     korean: '사수자리',  emoji: '♐' },
  { id: 'capricorn',   japanese: 'やぎ座',     korean: '염소자리',  emoji: '♑' },
  { id: 'aquarius',    japanese: 'みずがめ座', korean: '물병자리',  emoji: '♒' },
  { id: 'pisces',      japanese: 'うお座',     korean: '물고기자리', emoji: '♓' },
];

export const ZODIAC_MAP = new Map<ZodiacId, ZodiacInfo>(
  ZODIACS.map((z) => [z.id, z])
);

export function getZodiac(id: ZodiacId): ZodiacInfo | undefined {
  return ZODIAC_MAP.get(id);
}

// 별자리는 태어난 달로 정해지므로, 별자리 옆 "월" 표시는 오늘 날짜나 운세 기준일이
// 아니라 항상 이 매핑을 따라야 한다.
export const ZODIAC_MONTH_LABELS: Record<ZodiacId, string> = {
  aquarius: '1월',
  pisces: '2월',
  aries: '3월',
  taurus: '4월',
  gemini: '5월',
  cancer: '6월',
  leo: '7월',
  virgo: '8월',
  libra: '9월',
  scorpio: '10월',
  sagittarius: '11월',
  capricorn: '12월',
};
