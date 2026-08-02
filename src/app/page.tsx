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
import ZodiacBanner from '@/components/home/ZodiacBanner';
import { ZODIAC_PERIOD_LABELS } from '@/lib/zodiac';
import type { ZodiacRankItem } from '@/types/fortune';

const RANK_IMAGE_SRC: Record<1 | 2 | 3, string> = {
  1: '/images/ranking/rank-1.png',
  2: '/images/ranking/rank-2.png',
  3: '/images/ranking/rank-3.png',
};

// Figma Taro_card 배경 — 140x206 비율의 장식 프레임(SVG). 순위별로 색상 테마가
// 다르다(1위 인디고, 2위 블루, 3위 바이올렛). 장식 프레임 형태·비율은 동일하고
// 색상만 다른 variant이므로 파일만 순위별로 분리한다.
const CARD_BACKGROUND_SRC: Record<1 | 2 | 3, string> = {
  1: '/images/cards/zodiac-card-selected.svg',
  2: '/images/cards/zodiac-card-rank2.svg',
  3: '/images/cards/zodiac-card-rank3.svg',
};

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
  const rank = item.rank as 1 | 2 | 3;
  const imageSrc = RANK_IMAGE_SRC[rank];
  const cardBackgroundSrc = CARD_BACKGROUND_SRC[rank];
  const periodLabel = ZODIAC_PERIOD_LABELS[item.zodiacId];
  // 기간 데이터("4월 20일 ~ 5월 20일")는 그대로 두고 화면 표시만 "4월 20일" /
  // "~5월 20일" 두 줄로 명시적으로 분리한다 (formatZodiacPeriod의 " ~ " 구분자 기준).
  const [periodStart, periodEnd] = periodLabel.split(' ~ ');
  // 카드 배경은 순위별로 색이 달라도 전부 진한 톤이라 1·2·3위 모두 text-inverse를 쓴다.
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
          src={cardBackgroundSrc}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
        {/* 프레임과 안 겹치는 안전 영역은 절대 위치의 top/bottom(%는 컨테이너 높이
            기준)·left/right(%는 너비 기준)로 잡는다 — 같은 값을 padding으로 주면
            top/bottom도 너비 기준으로 계산되는 CSS 스펙 때문에 프레임 하단 리본과
            겹친다. top/right/bottom/left는 Figma Home Screen(node 68:67)의 세이프
            에어리어 실측치(4.85% / 10.71% / 12.14% / 10.71%, 140x206 카드 기준
            10px/15px/25px/15px)를 그대로 썼다. 별자리 이미지는 안전 영역 폭 전체
            (Figma 실측 110/140px)를 채우고, 안전 영역 상단에 붙어(justify-start)
            이름·기간 텍스트 그룹과는 간격 없이 바로 이어진다(Figma에서 이미지
            하단=텍스트 그룹 시작 지점이 정확히 일치). 이름과 기간 사이는 4px,
            기간 두 줄 사이는 2px로 Figma 실측치와 맞춘다. */}
        <div className="absolute top-[4.85%] right-[10.71%] bottom-[12.14%] left-[10.71%] flex flex-col items-center justify-start text-center">
          <div className="relative aspect-square w-full">
            <ZodiacAsset zodiac={item.zodiacId} alt="" sizes="110px" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className={`text-b2-medium ${nameColor}`}>{item.zodiacKorean}</span>
            <div className="flex flex-col items-center gap-0.5">
              <span className={`text-caption leading-tight ${periodColor}`}>{periodStart}</span>
              <span className={`text-caption leading-tight ${periodColor}`}>{`~${periodEnd}`}</span>
            </div>
          </div>
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
      <AuthTopNav showFeedbackButton />
      <ZodiacBanner />

      {ranking.length === 0 ? (
        <>
          {readyDate && (
            <h1 className="px-[var(--page-padding-x)] pt-6 text-center text-h1 text-[var(--text-primary)]">
              <span className="text-[var(--text-brand)]">{formatDateLabel(readyDate)}</span>
              {' 별자리 운세 순위'}
            </h1>
          )}
          <EmptyState
            icon="🌅"
            title="오늘의 운세를 준비하고 있어요"
            description="잠시 후 다시 확인해 주세요."
          />
        </>
      ) : (
        <>
          {/* ─── 운세 순위 상단 영역(제목 + 상위 3개 카드). 페이지 전체와 동일한
              브랜드 배경(surface-brand)을 그대로 쓰고, 이 영역만의 하단 여백만
              pb-4로 둔다(과거의 어두운 그라데이션 배경은 제거됨). ─── */}
          <div className="pb-4">
            {readyDate && (
              <h1 className="px-[var(--page-padding-x)] pt-6 text-center text-h1 text-[var(--text-primary)]">
                <span className="text-[var(--text-brand)]">{formatDateLabel(readyDate)}</span>
                {' 별자리 운세 순위'}
              </h1>
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
                          <ZodiacAsset zodiac={item.zodiacId} alt="" sizes="40px" />
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
              운세 출처: ABC TV <span lang="ja">「おはよう朝日です」</span>
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
