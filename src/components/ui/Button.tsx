'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonHierarchy = 'primary' | 'secondary';
type ButtonState = 'default' | 'hover' | 'pressed' | 'disabled';
type ButtonSize = 'large' | 'medium' | 'small';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hierarchy?: ButtonHierarchy;
  state?: ButtonState;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

const hierarchyStyles: Record<ButtonHierarchy, string> = {
  primary:
    'bg-[var(--brand-primary)] text-[var(--text-inverse)] hover:bg-[var(--brand-hover)] active:bg-[var(--brand-pressed)] disabled:bg-[var(--gray-100)] disabled:text-[var(--text-disabled)]',
  secondary:
    'bg-[var(--gray-100)] text-[var(--text-secondary)] disabled:text-[var(--text-disabled)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  large: 'h-[var(--button-height-large)] text-b1-semibold px-6 rounded-[var(--radius-md)]',
  medium: 'h-[var(--button-height-medium)] text-b1-medium px-5 rounded-[var(--radius-md)]',
  small: 'text-b2-medium p-[10px] rounded-[var(--radius-md)]',
};

// Small CTA(Figma)의 Secondary/Default만 large·medium의 secondary(회색)와 배색이 달라 별도 적용
const secondarySmallStyles = 'bg-[var(--surface-brand)] text-[var(--text-brand)]';

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      hierarchy = 'primary',
      state = 'default',
      size = 'medium',
      fullWidth = false,
      loading = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading || state === 'disabled';
    const hierarchyClassName =
      hierarchy === 'secondary' && size === 'small' ? secondarySmallStyles : hierarchyStyles[hierarchy];
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center gap-2',
          'font-[var(--font-primary)] cursor-pointer select-none touch-manipulation',
          'transition-colors duration-[var(--transition-fast)] active:duration-0',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed',
          hierarchyClassName,
          sizeStyles[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading ? (
          <span
            className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
