// 별자리 ID 타입
export type ZodiacId =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

// 문장 조각 (segments 배열의 각 요소)
export interface Segment {
  text: string;
  vocabularyId: string | null;
}

// 한국어 문장 조각(korean_segments, lucky_item_ko_segments 배열의 각 요소).
// text 세그먼트는 항상 한국어 그대로 표시하고, vocabulary 세그먼트는 확인 여부에 따라
// surfaceForm(일본어, 미확인)과 koreanText(한국어 활용형, 확인 후)를 프론트에서 토글한다.
export type KoreanSegment =
  | { type: 'text'; text: string }
  | { type: 'vocabulary'; vocabularyId: string; koreanText: string };

// 단어 난이도 태그. 외부 JLPT 공식 판정이 아니라 M5(Gemini)가 스스로 선정한 의도를
// 기록한 값이다(easy=쉬운 핵심 단어 2개, challenge=도전 단어 1개). 이 필드가 생기기
// 전에 생성된 기존 데이터는 null(레거시, 난이도 불명).
export type VocabularyDifficulty = 'easy' | 'challenge';

// 핵심 단어
export interface Vocabulary {
  id: string;
  word: string;        // 사전형 기본형
  surfaceForm: string; // 문장에 실제 등장한 형태
  reading: string;     // 히라가나 읽는 법
  meaning: string;     // 한국어 뜻 (해당 문맥 기준)
  // 이 필드가 생기기 전의 호출부(mock 데이터, 저장한 단어 조회 등)에 영향을 주지
  // 않도록 optional로 둔다. 값이 있으면 difficulty, 레거시/미조회 시 undefined.
  difficulty?: VocabularyDifficulty | null;
}

// 세부 운세 카테고리. 공식 오하아사 소스에는 없는 항목이며, M5가 original_text의
// 분위기를 근거로 보충 생성한다(공식 원문이 아니다).
export type FortuneDetailCategory = 'love' | 'money' | 'work';

// 세부 운세 1개 항목. koreanSegments는 korean_segments/lucky_item_ko_segments와 동일한
// 방식으로 M5가 결정론적으로 조립하며, 조립 결과는 koreanTranslation과 글자 단위로
// 완전히 동일해야 한다.
export interface FortuneDetailEntry {
  category: FortuneDetailCategory;
  japaneseText: string;
  koreanTranslation: string;
  koreanSegments: KoreanSegment[];
}

// 별자리 운세 데이터 (AI 처리 완료 상태)
export interface Fortune {
  id: string;
  date: string;           // YYYY-MM-DD
  zodiacId: ZodiacId;
  zodiacJapanese: string;
  zodiacKorean: string;
  rank: number;           // 1~12
  originalText: string;   // 일본어 원문
  readingText: string;    // 전체 읽는 법
  koreanTranslation: string;
  luckyItem: string;
  segments: Segment[];
  koreanSegments: KoreanSegment[] | null;       // 백필 전이거나 생성 실패 시 null
  luckyItemKo: string | null;                   // 한국어 번역 데이터가 없으면 null
  luckyItemKoSegments: KoreanSegment[] | null;   // 백필 전이거나 생성 실패 시 null
  detailFortunes: FortuneDetailEntry[] | null;   // AI 보충 세부 운세 3종. 미생성/실패 시 null
  vocabulary: Vocabulary[];
  sourceUrl: string;
  sourceDate: string;     // 원본 페이지 날짜
  aiStatus: 'pending' | 'success' | 'failed';
}

// 홈 화면용 별자리 순위 목록 아이템
export interface ZodiacRankItem {
  zodiacId: ZodiacId;
  zodiacJapanese: string;
  zodiacKorean: string;
  rank: number;
  luckyItem: string;
}
