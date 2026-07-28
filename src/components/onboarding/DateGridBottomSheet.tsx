'use client';

import { useState } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import Icon from '@/components/ui/Icon';
import { daysInMonth } from '@/lib/birthday';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const COLUMNS = 7;

interface DateGridBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // 이 시트는 일만 고른다 — 월이 아직 선택되지 않았으면(§ 원본 동작과 동일) 31일까지
  // 보여준다. 연도를 받지 않는 서비스라 실제 요일은 계산하지 않는다(§3).
  month: number | null;
  // 확정된 일(없으면 Empty State) — 열릴 때 draft의 시작 위치로만 쓰인다.
  day: number | null;
  onConfirm: (day: number) => void;
}

// 생일의 "일"을 고르는 캘린더형 7열 날짜 그리드 Bottom Sheet. 요일 헤더(일~토)는
// 첨부 이미지의 시각적 구조만 참고한 장식 요소이며, 실제 연도의 요일과는 무관하게
// 1일부터 그 달의 마지막 날짜까지 그리드에 순서대로(왼쪽 위부터) 채운다. 남는
// 칸은 앞이 아니라 마지막 행 뒤쪽에만 빈 칸으로 둔다(§3).
export default function DateGridBottomSheet({ isOpen, onClose, month, day, onConfirm }: DateGridBottomSheetProps) {
  const dayCount = month !== null ? daysInMonth(month) : 31;

  const [draftDay, setDraftDay] = useState(day ?? 1);

  // 열릴 때마다 현재 확정값(없으면 1일)에서 draft를 다시 시작한다 — X로 닫고 다시
  // 열어도 이전 draft가 아니라 항상 확정 상태 기준으로 시작해야 한다. effect 대신
  // 렌더 중 이전 isOpen과 비교해 조정한다(React 공식 "prop 변경 시 state 조정"
  // 패턴 — useEffect 안의 setState는 react-hooks/set-state-in-effect 린트 에러가 남).
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDraftDay(day ?? 1);
    }
  }

  const dates = Array.from({ length: dayCount }, (_, i) => i + 1);

  const handleConfirm = () => {
    onConfirm(draftDay);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="일 선택"
      header={
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="일 선택 닫기"
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
          >
            <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2" />
            <Icon name="x" size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded px-2 py-2 text-b1-semibold text-[var(--text-brand)] transition-colors hover:text-[var(--brand-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
          >
            확인
          </button>
        </div>
      }
    >
      <div className="px-[var(--page-padding-x)] pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]">
        {/* 요일 헤더 — 장식용, 실제 요일 계산 없음(§3) */}
        <div role="presentation" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}>
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="flex items-center justify-center text-caption text-[var(--text-tertiary)]">
              {label}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 — 1일부터 순서대로, 남는 칸은 마지막 행 뒤쪽에만 */}
        <div
          role="listbox"
          aria-label="일 선택"
          className="mt-1 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        >
          {dates.map((date) => {
            const selected = date === draftDay;
            return (
              <button
                key={date}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => setDraftDay(date)}
                className={[
                  'aspect-square w-full rounded-[var(--radius-md)] text-b2-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]',
                  selected
                    ? 'bg-[var(--brand-primary)] text-[var(--text-inverse)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]',
                ].join(' ')}
              >
                {date}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
