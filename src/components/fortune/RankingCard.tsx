import Link from 'next/link';
import type { ZodiacRankItem } from '@/types/fortune';
import { getZodiac } from '@/lib/zodiac';

interface RankingCardProps {
  item: ZodiacRankItem;
  isTop?: boolean;
}

export default function RankingCard({ item, isTop = false }: RankingCardProps) {
  const zodiac = getZodiac(item.zodiacId);

  return (
    <Link
      href={`/fortune/${item.zodiacId}`}
      className={[
        'flex items-center gap-3 px-4 py-3.5 rounded-[var(--radius-lg)] transition-colors',
        'hover:bg-[var(--surface-subtle)] active:bg-[var(--gray-100)]',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]',
        isTop ? 'bg-[var(--surface-brand)] border border-[var(--border-brand)]' : 'bg-[var(--surface-default)] border border-[var(--border-default)]',
      ].join(' ')}
      aria-label={`${item.rank}\uc704 ${item.zodiacKorean} \uc6b4\uc138 \ubcf4\uae30`}
    >
      {/* \uc21c\uc704 */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold ${
          isTop
            ? 'bg-[var(--brand-primary)] text-[var(--text-inverse)]'
            : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
        }`}
        aria-hidden="true"
      >
        {item.rank}
      </div>

      {/* \ubcc4\uc790\ub9ac \uc774\ubaa8\uc9c0 */}
      <span className="text-xl flex-shrink-0" aria-hidden="true">
        {zodiac?.emoji ?? '\u2b50'}
      </span>

      {/* \ubcc4\uc790\ub9ac\uba85 */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-b2-medium truncate ${isTop ? 'text-[var(--text-brand)]' : 'text-[var(--text-primary)]'}`}
          lang="ja"
        >
          {item.zodiacJapanese}
        </p>
        <p className="text-caption text-[var(--text-secondary)] truncate">
          {item.zodiacKorean}
        </p>
      </div>

      {/* \ud654\uc0b4\ud45c */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0 text-[var(--gray-300)]"
      >
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
