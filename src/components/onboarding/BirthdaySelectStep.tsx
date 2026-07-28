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
  // 저장·온보딩 완료 처리가 모두 끝난 뒤 호출된다(호출자가 화면을 닫고 다음 화면으로
  // 이동시키는 책임을 진다 — 이 컴포넌트는 저장 여부만 책임진다).
  onComplete: () => void;
  // 온보딩 흐름 밖(예: 홈의 Empty State 배너)에서 단독으로 열렸을 때만 넘긴다.
  // 넘기면 좌상단에 닫기 버튼이 생기고, 아무것도 저장하지 않은 채 호출자가 화면을
  // 닫을 수 있게 한다. 온보딩 흐름에서는 취소가 없으므로 넘기지 않는다.
  onCancel?: () => void;
  // 온보딩 흐름(OnboardingScreen)에서 열렸을 때만 true(기본값) — 확인 시
  // ONBOARDING_STORAGE_KEY를 저장한다. 이미 온보딩을 완료한 기존 사용자가 홈의
  // Empty State 배너를 통해 생일만 나중에 채우는 경우에는 false로 넘겨, 이미 있는
  // 온보딩 완료 상태를 불필요하게 다시 쓰지 않는다.
  markOnboardingComplete?: boolean;
}

function FieldButton({
  label,
  filled,
  active,
  expanded,
  hasPopup,
  onClick,
}: {
  label: string;
  // 값이 실제로 채워졌는지(배경·글자색 결정 — "완료" 톤).
  filled: boolean;
  // 이 필드의 Bottom Sheet가 지금 열려 있는지(테두리 색 결정 — "활성" 표시). 값이
  // 채워져 있어도 다른 필드의 시트가 열려 있으면 false가 되어 기본 테두리로
  // 돌아간다 — 두 필드 중 지금 조작 중인 쪽에만 brand 테두리가 있어야 하기 때문.
  active: boolean;
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
        active ? 'border-[var(--border-brand)]' : 'border-[var(--border-default)]',
        filled ? 'bg-[var(--surface-brand)] text-[var(--text-primary)]' : 'bg-[var(--color-white)] text-[var(--text-tertiary)]',
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
export default function BirthdaySelectStep({
  onComplete,
  onCancel,
  markOnboardingComplete = true,
}: BirthdaySelectStepProps) {
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

  // 필드 테두리(active)는 "지금 열려 있는 시트가 어느 필드 것인지"를 최우선으로
  // 따른다 — 예: 일 선택 시트가 열려 있으면 월이 이미 채워져 있어도 월 필드는
  // 기본 테두리로, 일 필드만 brand 테두리로 보여야 한다(Figma 86:5 기준). 어떤
  // 시트도 열려 있지 않을 때만 기존처럼 값이 채워졌는지로 되돌아간다.
  const monthFilled = month !== null;
  const dayFilled = day !== null;
  const monthActive = openField ? openField === 'month' : monthFilled;
  const dayActive = openField ? openField === 'day' : dayFilled;

  const handleConfirm = () => {
    if (!isComplete || isSubmitting) return;
    if (!isValidBirthday(month, day)) return;
    if (!getZodiacByBirthday(month, day)) return;

    setIsSubmitting(true);
    saveBirthday(month, day);
    if (markOnboardingComplete) {
      try {
        window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
      } catch {
        // 저장 실패해도 이번 진입은 그대로 홈으로 넘어간다(다음 방문에 온보딩이 다시 노출될 수 있음).
      }
    }
    onComplete();
  };

  return (
    <>
      <div className="onboarding-content-pad flex flex-1 flex-col overflow-y-auto">
        {onCancel && (
          <div className="shrink-0 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
            <button
              type="button"
              onClick={onCancel}
              aria-label="생일 선택 닫기"
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
            >
              <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2" />
              <Icon name="x" size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        <div
          className="shrink-0 px-[var(--page-padding-x)] text-left"
          style={{ paddingTop: `calc(env(safe-area-inset-top) + ${onCancel ? 16 : 32}px)` }}
        >
          <p className="text-h1 text-[var(--text-primary)]" style={{ fontWeight: 700 }}>
            생일을 선택해주세요
          </p>
        </div>

        <div className="px-[var(--page-padding-x)] pt-8">
          <div className="flex gap-3">
            <FieldButton
              label={month !== null ? `${month}월` : '월'}
              filled={monthFilled}
              active={monthActive}
              expanded={openField === 'month'}
              hasPopup="listbox"
              onClick={() => setOpenField('month')}
            />
            <FieldButton
              label={day !== null ? `${day}일` : '일'}
              filled={dayFilled}
              active={dayActive}
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
