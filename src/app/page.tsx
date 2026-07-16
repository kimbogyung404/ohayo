import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getLatestReadyDate, getRankingForDate } from '@/lib/fortune/queries';
import EmptyState from '@/components/common/EmptyState';
import BottomNavigation from '@/components/ui/BottomNavigation';
import FortuneListItem from '@/components/ui/FortuneListItem';
import Avatar from '@/components/ui/Avatar';
import ZodiacAsset from '@/components/ui/ZodiacAsset';
import AuthTopNav from '@/components/common/AuthTopNav';
import { ZODIAC_MONTH_LABELS } from '@/lib/zodiac';
import type { ZodiacRankItem } from '@/types/fortune';

const RANK_IMAGE_SRC: Record<1 | 2 | 3, string> = {
  1: '/images/ranking/rank-1.png',
  2: '/images/ranking/rank-2.png',
  3: '/images/ranking/rank-3.png',
};

// 홈 제목은 운세 데이터 기준일(readyDate)이 아니라 접속 시점의 실제 오늘 날짜를
// 보여준다. 서버가 어느 타임존에서 실행되든 항상 한국 시간(Asia/Seoul) 기준으로
// 계산해야 하므로 timeZone을 명시한다.
function formatTodayLabel(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <div className="flex w-10 aspect-square shrink-0 items-center justify-center pt-[10px] pb-[11px] rounded-[var(--radius-md)] bg-[var(--brand-light)]">
      <span className="text-b2-medium text-[var(--brand-pressed)]">{rank}</span>
    </div>
  );
}

function TopRankCard({
  item,
  className = '',
}: {
  item: ZodiacRankItem;
  className?: string;
}) {
  const isFirst = item.rank === 1;
  const imageSrc = RANK_IMAGE_SRC[item.rank as 1 | 2 | 3];
  const monthLabel = ZODIAC_MONTH_LABELS[item.zodiacId];

  return (
    <div className={['min-w-0 max-w-[140px] flex-1', className].filter(Boolean).join(' ')}>
      <div className="mb-2 flex justify-center">
        <Image src={imageSrc} alt={`${item.rank}위`} width={40} height={40} />
      </div>
      <Link
        href={`/fortune/${item.zodiacId}`}
        className={[
          'flex flex-col items-center overflow-hidden rounded-[var(--radius-xl)] pb-4',
          isFirst ? 'bg-[var(--brand-primary)]' : 'bg-[var(--brand-light)]',
        ].join(' ')}
        aria-label={`${item.rank}위 ${item.zodiacKorean} 운세 보기`}
      >
        <div className="relative aspect-square w-full">
          <ZodiacAsset zodiac={item.zodiacId} alt="" />
        </div>
        <div className="mt-0 flex items-center gap-2 text-b2-medium">
          <span className={isFirst ? 'text-[var(--text-inverse)]' : 'text-[var(--text-primary)]'}>
            {item.zodiacKorean}
          </span>
          <span className={isFirst ? 'text-[var(--text-inverse)]' : 'text-[var(--text-primary)]'}>
            {monthLabel}
          </span>
        </div>
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const readyDate = await getLatestReadyDate(supabase);
  const ranking = readyDate ? await getRankingForDate(supabase, readyDate) : [];

  const dateLabel = formatTodayLabel();

  const [first, second, third, ...rest] = ranking;

  return (
    <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
      <AuthTopNav />

      <p className="px-[var(--page-padding-x)] pt-6 text-center text-h1 text-[var(--text-primary)]">
        {dateLabel} 별자리 운세
      </p>

      {ranking.length === 0 ? (
        <EmptyState
          icon="🌅"
          title="오늘의 운세를 준비하고 있어요"
          description="잠시 후 다시 확인해 주세요."
        />
      ) : (
        <>
          {/* ─── 상위 3개 별자리 ─── */}
          <section className="px-[var(--page-padding-x)] pt-6" aria-label="오늘의 상위 3개 별자리">
            <div className="flex items-start justify-center gap-3">
              {second && <TopRankCard item={second} className="mt-12" />}
              {first && <TopRankCard item={first} />}
              {third && <TopRankCard item={third} className="mt-12" />}
            </div>
          </section>

          {/* ─── 나머지 순위 목록 ─── */}
          <section className="px-[var(--page-padding-x)] py-8" aria-label="오늘의 별자리 운세 순위">
            <ul className="space-y-4" role="list">
              {rest.map((item) => (
                <li key={item.zodiacId} className="flex items-center gap-3">
                  <RankBadge rank={item.rank} />
                  <div className="min-w-0 flex-1">
                    <FortuneListItem
                      avatar={
                        <Avatar size={40}>
                          <ZodiacAsset zodiac={item.zodiacId} alt="" />
                        </Avatar>
                      }
                      title={item.zodiacKorean}
                      period={ZODIAC_MONTH_LABELS[item.zodiacId]}
                      href={`/fortune/${item.zodiacId}`}
                    />
                  </div>
                </li>
              ))}
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
        </>
      )}
      <BottomNavigation activeItem="fortune" />
    </div>
  );
}
