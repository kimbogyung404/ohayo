'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopNavigation from '@/components/ui/TopNavigation';
import Avatar from '@/components/ui/Avatar';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import { useAuth } from '@/hooks/useAuth';

const CONTACT_EMAIL = 'sgjefdjsk@gmail.com';
const INQUIRY_SUBJECT = '[OHAYO 문의 및 오류 제보]';
const INQUIRY_BODY = [
  '문의 또는 오류 내용: ',
  '',
  '문제가 발생한 화면: ',
  '',
  '사용 기기 및 브라우저: ',
  '',
  '재현 방법: ',
  '',
  '※ 비밀번호, 인증번호 등 민감한 정보는 작성하지 마세요.',
].join('\n');
const inquiryMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(INQUIRY_SUBJECT)}&body=${encodeURIComponent(INQUIRY_BODY)}`;

const MENU_ROW_CLASSNAME =
  'flex w-full items-center justify-between rounded-[var(--radius-lg)] bg-[var(--color-white)] px-4 py-3 text-b2-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]';

function MenuRow({ label, href }: { label: string; href: string }) {
  const content = (
    <>
      <span>{label}</span>
      <Icon name="chevron-right" size={24} className="shrink-0 text-[var(--border-strong)]" />
    </>
  );

  if (href.startsWith('mailto:')) {
    return (
      <a href={href} className={MENU_ROW_CLASSNAME}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={MENU_ROW_CLASSNAME}>
      {content}
    </Link>
  );
}

// 로그인 여부와 무관하게 항상 노출되는 서비스 안내 메뉴. 로딩/비로그인/로그인 세 상태
// 분기 밖(항상 렌더링되는 위치)에 둔다.
function ServiceInfoSection() {
  return (
    <div
      className="px-[var(--page-padding-x)]"
      style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
    >
      <p className="mb-3 text-caption text-[var(--text-tertiary)]">서비스 안내</p>
      <div className="flex flex-col gap-2">
        <MenuRow label="개인정보처리방침" href="/privacy" />
        <MenuRow label="서비스 및 콘텐츠 안내" href="/service-guide" />
        <MenuRow label="문의 및 오류 제보" href={inquiryMailto} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoggedIn, isLoading, signInWithGoogle, signOut } = useAuth();

  const handleBack = () => router.back();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.user_metadata?.name) as
    | string
    | undefined;

  return (
    <div>
      <TopNavigation variant="detail" title="프로필" onBack={handleBack} />

      {isLoading ? (
        <LoadingState />
      ) : !isLoggedIn ? (
        <>
          <EmptyState
            icon="👤"
            title="로그인하면 프로필을 확인할 수 있어요"
            description="Google 계정으로 로그인해 주세요."
          />
          <div className="px-[var(--page-padding-x)] pb-8">
            <Button hierarchy="primary" size="large" fullWidth onClick={() => signInWithGoogle('/profile')}>
              Google로 로그인
            </Button>
          </div>
        </>
      ) : (
        <div className="px-[var(--page-padding-x)] pt-8 pb-10 flex flex-col items-center text-center gap-4">
          <Avatar size={72}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" />
            ) : (
              <Icon name="user" size={36} />
            )}
          </Avatar>

          <div>
            {displayName && <p className="text-b1-semibold text-[var(--text-primary)]">{displayName}</p>}
            <p className="text-b2-regular text-[var(--text-secondary)] mt-0.5">{user?.email}</p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded px-1 py-1"
          >
            로그아웃
          </button>
        </div>
      )}

      <ServiceInfoSection />
    </div>
  );
}
