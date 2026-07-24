'use client';

import { CSSProperties, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import StickyActionBar from '@/components/ui/StickyActionBar';
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding';
import { ZODIACS } from '@/lib/zodiac';

// 스플래시(z-index 9999, src/app/globals.css .splash-screen)보다 낮고 다른 모든
// 오버레이(바텀시트/툴팁/카드 오버레이 등 z-50 이하)보다는 높은 값을 써서, 스플래시가
// 사라지는 순간 바로 이 화면이 드러나도록 한다. 스플래시 자체의 노출 시간·타이머
// 로직은 전혀 건드리지 않는다 — 이 컴포넌트는 항상 스플래시 뒤에 이미 마운트되어
// 있다가, 스플래시가 걷히면 자연스럽게 보이는 방식으로만 "분기"를 추가한다.
const Z_INDEX = 9000;

// 좌→우 seamless 무한 루프: 전체 별자리 목록을 두 벌 이어 붙이고 트랙을 -50%만큼
// 이동시키면, 이동이 끝나는 지점(-50%)이 시작 지점(0%)과 픽셀 단위로 완전히 동일해
// 반복 지점이 튀지 않는다.
const ZODIAC_TRACK = [...ZODIACS, ...ZODIACS];

// 이미지마다 서로 다른 바운싱 주기·지연·진폭을 줘서 전부 같은 타이밍으로 움직이지
// 않게 한다(주기 3~5초, 상하 이동 4~8px 범위 안에서 6가지 조합을 순환 적용).
const BOUNCE_VARIANTS = [
  { duration: 3.2, delay: 0, amplitude: 5 },
  { duration: 4.6, delay: 0.6, amplitude: 7 },
  { duration: 3.8, delay: 1.2, amplitude: 4 },
  { duration: 5.0, delay: 0.3, amplitude: 8 },
  { duration: 3.5, delay: 1.8, amplitude: 6 },
  { duration: 4.2, delay: 0.9, amplitude: 5 },
] as const;

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
      <div className="onboarding-content-pad flex flex-1 flex-col overflow-y-auto">
        <div
          className="shrink-0 px-[var(--page-padding-x)] text-left"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}
        >
          <p className="text-h1 text-[var(--text-primary)]">
            오늘의 운세로
            <br />
            일본어 단어를 배워보세요
          </p>
          <p className="mt-3 text-b2-regular text-[var(--text-secondary)]">
            별자리 운세를 읽고, 마음에 남는 단어를 저장하며
            <br />
            매일 가볍게 일본어를 익힐 수 있어요.
          </p>
        </div>

        <div className="relative flex-1 min-h-[96px] overflow-x-hidden flex items-center" aria-hidden="true">
          <div className="onboarding-marquee-track flex items-center gap-4">
            {ZODIAC_TRACK.map((zodiac, index) => {
              const variant = BOUNCE_VARIANTS[index % BOUNCE_VARIANTS.length];
              const bounceStyle = {
                '--bounce-duration': `${variant.duration}s`,
                '--bounce-delay': `${variant.delay}s`,
                '--bounce-amplitude': `${variant.amplitude}px`,
              } as CSSProperties;

              return (
                <div
                  key={`${zodiac.id}-${index}`}
                  className="onboarding-marquee-item relative h-20 w-20 shrink-0"
                  style={bounceStyle}
                >
                  <Image src={`/images/zodiac/${zodiac.id}.png`} alt="" fill className="object-contain" />
                </div>
              );
            })}
          </div>
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
