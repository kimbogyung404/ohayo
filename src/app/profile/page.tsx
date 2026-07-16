'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import TopNavigation from '@/components/ui/TopNavigation';
import Avatar from '@/components/ui/Avatar';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/common/EmptyState';
import LoadingState from '@/components/common/LoadingState';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoggedIn, isLoading, signInWithGoogle, signOut } = useAuth();

  const handleBack = () => router.back();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div>
        <TopNavigation variant="detail" title="프로필" onBack={handleBack} />
        <LoadingState />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div>
        <TopNavigation variant="detail" title="프로필" onBack={handleBack} />
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
      </div>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const displayName = (user?.user_metadata?.full_name ?? user?.user_metadata?.name) as
    | string
    | undefined;

  return (
    <div>
      <TopNavigation variant="detail" title="프로필" onBack={handleBack} />

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
    </div>
  );
}
