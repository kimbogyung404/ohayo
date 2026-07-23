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
            {/* 버튼 자체의 레이아웃 박스는 아이콘과 동일한 24×24px로 그대로 두어(그리드
                컬럼 너비·제목 중앙 정렬에 전혀 영향을 주지 않음), 안에 보이지 않는
                44×44px 히트 영역만 absolute로 겹쳐 확장한다. absolute 요소는 일반
                흐름에서 빠지므로 헤더 높이·정렬·좌우 여백은 그대로 유지된다. 클릭
                이벤트는 아이콘이 아니라 이 button 요소 전체(히트 영역 포함)에 걸려
                있다. */}
            <button
              type="button"
              onClick={props.onBack}
              aria-label="뒤로가기"
              className="relative flex h-6 w-6 items-center justify-center justify-self-start"
            >
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2"
              />
              <Icon name="chevron-left" size={24} />
            </button>
            <h1 className="justify-self-center text-b1-semibold text-[var(--text-primary)]">{props.title}</h1>
          </div>
        )}
      </div>
    </header>
  );
}
