import { HTMLAttributes, ReactNode } from 'react';

interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export default function Tooltip({ children, className = '', ...props }: TooltipProps) {
  return (
    <div
      className={['inline-flex flex-col items-center max-w-full', className]
        .filter(Boolean)
        .join(' ')}
      style={{ filter: 'var(--drop-shadow-300)' }}
      {...props}
    >
      <div className="max-w-full rounded-[var(--radius-sm)] bg-[var(--gray-700)] p-3 text-b2-medium whitespace-normal break-words text-[var(--text-inverse)]">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="h-0 w-0 shrink-0"
        style={{
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid var(--gray-700)',
        }}
      />
    </div>
  );
}
