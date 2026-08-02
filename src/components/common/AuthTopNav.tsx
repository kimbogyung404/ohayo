'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TopNavigation from '@/components/ui/TopNavigation';
import Logo from '@/components/ui/Logo';
import FeedbackSheet from '@/components/common/FeedbackSheet';
import { useAuth } from '@/hooks/useAuth';

interface AuthTopNavProps {
  // 홈 화면에서만 true로 넘겨 프로필/로그인 버튼 왼쪽에 "의견 보내기"를 노출한다.
  // 저장된 단어 화면 등 이 컴포넌트를 공유하는 다른 화면에는 영향을 주지 않는다.
  showFeedbackButton?: boolean;
}

// 홈과 저장된 단어 화면이 공유하는 인증 상태 기반 상단 내비게이션.
// 로그인 후에는 로그인 버튼을 눌렀던 화면으로 그대로 돌아온다.
export default function AuthTopNav({ showFeedbackButton = false }: AuthTopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn, isLoading, signInWithGoogle } = useAuth();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // 인증 상태 확인 전에는 로그인/프로필 버튼을 그리지 않는다.
  // 여기서 guest를 먼저 그리면 로그인된 사용자에게 로그인 버튼이 잠깐 보였다가
  // authenticated로 바뀌는 깜빡임이 생긴다.
  if (isLoading) {
    return (
      <header className="w-full px-[var(--page-padding-x)] bg-[var(--surface-brand)]">
        <div className="h-16 flex items-center">
          <Logo className="w-[110px] h-auto" />
        </div>
      </header>
    );
  }

  const onFeedbackClick = showFeedbackButton ? () => setIsFeedbackOpen(true) : undefined;

  return (
    <>
      {isLoggedIn ? (
        <TopNavigation
          variant="authenticated"
          onProfileClick={() => router.push('/profile')}
          onFeedbackClick={onFeedbackClick}
        />
      ) : (
        <TopNavigation
          variant="guest"
          onLoginClick={() => signInWithGoogle(pathname)}
          onFeedbackClick={onFeedbackClick}
        />
      )}
      {showFeedbackButton && (
        <FeedbackSheet isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      )}
    </>
  );
}
