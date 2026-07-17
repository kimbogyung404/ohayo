'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { trackZodiacSelected } from '@/lib/analytics/events';

interface ZodiacTrackedLinkProps {
  zodiacId: string;
  href: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

// 홈 화면(서버 컴포넌트)에서 별자리 클릭 시 zodiac_selected를 보내기 위한 얇은
// 클라이언트 래퍼. next/link의 onClick은 클라이언트 컴포넌트에서만 정의할 수 있어
// 별도 파일로 분리했다 — 기존 Link의 이동 동작은 그대로 유지된다.
export default function ZodiacTrackedLink({
  zodiacId,
  href,
  className,
  ariaLabel,
  children,
}: ZodiacTrackedLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => trackZodiacSelected({ zodiacId })}
    >
      {children}
    </Link>
  );
}
