'use client';

import { MouseEventHandler } from 'react';
import Button from './Button';
import Icon from './Icon';
import Logo from './Logo';

type TopNavigationProps =
  | {
      variant: 'guest';
      onLoginClick?: MouseEventHandler<HTMLButtonElement>;
      // 넘기면 로그인 버튼 왼쪽에 "의견 보내기" 버튼을 추가로 노출한다(현재 홈 화면만
      // 사용). 넘기지 않으면 기존과 동일하게 렌더링된다.
      onFeedbackClick?: () => void;
      className?: string;
    }
  | {
      variant: 'authenticated';
      onProfileClick?: MouseEventHandler<HTMLButtonElement>;
      onFeedbackClick?: () => void;
      className?: string;
    }
  | {
      variant: 'detail';
      title: string;
      onBack?: MouseEventHandler<HTMLButtonElement>;
      className?: string;
      // 상세 화면 대부분은 흰 배경(기본값)이지만, 별자리 상세(study) 화면처럼 헤더가
      // 페이지의 브랜드 배경과 이어져 보여야 하는 경우에만 'brand'를 넘긴다.
      background?: 'default' | 'brand';
    };

export default function TopNavigation(props: TopNavigationProps) {
  const { variant, className = '' } = props;

  const background =
    variant === 'detail'
      ? props.background === 'brand'
        ? 'bg-[var(--surface-brand)]'
        : 'bg-[var(--surface-default)]'
      : 'bg-[var(--surface-brand)]';

  return (
    <header className={['w-full px-[var(--page-padding-x)]', background, className].filter(Boolean).join(' ')}>
      <div className="h-16 flex items-center">
        {variant === 'guest' && (
          <div className="flex w-full items-center justify-between">
            <Logo className="w-[110px] h-auto" />
            <div className="flex items-center gap-1">
              {props.onFeedbackClick && <FeedbackTriggerButton onClick={props.onFeedbackClick} />}
              <Button hierarchy="primary" size="small" onClick={props.onLoginClick}>
                로그인
              </Button>
            </div>
          </div>
        )}

        {variant === 'authenticated' && (
          <div className="flex w-full items-center justify-between">
            <Logo className="w-[110px] h-auto" />
            <div className="flex items-center gap-1">
              {props.onFeedbackClick && <FeedbackTriggerButton onClick={props.onFeedbackClick} />}
              <button type="button" onClick={props.onProfileClick} aria-label="프로필 열기">
                <Icon name="user" size={32} />
              </button>
            </div>
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

// 로그인 여부와 무관하게 홈 화면 프로필/로그인 버튼 왼쪽에 노출되는 텍스트형 버튼.
// 저장된 단어 화면의 "단어 삭제" 진입 버튼과 같은 배경 없는 텍스트 스타일을 그대로
// 재사용해, primary CTA로 보이지 않게 한다. min-h-11(44px)로 로고·프로필 정렬은
// 그대로 두고 터치 영역만 확보한다.
function FeedbackTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-b2-medium text-[var(--text-brand)] transition-colors hover:text-[var(--brand-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand-focus)]"
    >
      의견 보내기
    </button>
  );
}
