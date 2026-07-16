'use client';

import Icon from './Icon';

type VocabCardProps =
  | {
      // 상세 학습 화면의 단어 오버레이 전용: 뒤집기 없이 항상 앞면만 보여준다
      // (일본어 단어 + 읽는 법 + 한국어 뜻 + 발음 듣기).
      mode: 'front';
      word: string;
      reading?: string;
      meaning?: string;
      onPlayAudio: () => void;
      className?: string;
    }
  | {
      // 앞면·뒷면을 항상 같은 영역에 겹쳐 렌더링하고 Y축으로 회전시켜 전환한다
      // (VocabCard.tsx의 flip-card-* 유틸리티, globals.css 참고).
      mode: 'flip';
      revealed: boolean;
      word: string;
      meaning: string;
      onFlip: () => void;
      onPlayAudio: () => void;
      className?: string;
    }
  | {
      mode: 'select';
      selected: boolean;
      word: string;
      reading?: string;
      meaning: string;
      onSelect: () => void;
      onPlayAudio: () => void;
      className?: string;
    };

// 발음 듣기 버튼: 아이콘+문구를 유지한 채 카드 우측으로 정렬한다.
// 부모가 flex flex-col일 때 self-end로 교차축(가로) 끝에 붙는다.
// stopPropagation: flip 뒷면처럼 카드 본문 클릭이 곧 상위 onClick(뒤집기)인 맥락에서,
// 발음 듣기 클릭이 그 상위로 버블링되어 함께 뒤집히는 것을 막는다.
// tabIndex: 회전으로 숨겨진 면 안의 버튼은 -1로 탭 순서에서 제외한다(aria-hidden 부모와 짝).
function PlayAudioButton({
  onPlayAudio,
  stopPropagation = false,
  tabIndex,
}: {
  onPlayAudio: () => void;
  stopPropagation?: boolean;
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onPlayAudio();
      }}
      aria-label="발음 듣기"
      tabIndex={tabIndex}
      className="mt-1 flex shrink-0 items-center gap-1 self-end"
    >
      <Icon name="volume" size={24} className="text-[var(--brand-primary)]" />
      <span className="text-caption text-[var(--text-brand)]">발음 듣기</span>
    </button>
  );
}

export default function VocabCard(props: VocabCardProps) {
  const rootClassName = props.className ?? '';

  if (props.mode === 'front') {
    const { word, reading, meaning, onPlayAudio } = props;
    return (
      <div
        className={[
          'flex w-full min-h-[132px] flex-col items-center gap-3',
          'rounded-[var(--radius-lg)] border-[1.5px] border-[var(--border-default)] bg-[var(--color-white)] p-5',
          rootClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p className="text-jp-h1 w-full text-center text-[var(--text-primary)]" lang="ja">
          {word}
        </p>
        {reading && (
          <p className="text-b2-medium w-full text-center text-[var(--text-tertiary)]" lang="ja">
            {reading}
          </p>
        )}
        {meaning && (
          <p className="text-b2-medium w-full text-center text-[var(--text-secondary)]">{meaning}</p>
        )}
        <PlayAudioButton onPlayAudio={onPlayAudio} />
      </div>
    );
  }

  if (props.mode === 'flip') {
    const { revealed, word, meaning, onFlip, onPlayAudio } = props;
    return (
      <div className={['flip-card-outer', rootClassName].filter(Boolean).join(' ')}>
        <div className="flip-card-inner" data-revealed={revealed}>
          {/* 앞면 */}
          <button
            type="button"
            onClick={onFlip}
            aria-expanded={revealed}
            aria-hidden={revealed}
            tabIndex={revealed ? -1 : 0}
            className={[
              'flip-card-face flip-card-front flex flex-col items-center justify-center gap-3',
              'rounded-[var(--radius-lg)] border-[1.5px] border-[var(--border-default)] bg-[var(--surface-subtle)] p-5',
              revealed ? 'pointer-events-none' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="text-jp-h1 w-full text-center text-[var(--text-primary)]" lang="ja">
              {word}
            </p>
            <p className="text-b2-medium text-left text-[var(--text-tertiary)]">
              뜻을 떠올린 뒤, 카드를 뒤집어보세요
            </p>
          </button>

          {/* 뒷면: 카드 본문(단어+뜻) 어디를 눌러도 뒤집히고, 발음 듣기만 stopPropagation으로 예외 처리한다 */}
          <div
            role="button"
            tabIndex={revealed ? 0 : -1}
            onClick={onFlip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFlip();
              }
            }}
            aria-expanded={revealed}
            aria-hidden={!revealed}
            className={[
              'flip-card-face flip-card-back flex flex-col cursor-pointer',
              'rounded-[var(--radius-lg)] border-[1.5px] border-[var(--border-default)] bg-[var(--color-white)] p-5',
              !revealed ? 'pointer-events-none' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="text-jp-h1 w-full text-center text-[var(--text-primary)]" lang="ja">
              {word}
            </p>
            <p className="text-b2-medium w-full text-center text-[var(--text-secondary)]">{meaning}</p>
            <PlayAudioButton onPlayAudio={onPlayAudio} stopPropagation tabIndex={revealed ? 0 : -1} />
          </div>
        </div>
      </div>
    );
  }

  if (props.mode === 'select') {
    const { selected, word, reading, meaning, onSelect, onPlayAudio } = props;
    return (
      <div
        className={[
          'relative flex w-full min-h-[132px] flex-col rounded-[var(--radius-lg)] bg-[var(--color-white)] pl-5 pr-3 py-5',
          selected ? 'border border-[var(--border-brand)]' : 'border-[1.5px] border-[var(--border-default)]',
          rootClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="relative flex w-full flex-col gap-3 pr-6"
        >
          <p className="text-jp-h1 w-full text-center text-[var(--text-primary)]" lang="ja">
            {word}
          </p>
          {reading && (
            <p className="text-b2-medium w-full text-center text-[var(--text-tertiary)]" lang="ja">
              {reading}
            </p>
          )}
          <p className="text-b2-medium w-full text-center text-[var(--text-secondary)]">{meaning}</p>
          <Icon
            name="check"
            size={24}
            aria-hidden="true"
            className={[
              'absolute right-0 top-0',
              selected ? 'text-[var(--border-brand)]' : 'text-[var(--border-strong)]',
            ].join(' ')}
          />
        </button>

        <PlayAudioButton onPlayAudio={onPlayAudio} />
      </div>
    );
  }
}
