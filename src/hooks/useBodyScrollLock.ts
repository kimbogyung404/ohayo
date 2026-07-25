'use client';

import { useEffect } from 'react';

// 여러 오버레이(스플래시, 온보딩, 바텀시트, 단어 카드 등)가 동시에 body 스크롤을
// 잠글 수 있어 모듈 단위 참조 카운트로 관리한다. 각 컴포넌트가 독립적으로
// "이전 overflow 값을 저장했다가 복원"하면, 먼저 잠근 쪽이 이미 걸어둔 'hidden'을
// 나중에 잠근 쪽이 자신의 "이전 값"으로 캡처해버려 stale한 'hidden'을 복원하는
// 문제가 생긴다(최초 방문 시 SplashScreen+OnboardingScreen 동시 노출에서 실제 발생).
// count가 0에서 1이 될 때만 원래 값을 저장하고, 1에서 0이 될 때만 복원해 중첩된
// 잠금 요청 사이에 서로의 상태를 덮어쓰지 않도록 한다.
let lockCount = 0;
let originalOverflow: string | null = null;

// 잠금 하나를 획득한다. 반환된 함수를 호출하면 그 잠금을 해제한다(중복 호출은
// 안전하게 무시됨). 마지막 잠금이 해제될 때만 원래 overflow 값을 복원한다.
export function acquireBodyScrollLock(): () => void {
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;

    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = originalOverflow ?? '';
      originalOverflow = null;
    }
  };
}

// active가 true인 동안 body 스크롤 잠금을 하나 보유하는 훅. 잠금 조건이 렌더
// 시점에 이미 알려진 단순 boolean인 컴포넌트(바텀시트, 온보딩 등)에서 쓴다.
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return acquireBodyScrollLock();
  }, [active]);
}
