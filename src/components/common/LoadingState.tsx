export default function LoadingState({ message = '로딩 중...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4" role="status" aria-label={message}>
      <div
        className="w-10 h-10 border-3 border-[var(--gray-100)] border-t-[var(--brand-primary)] rounded-full animate-spin"
        aria-hidden="true"
        style={{ borderWidth: '3px' }}
      />
      <p className="text-caption text-[var(--text-tertiary)]">{message}</p>
    </div>
  );
}
