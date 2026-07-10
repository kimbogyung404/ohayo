'use client';

import { useCallback, useState } from 'react';
import type { SavedWord } from '@/types/vocabulary';
import type { Fortune } from '@/types/fortune';

// M1: localStorage로 저장 단어 관리
// M2: Supabase saved_vocabulary 테이블로 교체 예정
const STORAGE_KEY = 'ohayo_saved_vocabulary';

function loadFromStorage(): SavedWord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedWord[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(words: SavedWord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch {
    // 저장 실패 무시 (quota exceeded 등)
  }
}

export function useSavedVocabulary() {
  // lazy initializer로 초기 로드 (SSR 안전: window 체크 포함)
  const [savedWords, setSavedWords] = useState<SavedWord[]>(() => loadFromStorage());
  const isLoaded = true; // lazy init이므로 즉시 로드 완료

  // 저장 여부 확인
  const isSaved = useCallback(
    (vocabularyId: string) => savedWords.some((w) => w.vocabularyId === vocabularyId),
    [savedWords]
  );

  // 단어 저장
  const saveWord = useCallback(
    (fortune: Fortune, vocabularyId: string) => {
      const vocab = fortune.vocabulary.find((v) => v.id === vocabularyId);
      if (!vocab) return;

      setSavedWords((prev) => {
        if (prev.some((w) => w.vocabularyId === vocabularyId)) return prev; // 중복 방지

        const newWord: SavedWord = {
          id: `local_${vocabularyId}_${Date.now()}`,
          vocabularyId,
          vocabulary: vocab,
          fortuneDate: fortune.date,
          zodiacKorean: fortune.zodiacKorean,
          originalText: fortune.originalText,
          koreanTranslation: fortune.koreanTranslation,
          savedAt: new Date().toISOString(),
        };
        const updated = [...prev, newWord];
        saveToStorage(updated);
        return updated;
      });
    },
    []
  );

  // 저장 해제
  const unsaveWord = useCallback((vocabularyId: string) => {
    setSavedWords((prev) => {
      const updated = prev.filter((w) => w.vocabularyId !== vocabularyId);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  return { savedWords, isSaved, saveWord, unsaveWord, isLoaded };
}
