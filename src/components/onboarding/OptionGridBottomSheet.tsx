'use client';

import BottomSheet from '@/components/ui/BottomSheet';

interface Option {
  value: number;
  label: string;
}

interface OptionGridBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  selectedValue: number | null;
  onSelect: (value: number) => void;
  // 월(12개)은 4열, 일(최대 31개)은 5열이 한 화면에 균형 있게 들어간다.
  columns?: 4 | 5;
}

// 월/일 선택 전용 Bottom Sheet. 별도 Figma 디자인이 없어 saved/page.tsx의 품사 필터
// 칩(border-brand + surface-brand로 선택 상태 표시)과 동일한 톤의 그리드 버튼으로 구성했다.
export default function OptionGridBottomSheet({
  isOpen,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  columns = 5,
}: OptionGridBottomSheetProps) {
  const gridColsClassName = columns === 4 ? 'grid-cols-4' : 'grid-cols-5';

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div
        role="listbox"
        aria-label={title}
        className={`grid ${gridColsClassName} gap-2 px-[var(--page-padding-x)] pt-2 pb-[calc(24px+env(safe-area-inset-bottom))]`}
      >
        {options.map((option) => {
          const selected = option.value === selectedValue;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onSelect(option.value);
                onClose();
              }}
              className={[
                'flex h-12 items-center justify-center rounded-[var(--radius-md)] border-[1.5px] text-b2-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]',
                selected
                  ? 'border-[var(--border-brand)] bg-[var(--surface-brand)] text-[var(--text-brand)]'
                  : 'border-[var(--border-default)] bg-[var(--color-white)] text-[var(--text-secondary)]',
              ].join(' ')}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
