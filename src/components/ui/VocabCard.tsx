'use client';

import Icon from './Icon';
import type { PartOfSpeech } from '@/types/fortune';

// DB의 partOfSpeech 값 → 카드에 표시할 한국어 라벨. 이 맵에 없는 값(레거시 null 포함)은
// 호출부에서 partOfSpeech를 아예 넘기지 않아 품사 영역 자체가 생략된다.
const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, string> = {
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  expression: '표현',
};

type VocabCardProps =
  | {
      // 상세 학습 화면의 단어 오버레이 전용: 뒤집기 없이 항상 공용 정보 면만 보여준다.
      // knowledge/onRespond를 함께 넘기면 "잘 알아요"/"몰라요" 응답 버튼이 하단에
      // 추가된다(study 단계 확인 흐름 전용). 넘기지 않으면 버튼 없이 정보 면만 표시한다.
      mode: 'front';
      word: string;
      reading?: string;
      meaning?: string;
      partOfSpeech?: PartOfSpeech | null;
      onPlayAudio: () => void;
      className?: string;
      knowledge?: 'known' | 'unknown' | null;
      onRespond?: (knowledge: 'known' | 'unknown') => void;
    }
  | {
      // 앞면(퀴즈 상태: 단어만)·뒷면(공용 정보 면 + 오늘 운세 속 문장)을 같은 영역에
      // 겹쳐 렌더링하고 Y축으로 회전시켜 전환한다(flip-card-* 유틸리티, globals.css 참고).
      // 앞면은 의도적으로 공용 정보 면을 쓰지 않는다 — 뜻을 먼저 떠올려보게 하기 위함.
      // partOfSpeech/sourceSentence*는 뒷면에만 반영되며 앞면 퀴즈 UI는 절대 바뀌지 않는다.
      mode: 'flip';
      revealed: boolean;
      word: string;
      reading?: string;
      meaning: string;
      partOfSpeech?: PartOfSpeech | null;
      // 셋 중 하나라도 없으면(레거시 데이터) "오늘 운세 속 문장" 섹션 전체를 숨긴다.
      sourceSentence?: string | null;
      sourceSentenceReading?: string | null;
      sourceSentenceTranslation?: string | null;
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
      partOfSpeech?: PartOfSpeech | null;
      onSelect: () => void;
      onPlayAudio: () => void;
      className?: string;
    };

// 발음 듣기 버튼: 아이콘+문구를 유지한 채 카드 우측 하단으로 정렬한다.
// 부모가 flex flex-col일 때 self-end로 교차축(가로) 끝에 붙는다.
// stopPropagation: 카드 본문 클릭이 곧 상위 onClick(뒤집기/선택)인 맥락에서,
// 발음 듣기 클릭이 그 상위로 버블링되어 함께 동작하는 것을 막는다.
// tabIndex: 화면에서 숨겨진 면 안의 버튼은 -1로 탭 순서에서 제외한다(aria-hidden 부모와 짝).
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

// 모든 단어 카드(mode="front" / "select" / flip 뒷면)가 공유하는 단 하나의 정보 면.
// 순서: 읽는 법 → 일본어 단어 → 품사·한국어 뜻(한 줄) → 발음 듣기(우측 하단).
// 읽는 법은 단어 바로 위, 좁은 간격(gap-1)으로 묶어 시각적으로 한 덩어리처럼 보이게 한다
// (전체 세로 리듬은 기존과 동일한 gap-3 유지). reading이 없으면 그 줄만 생략되고
// 빈 공간이 남지 않는다(묶음 안에 단어만 남음). partOfSpeech가 없으면(레거시 null
// 포함) 품사 라벨과 "·" 구분점 없이 뜻만 표시한다. 화면별로 이 레이아웃을 다시 만들지
// 말고 항상 이 컴포넌트를 재사용한다.
function VocabCardContent({
  word,
  reading,
  meaning,
  partOfSpeech,
  onPlayAudio,
  stopAudioPropagation,
  audioTabIndex,
}: {
  word: string;
  reading?: string;
  meaning?: string;
  partOfSpeech?: PartOfSpeech | null;
  onPlayAudio: () => void;
  stopAudioPropagation?: boolean;
  audioTabIndex?: number;
}) {
  const partOfSpeechLabel = partOfSpeech ? PART_OF_SPEECH_LABELS[partOfSpeech] : null;
  const meaningLine = meaning ? (partOfSpeechLabel ? `${partOfSpeechLabel} · ${meaning}` : meaning) : null;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full flex-col items-center gap-1">
        {reading && (
          <p className="text-b2-medium w-full text-center text-[var(--text-tertiary)]" lang="ja">
            {reading}
          </p>
        )}
        <p className="text-jp-h1 w-full text-center text-[var(--text-primary)]" lang="ja">
          {word}
        </p>
      </div>
      {meaningLine && <p className="text-b2-medium w-full text-center text-[var(--text-secondary)]">{meaningLine}</p>}
      <PlayAudioButton onPlayAudio={onPlayAudio} stopPropagation={stopAudioPropagation} tabIndex={audioTabIndex} />
    </div>
  );
}

