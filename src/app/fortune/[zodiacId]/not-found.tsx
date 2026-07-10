import Link from 'next/link';

export default function FortuneNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] px-[var(--page-padding-x)] text-center gap-4">
      <span className="text-[3rem]" aria-hidden="true">❔</span>
      <h1 className="text-h1 text-[var(--text-primary)]">별자리를 찾을 수 없어요</h1>
      <p className="text-b2-regular text-[var(--text-secondary)]">
        잘못된 별자리 주소입니다.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center h-[48px] px-6 rounded-[var(--radius-lg)] bg-[var(--brand-primary)] text-[var(--text-inverse)] text-b1-medium hover:bg-[var(--brand-hover)] transition-colors"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
