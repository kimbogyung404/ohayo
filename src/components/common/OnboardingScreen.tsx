'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Logo from '@/components/ui/Logo';
import Button from '@/components/ui/Button';
import StickyActionBar from '@/components/ui/StickyActionBar';
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding';

// 장식용 미리보기 마스코트(운세 테마를 바로 보여주기 위함). 특정 사용자 데이터와
// 무관하며, 이미 홈 화면에서 쓰는 기존 이미지 자산을 그대로 재사용한다.
const PREVIEW_ZODIACS = ['aries', 'leo', 'sagittarius'] as const;

// 스플래시(z-index 9999, src/app/globals.css .splash-screen)보다 낮고 다른 모든
// 오버레이(바텀시트/툴팁/카드 오버레이 등 z-50 이하)보다는 높은 값을 써서, 스플래시가
// 사라지는 순간 바로 이 화면이 드러나도록 한다. 스플래시 자체의 노출 시간·타이머
// 로직은 전혀 건드리지 않는다 — 이 컴포넌트는 항상 스플래시 뒤에 이미 마운트되어
// 있다가, 스플래시가 걷히면 자연스럽게 보이는 방식으로만 "분기"를 추가한다.
const Z_INDEX = 9000;

// 최초 방문에만 스플래시 다음에 노출되는 온보딩 1장. localStorage에 완료 여부가
// 없으면(최초 방문) 보여주고, "시작하기"를 누르면 완료로 기록한 뒤 홈으로 이동한다.
// 서버 렌더/첫 hydration 프레임은 항상 "숨김" 상태로 그려서 hydration mismatch를
// 피하고(SplashScreen과 동일한 패턴), localStorage 확인은 마운트 이후 effect에서만
// 한다 — 그 사이 스플래시가 화면을 가리고 있으므로 사용자에게는 깜빡임이 없다.
export default function OnboardingScreen() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let alreadyCompleted = true;
    try {
      alreadyCompleted = Boolean(window.localStorage.getItem(ONBOARDING_STORAGE_KEY));
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등) — 온보딩을 강제로 노출하지 않는다.
    }
    if (alreadyCompleted) return;

    // SplashScreen과 동일한 패턴: effect 본문에서 setState를 바로 호출하지 않고
    // requestAnimationFrame 콜백으로 미룬다.
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 표시 중에만 배경 스크롤을 잠근다(스플래시와 동일한 방식).
  useEffect(() => {
    if (!show) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [show]);

  const handleStart = () => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } catch {
      // 저장에 실패해도 이번 화면은 그대로 진행한다(다음 방문에 다시 노출될 수 있음).
    }
    setShow(false);
    router.push('/');
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[var(--surface-default)]"
      style={{ zIndex: Z_INDEX, maxWidth: 'var(--max-width-app)', margin: '0 auto' }}
      role="dialog"
      aria-modal="true"
      aria-label="OHAYO! 소개"
    >
      <div className="page-content-with-sticky-cta flex flex-1 flex-col overflow-y-auto">
        <div className="gradient-brand flex shrink-0 items-center justify-center gap-3 py-12">
          {PREVIEW_ZODIACS.map((zodiac) => (
            <div key={zodiac} className="relative h-16 w-16 shrink-0">
              <Image src={`/images/zodiac/${zodiac}.png`} alt="" fill className="object-contain" />
            </div>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-[var(--page-padding-x)] py-10 text-center">
          <Logo className="w-[100px] h-auto" />
          <p className="text-h1 text-[var(--text-primary)]">
            오늘의 운세로
            <br />
            일본어 단어를 배워요
          </p>
          <p className="text-b2-regular text-[var(--text-secondary)]">
            운세 속 단어 3개를 확인하고,
            <br />
            모르는 단어는 저장해 다시 볼 수 있어요.
          </p>
        </div>
      </div>

      <StickyActionBar>
        <Button hierarchy="primary" size="large" fullWidth onClick={handleStart}>
          시작하기
        </Button>
      </StickyActionBar>
    </div>
  );
}
