import Link from 'next/link';
import { ReactNode } from 'react';
import Icon from './Icon';
import ZodiacTrackedLink from '@/components/common/ZodiacTrackedLink';

interface FortuneListItemProps {
  avatar: ReactNode;
  title: string;
  period?: string;
  href: string;
  // 있으면 클릭 시 zodiac_selected를 함께 전송한다(홈 화면의 별자리 순위 목록 전용).
  // 다른 용도로 이 컴포넌트를 쓰는 곳에는 영향 없다(생략 시 기존과 동일하게 동작).
  zodiacId?: string;
}

export default function FortuneListItem({ avatar, title, period, href, zodiacId }: FortuneListItemProps) {
  const className = 'flex w-full items-center gap-4 rounded-[var(--radius-lg)] bg-[var(--color-white)] px-4 py-3';
  const content = (
    <>
      <div className="shrink-0">{avatar}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-b2-medium text-[var(--text-primary)]">{title}</p>
        {period && (
          <p className="truncate text-caption text-[var(--text-secondary)]">{period}</p>
        )}
      </div>
      <div className="h-6 w-6 shrink-0">
        <Icon name="chevron-right" size={24} className="text-[var(--border-strong)]" />
      </div>
    </>
  );

  if (zodiacId) {
    return (
      <ZodiacTrackedLink zodiacId={zodiacId} href={href} className={className}>
        {content}
      </ZodiacTrackedLink>
    );
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
