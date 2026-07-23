'use client';

import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';

interface LoginPromptSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void | Promise<void>;
}

export default function LoginPromptSheet({
  isOpen,
  onClose,
  onLogin,
}: LoginPromptSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="고른 단어를 저장해 둘까요?">
      <div className="px-5 pb-8 pt-4 space-y-5">
        {/* 안내 텍스트 — 가입을 강요하기보다 단어 저장을 권유하는 짧은 문구만 유지한다.
            혜택 목록·개인정보 안내 등 부가 설명은 두지 않는다. */}
        <p className="text-b2-regular text-[var(--text-secondary)] leading-relaxed">
          구글로 로그인하면
          <br />
          오늘 고른 단어를 다음에도 다시 볼 수 있어요.
        </p>

        {/* Google 로그인 버튼 */}
        <Button
          hierarchy="primary"
          size="large"
          fullWidth
          onClick={onLogin}
          aria-label="Google 계정으로 로그인"
        >
          <GoogleIcon />
          Google로 계속하기
        </Button>

        {/* 다음에 할게요 */}
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-b2-regular text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors py-1 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] rounded"
        >
          다음에 할게요
        </button>
      </div>
    </BottomSheet>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
