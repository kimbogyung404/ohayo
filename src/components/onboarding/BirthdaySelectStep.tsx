'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import StickyActionBar from '@/components/ui/StickyActionBar';
import Icon from '@/components/ui/Icon';
import OptionGridBottomSheet from '@/components/onboarding/OptionGridBottomSheet';
import DateGridBottomSheet from '@/components/onboarding/DateGridBottomSheet';
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding';
import { clampDayToMonth, isValidBirthday, getZodiacByBirthday, saveBirthday } from '@/lib/birthday';

type OpenField = 'month' | 'day' | null;

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` }));

interface BirthdaySelectStepProps {
  // 저장·온보딩 완료 처리가 모두 끝난 뒤 호출된다(OnboardingScreen이 화면을 닫고
  // 홈으로 이동시키는 책임을 진다 — 이 컴포넌트는 저장 여부만 책임진다).
  onComplete: () => void;
}

function FieldButton({
  label,
  filled,
  expanded,
  hasPopup,
  onClick,
}: {
  label: string;
  filled: boolean;
  expanded: boolean;
  hasPopup: 'listbox' | 'dialog';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={hasPopup}
      aria-expanded={expanded}
      className={[
        'flex h-[var(--input-height)] flex-1 items-center justify-between rounded-[var(--radius-md)] border-[1.5px] px-4 text-b2-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]',
        filled
          ? 'border-[var(--border-brand)] bg-[var(--surface-brand)] text-[var(--text-primary)]'
          : 'border-[var(--border-default)] bg-[var(--color-white)] text-[var(--text-tertiary)]',
      ].join(' ')}
    >
      <span>{label}</span>
      <Icon name="chevron-right" size={20} className="rotate-90 text-[var(--text-tertiary)]" aria-hidden="true" />
    </button>
  );
}

// 온보딩 두 번째 단계: 생일(월·일만)을 선택하고 확인을 누르면 저장 → 온보딩 완료 →
// 홈 이동까지 처리한다. 별도 Figma 디자인이 없어 기존 디자인 시스템(Button, Bottom
// Sheet, 색상·타이포·라운드 토큰)만으로 구성했다. 월은 기존 버튼 그리드 Bottom
// Sheet(OptionGridBottomSheet, 클릭 즉시 적용+닫힘)를, 일은 캘린더형 7열 날짜
// 그리드(DateGridBottomSheet, draft로 고르고 "확인"을 눌러야 반영)를 쓴다.
export default function BirthdaySelectStep({ onComplete }: BirthdaySelectStepProps) {
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [openField, setOpenField] = useState<OpenField>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectMonth = (newMonth: number) => {
    setMonth(newMonth);
    // 이미 선택해 둔 일이 새 월에서 유효하지 않으면(예: 1월 31일 → 4월) 그 월의
    // 마지막 날짜로 보정한다. 일을 아직 선택하지 않았다면 그대로 null을 유지한다
    // (월이 선택됐다고 임의로 일을 채우지 않는다).
    setDay((prevDay) => (prevDay !== null ? clampDayToMonth(prevDay, newMonth) : prevDay));
  };

  const handleConfirmDay = (newDay: number) => setDay(newDay);

  const isComplete = month !== null && day !== null;

  const handleConfirm = () => {
    if (!isComplete || isSubmitting) return;
    if (!isValidBirthday(month, day)) return;
    if (!getZodiacByBirthday(month, day)) return;

    setIsSubmitting(true);
    saveBirthday(month, day);
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } catch {
      // 저장 실패해도 이번 진입은 그대로 홈으로 넘어간다(다음 방문에 온보딩이 다시 노출될 수 있음).
    }
    onComplete();
  };

  return (
    <>
      <div className="onboarding-content-pad flex flex-1 flex-col overflow-y-auto">
        <div
          className="shrink-0 px-[var(--page-padding-x)] text-left"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 32px)' }}
        >
          <p className="text-h1 text-[var(--text-primary)]" style={{ fontWeight: 700 }}>
            생일을 선택해주세요
          </p>
        </div>

        <div className="px-[var(--page-padding-x)] pt-8">
          <div className="flex gap-3">
            <FieldButton
              label={month !== null ? `${month}월` : '월'}
              filled={month !== null}
              expanded={openField === 'month'}
              hasPopup="listbox"
              onClick={() => setOpenField('month')}
            />
            <FieldButton
              label={day !== null ? `${day}일` : '일'}
              filled={day !== null}
              expanded={openField === 'day'}
              hasPopup="dialog"
              onClick={() => setOpenField('day')}
            />
          </div>
        </div>
      </div>

      <StickyActionBar>
        <Button
          hierarchy="primary"
          size="xlarge"
          fullWidth
          disabled={!isComplete || isSubmitting}
          onClick={handleConfirm}
        >
          확인
        </Button>
      </StickyActionBar>

      <OptionGridBottomSheet
        isOpen={openField === 'month'}
        onClose={() => setOpenField(null)}
        title="월 선택"
        options={MONTH_OPTIONS}
        selectedValue={month}
        onSelect={handleSelectMonth}
        columns={4}
      />
      <DateGridBottomSheet
        isOpen={openField === 'day'}
        onClose={() => setOpenField(null)}
        month={month}
        day={day}
        onConfirm={handleConfirmDay}
      />
    </>
  );
}
