import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: string;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon = '✨',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <span className="text-[2.5rem] leading-none" aria-hidden="true">
        {icon}
      </span>
      <h2 className="text-b1-semibold text-[var(--text-primary)]">{title}</h2>
      {description && (
        <p className="text-b2-regular text-[var(--text-secondary)]">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-2 inline-flex items-center justify-center h-[48px] px-6 rounded-[var(--radius-lg)] bg-[var(--brand-primary)] text-[var(--text-inverse)] text-b1-medium hover:bg-[var(--brand-hover)] transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
