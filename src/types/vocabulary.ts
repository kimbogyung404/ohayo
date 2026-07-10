import type { Vocabulary } from './fortune';

// 사용자가 저장한 단어 (로컬 상태)
export interface SavedWord {
  id: string;                    // saved_vocabulary UUID (M2에서 Supabase ID)
  vocabularyId: string;
  vocabulary: Vocabulary;
  fortuneDate: string;           // 단어가 속한 운세 날짜
  zodiacKorean: string;          // 단어가 속한 별자리 한국어명
  originalText: string;          // 단어가 속한 운세 원문
  koreanTranslation: string;     // 운세 원문의 한국어 해석
  savedAt: string;               // ISO 8601
}

// 단어 저장 상태
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaving' | 'error';
