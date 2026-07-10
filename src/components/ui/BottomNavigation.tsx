'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/',
    label: '오늘의 운세',
    ariaLabel: '오늘의 운세 탭',
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          fill={active ? 'var(--brand-primary)' : 'none'}
          stroke={active ? 'var(--brand-primary)' : 'var(--gray-500)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/saved',
    label: '저장한 단어',
    ariaLabel: '저장한 단어 탭',
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M19 21L12 16L5 21V5C5 4.46957 5.21071 3.96086 5.58579 3.58579C5.96086 3.21071 6.46957 3 7 3H17C17.5304 3 18.0391 3.21071 18.4142 3.58579C18.7893 3.96086 19 4.46957 19 5V21Z"
          fill={active ? 'var(--brand-subtle)' : 'none'}
          stroke={active ? 'var(--brand-primary)' : 'var(--gray-500)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full bg-[var(--surface-default)] border-t border-[var(--border-default)]"
      style={{
        maxWidth: 'var(--max-width-app)',
        height: 'var(--nav-height)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="하단 내비게이션"
    >
      <ul className="flex h-full">
        {NAV_ITEMS.map(({ href, label, ariaLabel, icon }) => {
          // /fortune/... 경로일 때도 홈 탭 활성화
          const active =
            href === '/'
              ? pathname === '/' || pathname.startsWith('/fortune')
              : pathname === href;

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={ariaLabel}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex flex-col items-center justify-center gap-1 h-full w-full',
                  'transition-colors duration-[var(--transition-fast)]',
                  'focus-visible:outline-none focus-visible:bg-[var(--surface-brand)]',
                ].join(' ')}
              >
                {icon(active)}
                <span
                  className={`text-caption ${active ? 'text-[var(--text-brand)] font-semibold' : 'text-[var(--text-tertiary)]'}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
