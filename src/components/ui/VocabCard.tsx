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
      mode: 'flip';
      revealed: false;
      word: string;
      onFlip: () => void;
      className?: string;
    }
  | {
      mode: 'flip';
      revealed: true;
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
function PlayAudioButton({ onPlayAudio }: { onPlayAudio: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlayAudio}
      aria-label="발음 듣기"
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

  if (props.mode === 'flip' && !props.revealed) {
    return (
      <button
        type="button"
        onClick={props.onFlip}
        aria-expanded={false}
        className={[
          'flex w-full min-h-[132px] flex-col items-center justify-center gap-3',
          'rounded-[var(--radius-lg)] border-[1.5px] border-[var(--border-default)] bg-[var(--surface-subtle)] p-5',
          rootClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <p className="text-jp-h1 w-full text-center text-[var(--text-primary)]" lang="ja">
          {props.word}
        </p>
        <p className="text-b2-medium text-left text-[var(--text-tertiary)]">
          뜻을 떠올린 뒤, 카드를 뒤집어보세요
        </p>
      </button>
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

  // mode === 'flip' && revealed === true
  const { word, meaning, onFlip, onPlayAudio } = props;
  return (
    <div
      className={[
        'relative w-full min-h-[132px] rounded-[var(--radius-lg)] bg-[var(--color-white)] p-5',
        'border-[1.5px] border-[var(--border-default)]',
        rootClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" onClick={onFlip} aria-expanded={true} className="flex w-full flex-col gap-3">
        <p className="text-jp-h1 w-full text-center text-[var(--text-primary)]" lang="ja">
          {word}
        </p>
        <p className="text-b2-medium w-full text-center text-[var(--text-secondary)]">{meaning}</p>
      </button>

      <button
        type="button"
        onClick={onPlayAudio}
        aria-label="발음 듣기"
        className="mt-1 flex items-center gap-1"
      >
        <Icon name="volume" size={24} className="text-[var(--brand-primary)]" />
        <span className="text-caption text-[var(--text-brand)]">발음 듣기</span>
      </button>
    </div>
  );
}
