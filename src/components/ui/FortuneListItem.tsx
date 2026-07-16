import Link from 'next/link';
import { ReactNode } from 'react';
import Icon from './Icon';

interface FortuneListItemProps {
  avatar: ReactNode;
  title: string;
  period?: string;
  href: string;
}

export default function FortuneListItem({ avatar, title, period, href }: FortuneListItemProps) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-4 rounded-[var(--radius-lg)] bg-[var(--color-white)] px-4 py-3"
    >
      <div className="shrink-0">{avatar}</div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="truncate text-b2-medium text-[var(--text-primary)]">{title}</p>
        {period && (
          <p className="shrink-0 text-b2-medium text-[var(--text-primary)]">{period}</p>
        )}
      </div>
      <div className="h-6 w-6 shrink-0">
        <Icon name="chevron-right" size={24} className="text-[var(--border-strong)]" />
      </div>
    </Link>
  );
}
