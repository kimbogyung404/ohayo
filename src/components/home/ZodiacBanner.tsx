'use client';

import { useEffect, useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import ZodiacAsset from '@/components/ui/ZodiacAsset';
import Icon from '@/components/ui/Icon';
import ZodiacTrackedLink from '@/components/common/ZodiacTrackedLink';
import BirthdaySelectStep from '@/components/onboarding/BirthdaySelectStep';
import { readBirthday, getZodiacByBirthday, BIRTHDAY_UPDATED_EVENT } from '@/lib/birthday';
import { ZODIAC_PERIOD_LABELS } from '@/lib/zodiac';
import type { ZodiacInfo } from '@/lib/zodiac';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

// 홈 상단 "내 별자리 운세 가기" 배너. 저장된 생일(월·일)이 있으면 개인화 배너를,
// 없거나 손상/유효하지 않으면(readBirthday/getZodiacByBirthday가 null) 같은 자리에
// Empty State 배너("내 별자리 운세 바로 보기")를 대신 보여준다 — 임의의 별자리로
// 대체하지 않는다. Empty State를 누르면 온보딩 소개 화면 없이 BirthdaySelectStep만
// 전체 화면으로 열어 생일을 나중에 채울 수 있게 한다(§ 기존 사용자 + 생일 없음).
//
// page.tsx(홈)는 서버 컴포넌트라 localStorage에 접근할 수 없으므로 이 컴포넌트만 클라이언트
// 컴포넌트로 분리했다. SplashScreen/OnboardingScreen과 동일하게 서버 렌더/첫 hydration
// 프레임은 항상 숨김 상태로 그려 hydration mismatch를 피하고, 마운트 이후 effect에서만
// localStorage를 확인한다.
export default function ZodiacBanner() {
  const [zodiac, setZodiac] = useState<ZodiacInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [isBirthdaySheetOpen, setIsBirthdaySheetOpen] = useState(false);

  useBodyScrollLock(isBirthdaySheetOpen);

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

  if (!checked) return null;

  if (!zodiac) {
    // 생일 정보가 없거나 손상됨: 임의의 별자리를 대신 보여주지 않고, 같은 자리에
    // 생일 설정을 유도하는 Empty State 배너를 보여준다. 눌러도 온보딩 소개 화면은
    // 다시 거치지 않고 BirthdaySelectStep만 전체 화면으로 연다.
    return (
      <>
        <section className="px-[var(--page-padding-x)] pt-4">
          <button
            type="button"
            onClick={() => setIsBirthdaySheetOpen(true)}
            className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-white)] px-4 py-3 shadow-[var(--shadow-100)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
          >
            <div className="min-w-0 flex-1 text-left">
              <p className="text-b2-medium text-[var(--text-primary)]">내 별자리 운세 바로 보기</p>
              <p className="truncate text-caption text-[var(--text-secondary)]">
                생일을 설정하고 오늘의 운세를 확인해보세요
              </p>
            </div>
            <Icon name="chevron-right" size={24} className="shrink-0 text-[var(--border-strong)]" />
          </button>
        </section>

        {isBirthdaySheetOpen && (
          <div
            className="fixed inset-0 flex flex-col bg-[var(--surface-default)]"
            style={{ zIndex: 9000, maxWidth: 'var(--max-width-app)', margin: '0 auto' }}
            role="dialog"
            aria-modal="true"
            aria-label="생일을 선택해주세요"
          >
            {/* saveBirthday()가 쏘는 BIRTHDAY_UPDATED_EVENT를 이 컴포넌트의 sync()가
                이미 구독 중이라, 닫기만 해도 개인화 배너로 즉시 전환된다(새로고침 불필요). */}
            <BirthdaySelectStep
              onComplete={() => setIsBirthdaySheetOpen(false)}
              onCancel={() => setIsBirthdaySheetOpen(false)}
              markOnboardingComplete={false}
            />
          </div>
        )}
      </>
    );
  }

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
