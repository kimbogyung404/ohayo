import Link from 'next/link';
import { getMockRanking } from '@/lib/fortune/mock';
import { getZodiac } from '@/lib/zodiac';

function getTodayLabel(): string {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function getFortuneSourceDate(fortunes: ReturnType<typeof getMockRanking>): string {
  if (!fortunes.length) return '';
  return new Date(fortunes[0].sourceDate).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
}

export default function HomePage() {
  const ranking = getMockRanking();
  const topFortune = ranking[0];
  const topZodiac = topFortune ? getZodiac(topFortune.zodiacId) : null;
  const today = getTodayLabel();
  const sourceDate = getFortuneSourceDate(ranking);

  return (
    <div>
      {/* ─── 헤더 / 히어로 영역 (그래디언트 적용) ─── */}
      <header
        className="relative px-[var(--page-padding-x)] pt-10 pb-8 text-center overflow-hidden"
        style={{ background: 'var(--gradient-brand-bottom)' }}
      >
        {/* 서비스명 */}
        <p className="text-caption text-white/70 tracking-widest font-semibold mb-1">
          OHAYO!
        </p>
        <h1 className="text-h1 text-white font-bold mb-1">오늘의 별자리 운세</h1>
        <p className="text-caption text-white/80">{today}</p>

        {/* 데이터 기준 날짜 */}
        {sourceDate && (
          <p className="text-caption text-white/60 mt-1">
            {sourceDate} 기준
          </p>
        )}

        {/* 1위 강조 영역 */}
        {topFortune && topZodiac && (
          <Link
            href={`/fortune/${topFortune.zodiacId}`}
            className="mt-6 mx-auto inline-flex flex-col items-center gap-2 px-6 py-4 rounded-[var(--radius-xl)] bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
            aria-label={`오늘의 1위 ${topZodiac.korean} 운세 보기`}
          >
            <span className="text-[2.5rem] leading-none" aria-hidden="true">
              {topZodiac.emoji}
            </span>
            <div className="text-center">
              <p className="text-caption text-white/80 mb-0.5">
                🏆 오늘의 1위
              </p>
              <p className="text-h2 text-white font-bold" lang="ja">
                {topZodiac.japanese}
              </p>
              <p className="text-caption text-white/80">{topZodiac.korean}</p>
            </div>
          </Link>
        )}
      </header>

      {/* ─── 12개 별자리 순위 목록 ─── */}
      <section
        className="px-[var(--page-padding-x)] py-6"
        aria-label="오늘의 별자리 운세 순위"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2 text-[var(--text-primary)]">전체 순위</h2>
          <span className="text-caption text-[var(--text-tertiary)]">
            12개 별자리
          </span>
        </div>

        <ul className="space-y-2" role="list">
          {ranking.map((item, idx) => {
            const zodiac = getZodiac(item.zodiacId);
            const isTop = idx === 0;

            return (
              <li key={item.zodiacId}>
                <Link
                  href={`/fortune/${item.zodiacId}`}
                  className={[
                    'flex items-center gap-3 px-4 py-3.5 rounded-[var(--radius-lg)] transition-colors',
                    'hover:bg-[var(--surface-subtle)] active:bg-[var(--gray-100)]',
                    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]',
                    isTop
                      ? 'bg-[var(--surface-brand)] border border-[var(--border-brand)]'
                      : 'bg-[var(--surface-default)] border border-[var(--border-default)]',
                  ].join(' ')}
                  aria-label={`${item.rank}위 ${item.zodiacKorean} 운세 보기`}
                >
                  {/* 순위 뱃지 */}
                  <div
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold ${
                      isTop
                        ? 'bg-[var(--brand-primary)] text-[var(--text-inverse)]'
                        : idx < 3
                          ? 'bg-[var(--brand-subtle)] text-[var(--text-brand)]'
                          : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                    }`}
                    aria-hidden="true"
                  >
                    {item.rank}
                  </div>

                  {/* 이모지 */}
                  <span className="text-xl flex-shrink-0" aria-hidden="true">
                    {zodiac?.emoji ?? '⭐'}
                  </span>

                  {/* 별자리명 */}
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

                  {/* 화살표 */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="flex-shrink-0 text-[var(--gray-300)]"
                  >
                    <path
                      d="M6 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ─── 출처 푸터 ─── */}
      <footer className="px-[var(--page-padding-x)] pb-6 text-center">
        <p className="text-caption text-[var(--text-disabled)]">
          운세 출처: ABC TV 「おはよう朝日です」
        </p>
        <p className="text-caption text-[var(--text-disabled)] mt-0.5">
          OHAYO!는 ABC TV의 공식 서비스가 아닙니다.
        </p>
      </footer>
    </div>
  );
}
