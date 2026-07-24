import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { getLatestReadyDate, getRankingForDate } from '@/lib/fortune/queries';
import EmptyState from '@/components/common/EmptyState';
import BottomNavigation from '@/components/ui/BottomNavigation';
import FortuneListItem from '@/components/ui/FortuneListItem';
import Avatar from '@/components/ui/Avatar';
import ZodiacAsset from '@/components/ui/ZodiacAsset';
import AuthTopNav from '@/components/common/AuthTopNav';
import ZodiacTrackedLink from '@/components/common/ZodiacTrackedLink';
import { ZODIAC_PERIOD_LABELS } from '@/lib/zodiac';
import type { ZodiacRankItem } from '@/types/fortune';

const RANK_IMAGE_SRC: Record<1 | 2 | 3, string> = {
  1: '/images/ranking/rank-1.png',
  2: '/images/ranking/rank-2.png',
  3: '/images/ranking/rank-3.png',
};

// Figma Taro_card1 배경 — 140x206 비율의 장식 프레임(SVG). 1·2·3위 카드 모두 동일하게
// 쓴다(순위 구분은 배경색이 아니라 카드 위 순위 별로 표시).
const CARD_BACKGROUND_SRC = '/images/cards/zodiac-card-selected.svg';

// 홈 제목은 접속 시점의 실제 오늘 날짜가 아니라 화면에 표시 중인 랭킹 데이터의
// 기준일(readyDate)을 보여준다 — Cron이 지연되어 최신 데이터가 어제 날짜일 때도
// 제목과 실제로 보여지는 순위가 항상 일치해야 하기 때문이다. readyDate는 Postgres
// date 컬럼이 그대로 내려온 "YYYY-MM-DD" 문자열이라 별도 파싱 없이 포맷만 바꾼다.
function formatDateLabel(readyDate: string): string {
  return readyDate.replaceAll('-', '.');
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
  const imageSrc = RANK_IMAGE_SRC[item.rank as 1 | 2 | 3];
  const periodLabel = ZODIAC_PERIOD_LABELS[item.zodiacId];
  // 기간 데이터("4월 20일 ~ 5월 20일")는 그대로 두고 화면 표시만 "4월 20일" /
  // "~5월 20일" 두 줄로 명시적으로 분리한다 (formatZodiacPeriod의 " ~ " 구분자 기준).
  const [periodStart, periodEnd] = periodLabel.split(' ~ ');
  // Taro_card1 배경은 진한 남색/보라 그라데이션이라 1·2·3위 모두 text-inverse를 쓴다.
  const nameColor = 'text-[var(--text-inverse)]';
  const periodColor = 'text-[var(--text-inverse)]';

  return (
    <div className={['relative min-w-0 max-w-[140px] flex-1', className].filter(Boolean).join(' ')}>
      <div className="mb-2 flex justify-center">
        <Image src={imageSrc} alt={`${item.rank}위`} width={40} height={40} />
      </div>
      {/* 카드 컨테이너를 Figma 배경(140x206, radius 16)과 동일한 비율로 고정해,
          배경 이미지를 늘리지 않고 width/height 100%로 그대로 채워도 왜곡되지
          않게 한다. 1·2·3위 카드가 항상 같은 aspect-ratio를 쓰므로 높이도 항상
          서로 일치한다. */}
      <ZodiacTrackedLink
        zodiacId={item.zodiacId}
        href={`/fortune/${item.zodiacId}`}
        className="relative block aspect-[140/206] w-full overflow-hidden rounded-[var(--radius-lg)]"
        ariaLabel={`${item.rank}위 ${item.zodiacKorean} 운세 보기`}
      >
        <img
          src={CARD_BACKGROUND_SRC}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        {/* 프레임과 안 겹치는 안전 영역은 절대 위치의 top/bottom(%는 컨테이너 높이
            기준)·left/right(%는 너비 기준)로 잡는다 — 같은 값을 padding으로 주면
            top/bottom도 너비 기준으로 계산되는 CSS 스펙 때문에 프레임 하단 리본과
            겹친다. top/bottom은 Figma "Exclude" 프레임의 안쪽 창(y 14~193 / 206)
            실측치를 그대로 썼다. 그 안전 영역 안에서 이미지·이름·시작일·종료일을
            하나의 flex column으로 묶어 justify-center로 카드 정중앙에 배치한다. */}
        <div className="absolute top-[6.8%] right-[9.3%] bottom-[6.3%] left-[9.3%] flex flex-col items-center justify-center gap-0.5 text-center">
          <div className="relative aspect-square w-[81%]">
            <ZodiacAsset zodiac={item.zodiacId} alt="" />
          </div>
          <span className={`text-b2-medium ${nameColor}`}>{item.zodiacKorean}</span>
          <span className={`text-caption leading-tight ${periodColor}`}>{periodStart}</span>
          <span className={`text-caption leading-tight ${periodColor}`}>{`~${periodEnd}`}</span>
        </div>
      </ZodiacTrackedLink>
    </div>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const readyDate = await getLatestReadyDate(supabase);
  const ranking = readyDate ? await getRankingForDate(supabase, readyDate) : [];

  const [first, second, third, ...rest] = ranking;

  return (
    <div className="page-content-with-bottom-nav bg-[var(--surface-brand)]">
      <AuthTopNav />

      {ranking.length === 0 ? (
        <>
          {readyDate && (
            <p className="px-[var(--page-padding-x)] pt-6 text-center text-h1 text-[var(--text-primary)]">
              {formatDateLabel(readyDate)} 별자리 운세 순위
            </p>
          )}
          <EmptyState
            icon="🌅"
            title="오늘의 운세를 준비하고 있어요"
            description="잠시 후 다시 확인해 주세요."
          />
        </>
      ) : (
        <>
          {/* ─── 운세 순위 상단 영역(제목 + 상위 3개 카드): 어두운 남색에서 밝은
              라벤더로 이어지는 그라데이션 배경. pb-[10px]는 그라데이션 값/스톱은
              그대로 두고 적용 영역의 하단 경계만 10px 더 늘리기 위한 것이다(자식
              레이아웃·간격에는 영향 없음, 배경이 깔리는 박스만 커진다). ─── */}
          <div
            className="pb-[10px]"
            style={{ background: 'linear-gradient(180deg, #222431 0%, #6060A9 69.99%, #EEF0FF 100%)' }}
          >
            {readyDate && (
              <p className="px-[var(--page-padding-x)] pt-6 text-center text-h1 text-[var(--text-inverse)]">
                {formatDateLabel(readyDate)} 별자리 운세 순위
              </p>
            )}

            {/* ─── 상위 3개 별자리 ─── */}
            <section className="px-[var(--page-padding-x)] pt-6" aria-label="오늘의 상위 3개 별자리">
              {/* 카드 외곽 크기는 SVG 배경 적용 전(커밋 824e3c4) 기준으로 되돌린
                  max-w-[140px] flex-1 + gap-3(12px) 조합을 그대로 쓴다 — 12px는
                  "최소 3px 여백" 요구를 넉넉히 만족하고, 카드끼리 겹치지 않는다. */}
              <div className="flex items-start justify-center gap-3">
                {second && <TopRankCard item={second} className="mt-12" />}
                {first && <TopRankCard item={first} />}
                {third && <TopRankCard item={third} className="mt-12" />}
              </div>
            </section>
          </div>

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
                      period={ZODIAC_PERIOD_LABELS[item.zodiacId]}
                      href={`/fortune/${item.zodiacId}`}
                      zodiacId={item.zodiacId}
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
