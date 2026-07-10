'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'large' | 'medium';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--brand-primary)] text-[var(--text-inverse)] hover:bg-[var(--brand-hover)] active:bg-[var(--brand-pressed)] disabled:bg-[var(--gray-100)] disabled:text-[var(--text-disabled)]',
  secondary:
    'bg-[var(--surface-default)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--surface-subtle)] active:bg-[var(--gray-100)] disabled:opacity-50',
  ghost:
    'bg-transparent text-[var(--text-brand)] hover:bg-[var(--surface-brand)] active:bg-[var(--brand-subtle)] disabled:opacity-50',
  danger:
    'bg-[var(--color-error)] text-[var(--text-inverse)] hover:opacity-90 active:opacity-80 disabled:opacity-50',
};

const sizeStyles: Record<ButtonSize, string> = {
  large: 'h-[52px] text-b1-semibold px-6 rounded-[var(--radius-lg)]',
  medium: 'h-[48px] text-b1-medium px-5 rounded-[var(--radius-lg)]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
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
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center gap-2',
          'font-[var(--font-primary)] cursor-pointer select-none',
          'transition-colors duration-[var(--transition-fast)]',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)] focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed',
          variantStyles[variant],
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
