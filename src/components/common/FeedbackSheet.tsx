'use client';

import { useEffect, useRef, useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

const MAX_LENGTH = 500;

interface FeedbackSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// 홈 화면 "의견 보내기" 버튼이 여는 바텀시트. 이메일/이름 등 개인정보 입력란은 두지
// 않는다 — 서버(/api/feedback)가 로그인 세션에서 user_id만 선택적으로 채운다.
export default function FeedbackSheet({ isOpen, onClose }: FeedbackSheetProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  // BottomSheet가 열릴 때 시트 안 첫 번째 포커스 가능 요소(커스텀 헤더의 닫기 버튼)로
  // 먼저 포커스를 옮기므로(BottomSheet.tsx), 그 다음 커밋에서 이 effect가 textarea로
  // 다시 옮긴다(자식인 BottomSheet의 effect가 부모인 이 컴포넌트의 effect보다 먼저
  // 실행되는 React 순서를 이용한다) — 최종적으로 textarea에 포커스가 남는다.
  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  const trimmedLength = message.trim().length;
  const canSubmit = trimmedLength >= 1 && message.length <= MAX_LENGTH && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) throw new Error('failed to send feedback');

      setMessage('');
      onClose();
      showToast('소중한 의견 감사합니다!', 'success');
    } catch {
      // 실패 시 작성 중이던 내용은 그대로 둔다(사용자가 다시 시도할 수 있도록).
      showToast('의견을 보내지 못했어요. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="의견 보내기"
      header={
        <div className="flex items-center justify-between px-5 pt-2 pb-1">
          <h2 className="text-h2 text-[var(--text-primary)]">의견 보내기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="relative flex h-6 w-6 items-center justify-center rounded text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
          >
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2"
            />
            <Icon name="x" size={20} />
          </button>
        </div>
      }
    >
      <div className="px-5 pb-8 pt-2 space-y-3">
        <p className="text-b2-regular text-[var(--text-secondary)] leading-relaxed">
          OHAYO를 사용하며 느낀 점이나 개선되었으면 하는 점을 자유롭게 알려주세요.
        </p>

        <div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="좋았던 점, 불편했던 점, 추가되었으면 하는 기능을 적어주세요."
            rows={5}
            maxLength={MAX_LENGTH}
            aria-label="의견 내용"
            className="w-full resize-none rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-default)] bg-[var(--surface-default)] p-3 text-b2-regular text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:border-[var(--border-brand)] focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
          />
          <p className="mt-1 text-right text-caption text-[var(--text-tertiary)]">
            {message.length}/{MAX_LENGTH}
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button hierarchy="secondary" size="large" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button hierarchy="primary" size="large" fullWidth onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? '보내는 중...' : '보내기'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
