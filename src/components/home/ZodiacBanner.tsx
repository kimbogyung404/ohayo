'use client';

import { useEffect, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import ZodiacAsset from '@/components/ui/ZodiacAsset';
import Icon from '@/components/ui/Icon';
import ZodiacTrackedLink from '@/components/common/ZodiacTrackedLink';
import { readBirthday, getZodiacByBirthday, BIRTHDAY_UPDATED_EVENT } from '@/lib/birthday';
import { ZODIAC_PERIOD_LABELS } from '@/lib/zodiac';
import type { ZodiacInfo } from '@/lib/zodiac';

// 홈 상단 "내 별자리 운세 가기" 배너. 저장된 생일(월·일)이 있는 사용자에게만 노출되며,
// 저장값이 없거나 손상/유효하지 않으면(readBirthday/getZodiacByBirthday가 null) 아무것도
// 렌더링하지 않는다 — 임의의 별자리로 대체하지 않는다.
//
// page.tsx(홈)는 서버 컴포넌트라 localStorage에 접근할 수 없으므로 이 컴포넌트만 클라이언트
// 컴포넌트로 분리했다. SplashScreen/OnboardingScreen과 동일하게 서버 렌더/첫 hydration
// 프레임은 항상 숨김 상태로 그려 hydration mismatch를 피하고, 마운트 이후 effect에서만
// localStorage를 확인한다.
export default function ZodiacBanner() {
  const [zodiac, setZodiac] = useState<ZodiacInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function sync() {
      const birthday = readBirthday();
      setZodiac(birthday ? getZodiacByBirthday(birthday.month, birthday.day) : null);
      setChecked(true);
    }

    // SplashScreen/OnboardingScreen과 동일한 패턴: effect 본문에서 setState를 바로
    // 호출하지 않고 requestAnimationFrame 콜백으로 미룬다.
    const raf = requestAnimationFrame(sync);

    // 온보딩(OnboardingScreen)은 별도 라우트가 아니라 이미 마운트돼 있던 이 홈 화면
    // 위의 오버레이라서, 생일 저장 후 router.push('/')를 호출해도 같은 라우트라 이
    // 컴포넌트가 리마운트되지 않는다 — 그래서 저장 시점에 쏘는 이벤트를 구독해 즉시
    // 다시 읽는다(§9: 확인 후 새로고침 없이 바로 배너가 보여야 함).
    window.addEventListener(BIRTHDAY_UPDATED_EVENT, sync);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(BIRTHDAY_UPDATED_EVENT, sync);
    };
  }, []);

  if (!checked || !zodiac) return null;

  return (
    <section className="px-[var(--page-padding-x)] pt-4">
      <ZodiacTrackedLink
        zodiacId={zodiac.id}
        href={`/fortune/${zodiac.id}`}
        ariaLabel={`내 별자리 운세 가기 - ${zodiac.korean} ${ZODIAC_PERIOD_LABELS[zodiac.id]}`}
        className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-white)] px-4 py-3 shadow-[var(--shadow-100)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
      >
        <Avatar size={48}>
          <ZodiacAsset zodiac={zodiac.id} alt="" />
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-b2-medium text-[var(--text-primary)]">내 별자리 운세 가기</p>
          <p className="truncate text-caption text-[var(--text-secondary)]">
            {zodiac.korean} · {ZODIAC_PERIOD_LABELS[zodiac.id]}
          </p>
        </div>
        <Icon name="chevron-right" size={24} className="shrink-0 text-[var(--border-strong)]" />
      </ZodiacTrackedLink>
    </section>
  );
}