// 단어 확인 응답 버튼("잘 알아요"/"몰라요"). 두 선택지는 동일한 위계로 표현한다 —
// 하나를 primary로 강조하지 않는다(complete 단계의 학습 피드백 버튼과 같은
// active/inactive 토큰 조합을 재사용한다).
function KnowledgeResponseButtons({
  knowledge,
  onRespond,
}: {
  knowledge: 'known' | 'unknown' | null | undefined;
  onRespond: (knowledge: 'known' | 'unknown') => void;
}) {
  const options: { value: 'known' | 'unknown'; label: string }[] = [
    { value: 'known', label: '잘 알아요' },
    { value: 'unknown', label: '몰라요' },
  ];

  return (
    <div role="group" aria-label="단어 확인" className="flex w-full gap-3">
      {options.map((option) => {
        const active = knowledge === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onRespond(option.value)}
            className={[
              'flex-1 rounded-[var(--radius-md)] border-[1.5px] px-4 py-3 text-b2-medium',
              active
                ? 'border-[var(--border-brand)] bg-[var(--surface-brand)] text-[var(--text-brand)]'
                : 'border-[var(--border-default)] bg-[var(--color-white)] text-[var(--text-secondary)]',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// sourceSentence 안에서 surfaceForm이 정확히 한 번 등장할 때만 앞/단어/뒷부분으로
// 나눈다. 0회 또는 2회 이상이면 위치를 임의로 정하지 않고 null을 반환해 문장을
// 일반 텍스트로만 표시하게 한다.
function splitOnUniqueOccurrence(
  sentence: string,
  target: string
): { before: string; match: string; after: string } | null {
  if (!target) return null;
  const firstIndex = sentence.indexOf(target);
  if (firstIndex === -1) return null;
  if (sentence.indexOf(target, firstIndex + 1) !== -1) return null; // 2회 이상 등장

  return {
    before: sentence.slice(0, firstIndex),
    match: sentence.slice(firstIndex, firstIndex + target.length),
    after: sentence.slice(firstIndex + target.length),
  };
}

// 저장 단어 플립 카드 뒷면 전용 "오늘 운세 속 문장" 섹션. 새 문장을 만들지 않고
// DB에 저장된 sourceSentence/Reading/Translation을 그대로 보여준다. 위 공용 정보
// 면(VocabCardContent)과 시각적으로 구분되도록 얇은 구분선(기존 border 토큰)만
// 추가하고, 별도의 회색 박스나 그림자는 넣지 않는다. 라벨은 caption(보조 위계),
// 문장은 원문 → 읽는 법(작게, 보조 색상) → 번역 순으로 카드 안 다른 텍스트와 같은
// 가운데 정렬을 유지한다. 클릭 가능한 하이라이트가 아니라 순수 <span> 강조이며,
// 이 영역을 눌러도 상위 role="button"(카드 뒤집기)으로 그대로 버블링된다.
function SourceSentenceSection({
  surfaceForm,
  sourceSentence,
  sourceSentenceReading,
  sourceSentenceTranslation,
}: {
  surfaceForm: string;
  sourceSentence: string;
  sourceSentenceReading: string;
  sourceSentenceTranslation: string;
}) {
  const split = splitOnUniqueOccurrence(sourceSentence, surfaceForm);

  return (
    <div className="mt-4 w-full border-t border-[var(--border-default)] pt-4">
      <p className="text-caption font-semibold tracking-wide text-[var(--text-tertiary)]">
        오늘 운세 속 문장
      </p>
      <p className="text-b2-medium mt-2 w-full text-center text-[var(--text-primary)]" lang="ja">
        {split ? (
          <>
            {split.before}
            <span className="rounded-[var(--radius-sm)] bg-[var(--surface-brand)] px-1 text-[var(--brand-primary)]">
              {split.match}
            </span>
            {split.after}
          </>
        ) : (
          sourceSentence
        )}
      </p>
      <p className="text-caption mt-1 w-full text-center text-[var(--text-tertiary)]" lang="ja">
        {sourceSentenceReading}
      </p>
      <p className="text-b2-medium mt-3 w-full text-center text-[var(--text-secondary)]">
        {sourceSentenceTranslation}
      </p>
    </div>
  );
}

export default function VocabCard(props: VocabCardProps) {
  const rootClassName = props.className ?? '';

  if (props.mode === 'front') {
    const { word, reading, meaning, partOfSpeech, onPlayAudio, knowledge, onRespond } = props;
    return (
      <div
        className={[
          'w-full min-h-[132px] rounded-[var(--radius-lg)] border-[1.5px] border-[var(--border-default)] bg-[var(--color-white)] p-5',
          rootClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex w-full flex-col gap-5">
          <VocabCardContent
            word={word}
            reading={reading}
            meaning={meaning}
            partOfSpeech={partOfSpeech}
            onPlayAudio={onPlayAudio}
          />
          {onRespond && <KnowledgeResponseButtons knowledge={knowledge} onRespond={onRespond} />}
        </div>
      </div>
    );
  }

  if (props.mode === 'flip') {
    const {
      revealed,
      word,
      reading,
      meaning,
      partOfSpeech,
      sourceSentence,
      sourceSentenceReading,
      sourceSentenceTranslation,
      onFlip,
      onPlayAudio,
    } = props;
    // 셋 다 있어야만 섹션을 보여준다 — 일부만 있는 레거시/불완전 데이터는 표시하지 않는다.
    const hasSourceSentenceSection = Boolean(
      sourceSentence && sourceSentenceReading && sourceSentenceTranslation
    );
    return (
      <div className={['flip-card-outer', rootClassName].filter(Boolean).join(' ')}>
        <div className="flip-card-inner" data-revealed={revealed}>
          {/* 앞면(퀴즈 상태): 공용 정보 면을 쓰지 않고 단어만 보여준다 */}
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

          {/* 뒷면: 공용 정보 면(VocabCardContent) 재사용. 카드 본문 어디를 눌러도 뒤집히고,
              발음 듣기만 stopPropagation으로 예외 처리한다 */}
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
            <VocabCardContent
              word={word}
              reading={reading}
              meaning={meaning}
              partOfSpeech={partOfSpeech}
              onPlayAudio={onPlayAudio}
              stopAudioPropagation
              audioTabIndex={revealed ? 0 : -1}
            />
            {hasSourceSentenceSection && (
              <SourceSentenceSection
                surfaceForm={word}
                sourceSentence={sourceSentence as string}
                sourceSentenceReading={sourceSentenceReading as string}
                sourceSentenceTranslation={sourceSentenceTranslation as string}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // mode === 'select'
  const { selected, word, reading, meaning, partOfSpeech, onSelect, onPlayAudio } = props;
  return (
    <div
      className={[
        'relative w-full min-h-[132px] rounded-[var(--radius-lg)] bg-[var(--color-white)] pl-5 pr-3 py-5',
        selected ? 'border border-[var(--border-brand)]' : 'border-[1.5px] border-[var(--border-default)]',
        rootClassName,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 공용 정보 면(VocabCardContent)을 감싸는 선택 영역. div+role="button"인 이유는
          VocabCardContent 내부에 이미 실제 <button>(발음 듣기)이 있어 <button> 중첩을
          피해야 하기 때문이다(flip 뒷면과 동일한 이유). */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        aria-pressed={selected}
        className="relative w-full cursor-pointer pr-6"
      >
        <VocabCardContent
          word={word}
          reading={reading}
          meaning={meaning}
          partOfSpeech={partOfSpeech}
          onPlayAudio={onPlayAudio}
          stopAudioPropagation
        />
        <Icon
          name="check"
          size={24}
          aria-hidden="true"
          className={[
            'absolute right-0 top-0',
            selected ? 'text-[var(--border-brand)]' : 'text-[var(--border-strong)]',
          ].join(' ')}
        />
      </div>
    </div>
  );
}
