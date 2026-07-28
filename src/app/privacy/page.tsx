'use client';

import { useRouter } from 'next/navigation';
import TopNavigation from '@/components/ui/TopNavigation';
import DocSection from '@/components/common/DocSection';

const CONTACT_EMAIL = 'sgjefdjsk@gmail.com';
const PRIVACY_SUBJECT = '[OHAYO 개인정보 문의]';
const privacyMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(PRIVACY_SUBJECT)}`;

// 로그인 여부와 무관하게 누구나 직접 URL로 접근할 수 있는 공개 문서 페이지.
// 뒤로가기는 브라우저 히스토리가 아니라 항상 프로필로 이동한다(URL 직접 접근 시에도
// 동일하게 동작해야 하므로 router.back() 대신 명시적으로 push한다).
export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div>
      <TopNavigation variant="detail" title="개인정보처리방침" onBack={() => router.push('/profile')} />

      <div
        className="px-[var(--page-padding-x)] pt-6"
        style={{ paddingBottom: 'calc(48px + env(safe-area-inset-bottom))' }}
      >
        <p className="text-b2-regular text-[var(--text-secondary)]">
          OHAYO!는 이용자의 개인정보를 소중히 다루며, 아래와 같이 알기 쉽게 안내드립니다.
        </p>

        <div className="mt-8 flex flex-col gap-8">
          <DocSection title="1. 수집하는 정보">
            <p>Google 로그인 시 제공되는 기본 계정 정보(이메일, 이름, 프로필 사진)</p>
            <p>로그인한 이용자가 저장한 일본어 단어 정보</p>
            <p>사용자가 직접 입력한 생일의 월·일</p>
            <p>서비스 이용 기록(화면 조회, 클릭 등) 및 기기·브라우저 관련 정보</p>
          </DocSection>

          <DocSection title="2. 이용 목적">
            <p>로그인 및 본인 확인</p>
            <p>저장한 단어를 계정별로 보관하고 다시 볼 수 있게 하기 위해</p>
            <p>생일을 기반으로 별자리를 계산해 보여드리기 위해</p>
            <p>서비스 이용 현황을 분석해 더 나은 서비스로 개선하기 위해</p>
            <p>오류를 확인하고 서비스를 안정적으로 운영하기 위해</p>
          </DocSection>

          <DocSection title="3. 저장 방식">
            <p>생일의 월·일은 사용자의 브라우저에 저장되며, 서버로 전송되지 않습니다.</p>
            <p>저장한 단어는 로그인한 계정과 연결하여 안전하게 보관합니다.</p>
            <p>Google 로그인 정보는 신뢰할 수 있는 인증 서비스가 관리합니다.</p>
            <p>브라우저 데이터를 삭제하거나 다른 기기·브라우저를 사용하면 생일 설정이 유지되지 않을 수 있습니다.</p>
          </DocSection>

          <DocSection title="4. 외부 서비스 이용">
            <p>서비스 운영을 위해 아래와 같은 외부 서비스를 이용하고 있습니다.</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              <li>Google — 로그인 및 본인 확인</li>
              <li>Supabase — 계정 정보 및 저장 데이터 보관</li>
              <li>Mixpanel — 서비스 이용 분석</li>
              <li>Vercel — 서비스 호스팅 및 운영</li>
            </ul>
            <p className="mt-1">
              각 서비스는 이 목적 범위 안에서만 정보를 처리하며, 그 밖의 용도로 사용되지 않도록
              관리하고 있습니다.
            </p>
          </DocSection>

          <DocSection title="5. 보유 및 삭제">
            <p>저장한 단어는 이용자가 언제든지 직접 삭제할 수 있습니다.</p>
            <p>생일 정보는 브라우저 데이터를 삭제하면 함께 제거됩니다.</p>
            <p>
              계정 및 개인정보 삭제를 원하시면 아래 문의 채널로 요청해 주세요. 요청을 받은 뒤 7일
              이내에 처리해 드립니다.
            </p>
          </DocSection>

          <DocSection title="6. 이용자의 권리">
            <p>내가 저장한 단어를 언제든지 확인하고 삭제할 수 있습니다.</p>
            <p>내 개인정보의 열람·수정·삭제를 요청할 수 있습니다.</p>
            <p>서비스 이용 기록과 관련해 궁금한 점을 문의할 수 있습니다.</p>
          </DocSection>

          <DocSection title="7. 문의">
            <p>개인정보와 관련해 궁금한 점, 계정 및 데이터 삭제 요청은 아래로 알려주세요.</p>
            <p>
              OHAYO 개인정보 보호 담당:{' '}
              <a
                href={privacyMailto}
                className="text-[var(--text-brand)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </DocSection>

          <DocSection title="8. 시행일">
            <p>이 개인정보처리방침은 2026년 7월 28일부터 적용됩니다.</p>
          </DocSection>
        </div>
      </div>
    </div>
  );
}
