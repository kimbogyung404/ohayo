'use client';

import { MouseEventHandler } from 'react';
import Button from './Button';
import Icon from './Icon';
import Logo from './Logo';

type TopNavigationProps =
  | { variant: 'guest'; onLoginClick?: MouseEventHandler<HTMLButtonElement>; className?: string }
  | { variant: 'authenticated'; onProfileClick?: MouseEventHandler<HTMLButtonElement>; className?: string }
  | { variant: 'detail'; title: string; onBack?: MouseEventHandler<HTMLButtonElement>; className?: string };

export default function TopNavigation(props: TopNavigationProps) {
  const { variant, className = '' } = props;

  const background = variant === 'detail' ? 'bg-[var(--surface-default)]' : 'bg-[var(--surface-brand)]';

  return (
    <header className={['w-full px-[var(--page-padding-x)]', background, className].filter(Boolean).join(' ')}>
      <div className="h-16 flex items-center">
        {variant === 'guest' && (
          <div className="flex w-full items-center justify-between">
            <Logo className="h-[22px] w-auto" />
            <Button hierarchy="primary" size="small" onClick={props.onLoginClick}>
              로그인
            </Button>
          </div>
        )}

        {variant === 'authenticated' && (
          <div className="flex w-full items-center justify-between">
            <Logo className="h-[22px] w-auto" />
            <button type="button" onClick={props.onProfileClick} aria-label="프로필 열기">
              <Icon name="user" size={32} />
            </button>
          </div>
        )}

        {variant === 'detail' && (
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
            <button type="button" onClick={props.onBack} aria-label="뒤로가기" className="justify-self-start">
              <Icon name="chevron-left" size={24} />
            </button>
            <h1 className="justify-self-center text-b1-semibold text-[var(--text-primary)]">{props.title}</h1>
          </div>
        )}
      </div>
    </header>
  );
}
