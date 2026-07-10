interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = '오류가 발생했어요',
  description = '네트워크 상태를 확인하고 다시 시도해 주세요.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3" role="alert">
      <span className="text-[2.5rem] leading-none" aria-hidden="true">
        😥
      </span>
      <h2 className="text-b1-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="text-b2-regular text-[var(--text-secondary)]">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center justify-center h-[48px] px-6 rounded-[var(--radius-lg)] border border-[var(--border-default)] text-[var(--text-primary)] text-b1-medium hover:bg-[var(--surface-subtle)] transition-colors"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
