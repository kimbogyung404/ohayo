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

// 핵심 단어
export interface Vocabulary {
  id: string;
  word: string;        // 사전형 기본형
  surfaceForm: string; // 문장에 실제 등장한 형태
  reading: string;     // 히라가나 읽는 법
  meaning: string;     // 한국어 뜻 (해당 문맥 기준)
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
