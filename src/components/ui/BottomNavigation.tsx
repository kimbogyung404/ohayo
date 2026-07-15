'use client';

import Link from 'next/link';
import Icon from './Icon';

type ActiveItem = 'fortune' | 'saved';

interface BottomNavigationProps {
  activeItem: ActiveItem;
}

const NAV_ITEMS = [
  { key: 'fortune', href: '/', label: '오늘의 운세', icon: 'star' },
  { key: 'saved', href: '/saved', label: '저장된 단어', icon: 'folder' },
] as const;

export default function BottomNavigation({ activeItem }: BottomNavigationProps) {
  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full bg-[var(--color-white)]"
      style={{ maxWidth: 'var(--max-width-app)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav className="h-[var(--nav-height)] pt-[10px]" aria-label="하단 내비게이션">
        <ul className="flex">
          {NAV_ITEMS.map(({ key, href, label, icon }) => {
            const active = key === activeItem;
            return (
              <li key={key} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className="flex w-full flex-col items-center gap-1"
                >
                  <Icon
                    name={icon}
                    variant={active ? 'filled' : 'outline'}
                    size={32}
                    className={active ? 'text-[var(--text-brand)]' : 'text-[var(--border-strong)]'}
                  />
                  <span
                    className={`text-caption ${active ? 'text-[var(--text-brand)]' : 'text-[var(--text-secondary)]'}`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
