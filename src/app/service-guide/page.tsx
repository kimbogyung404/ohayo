'use client';

import { useRouter } from 'next/navigation';
import TopNavigation from '@/components/ui/TopNavigation';
import DocSection from '@/components/common/DocSection';

// 로그인 여부와 무관하게 누구나 직접 URL로 접근할 수 있는 공개 문서 페이지.
// 뒤로가기는 항상 프로필로 이동한다(privacy 페이지와 동일한 이유).
export default function ServiceGuidePage() {
  const router = useRouter();

  return (
    <div>
      <TopNavigation variant="detail" title="서비스 및 콘텐츠 안내" onBack={() => router.push('/profile')} />

      <div
        className="px-[var(--page-padding-x)] pt-6"
        style={{ paddingBottom: 'calc(48px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col gap-8">
          <DocSection title="AI를 활용한 콘텐츠 생성">
            <p>OHAYO!의 일부 번역, 읽는 법, 단어 학습 콘텐츠는 AI 기술을 활용해 자동으로 만들어집니다.</p>
          </DocSection>

          <DocSection title="정확성에 대한 안내">
            <p>AI가 생성한 내용은 참고용으로 제공되며, 실제와 다르거나 부정확한 내용이 포함될 수 있습니다.</p>
          </DocSection>

          <DocSection title="이용 목적 안내">
            <p>운세 콘텐츠는 재미와 가벼운 참고를 위한 것이며, 중요한 의사결정의 근거로 사용하지 마시기 바랍니다.</p>
          </DocSection>

          <DocSection title="생일 및 저장 정보 안내">
            <p>생일의 월·일은 별자리 표시를 위해 현재 브라우저에 저장됩니다.</p>
            <p>로그인하면 저장한 일본어 단어를 계정과 연결해 보관합니다.</p>
            <p>브라우저 데이터를 삭제하거나 다른 기기·브라우저를 사용하면 생일 설정이 유지되지 않을 수 있습니다.</p>
          </DocSection>
        </div>
      </div>
    </div>
  );
}
