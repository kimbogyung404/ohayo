import { ReactNode } from 'react';

interface AvatarProps {
  children: ReactNode;
  size?: number;
  className?: string;
}

export default function Avatar({ children, size = 40, className = '' }: AvatarProps) {
  return (
    <div
      className={[
        'relative flex items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--brand-light)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  );
}
