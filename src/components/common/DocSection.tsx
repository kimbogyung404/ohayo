import { ReactNode } from 'react';

interface DocSectionProps {
  title: string;
  children: ReactNode;
}

// 개인정보처리방침/서비스 안내처럼 번호가 매겨진 섹션이 이어지는 정적 문서 페이지
// 전용 레이아웃 조각. 두 페이지에서 동일하게 재사용한다.
export default function DocSection({ title, children }: DocSectionProps) {
  return (
    <section>
      <h2 className="text-h2 text-[var(--text-primary)]">{title}</h2>
      <div className="mt-3 flex flex-col gap-2 text-b2-regular text-[var(--text-secondary)]">
        {children}
      </div>
    </section>
  );
}
