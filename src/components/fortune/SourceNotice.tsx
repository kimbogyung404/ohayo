interface SourceNoticeProps {
  sourceDate: string;
  sourceUrl: string;
}

export default function SourceNotice({ sourceDate, sourceUrl }: SourceNoticeProps) {
  const dateLabel = new Date(sourceDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <footer className="mt-8 pt-6 border-t border-[var(--border-default)] space-y-2">
      <p className="text-caption text-[var(--text-tertiary)]">
        운세 출처: ABC TV 「おはよう朝日です」 ({dateLabel})
      </p>
      <p className="text-caption text-[var(--text-tertiary)]">
        일본어 학습을 위해 읽는 법과 한국어 해석을 추가했습니다.
      </p>
      <div className="pt-2">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-caption text-[var(--text-brand)] hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded"
        >
          원문 페이지에서 운세 보기 →
        </a>
      </div>
      <p className="text-caption text-[var(--text-disabled)] pt-1">
        OHAYO!는 ABC TV 및 「おはよう朝日です」의 공식 서비스가 아닙니다.
      </p>
    </footer>
  );
}
