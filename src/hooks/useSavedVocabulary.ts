'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { SavedWord } from '@/types/vocabulary';

type SaveResult = { error: 'not_logged_in' | 'save_failed' | 'unsave_failed' | null };

interface SavedVocabularyRow {
  id: string;
  vocabulary_id: string;
  saved_at: string;
  vocabulary: {
    id: string;
    word: string;
    surface_form: string;
    reading: string;
    meaning: string;
    fortune: {
      date: string;
      zodiac_korean: string;
      original_text: string;
      korean_translation: string;
    } | null;
  } | null;
}

interface FetchResult {
  words: SavedWord[];
  error: boolean;
}

// 순수 조회 함수: setState를 포함하지 않고 결과와 에러 여부만 반환한다.
// 예외가 발생해도 항상 resolve하므로 호출부에서 무한 대기가 생기지 않는다.
async function fetchSavedWords(
  supabase: SupabaseClient,
  userId: string
): Promise<FetchResult> {
  try {
    const { data, error } = await supabase
      .from('saved_vocabulary')
      .select(
        `id, vocabulary_id, saved_at,
         vocabulary:vocabulary_id (
           id, word, surface_form, reading, meaning,
           fortune:fortune_id ( date, zodiac_korean, original_text, korean_translation )
         )`
      )
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
      .returns<SavedVocabularyRow[]>();

    if (error || !data) {
      return { words: [], error: true };
    }

    const words: SavedWord[] = data
      .filter((row) => row.vocabulary && row.vocabulary.fortune)
      .map((row) => ({
        id: row.id,
        vocabularyId: row.vocabulary_id,
        vocabulary: {
          id: row.vocabulary!.id,
          word: row.vocabulary!.word,
          surfaceForm: row.vocabulary!.surface_form,
          reading: row.vocabulary!.reading,
          meaning: row.vocabulary!.meaning,
        },
        fortuneDate: row.vocabulary!.fortune!.date,
        zodiacKorean: row.vocabulary!.fortune!.zodiac_korean,
        originalText: row.vocabulary!.fortune!.original_text,
        koreanTranslation: row.vocabulary!.fortune!.korean_translation,
        savedAt: row.saved_at,
      }));

    return { words, error: false };
  } catch {
    return { words: [], error: true };
  }
}

// M2: saved_vocabulary 테이블 기반 저장 단어 관리 (RLS로 본인 데이터만 접근)
//
// 구조:
// - fetchSavedWords: setState 없는 순수 조회 함수 (아래 두 곳에서 공통으로 사용)
// - 마운트/userId 변경 시 초기 로딩은 useEffect 안에서 완결한다.
//   (react-hooks/set-state-in-effect 규칙 때문에 외부 useCallback을
//    effect에서 직접 호출하지 않고, effect 내부에 로직을 인라인한다.)
// - refresh는 saveWord/unsaveWord 이후 수동 재조회를 위해 정확히 한 번만 선언한다.
//   (effect 안에서는 절대 호출하지 않는다.)
export function useSavedVocabulary(userId: string | null) {
  const [supabase] = useState(() => createClient());
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // 언마운트 이후 setState를 막기 위한 가드
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 초기 로딩 (userId가 바뀔 때마다 재실행)
  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!userId) {
        if (!ignore && isMountedRef.current) {
          setSavedWords([]);
          setLoadError(false);
          setIsLoaded(true);
        }
        return;
      }

      if (!ignore && isMountedRef.current) {
        setIsLoaded(false);
      }

      const { words, error } = await fetchSavedWords(supabase, userId);

      // effect가 이미 취소됐거나(userId 변경 등) 컴포넌트가 언마운트됐으면 반영하지 않는다.
      if (ignore || !isMountedRef.current) return;

      // error와 savedWords(빈 배열 포함)는 항상 함께 갱신해 두 상태가 섞이지 않게 한다.
      if (error) {
        setLoadError(true);
      } else {
        setSavedWords(words);
        setLoadError(false);
      }
      setIsLoaded(true);
    }

    load();
    return () => {
      ignore = true;
    };
  }, [supabase, userId]);

  const isSaved = useCallback(
    (vocabularyId: string) => savedWords.some((w) => w.vocabularyId === vocabularyId),
    [savedWords]
  );

  // 저장/저장 해제 이후, 그리고 조회 실패 화면의 "다시 시도" 버튼에서 재사용한다.
  // useEffect 밖(이벤트 핸들러)에서만 호출한다.
  const refresh = useCallback(async () => {
    if (!userId) return;

    const { words, error } = await fetchSavedWords(supabase, userId);
    if (!isMountedRef.current) return;

    // error와 savedWords는 항상 함께 갱신해 두 상태가 섞이지 않게 한다.
    if (error) {
      setLoadError(true);
    } else {
      setSavedWords(words);
      setLoadError(false);
    }
    setIsLoaded(true);
  }, [supabase, userId]);

  const saveWord = useCallback(
    async (vocabularyId: string): Promise<SaveResult> => {
      if (!userId) return { error: 'not_logged_in' };
      if (isSaved(vocabularyId)) return { error: null }; // 중복 저장 방지: 기존 상태 유지

      const { error } = await supabase
        .from('saved_vocabulary')
        .insert({ user_id: userId, vocabulary_id: vocabularyId });

      // 23505 = unique_violation (동시 요청 등으로 이미 저장된 경우) -> 실패로 취급하지 않는다
      if (error && error.code !== '23505') {
        return { error: 'save_failed' };
      }
      await refresh();
      return { error: null };
    },
    [supabase, userId, isSaved, refresh]
  );

  const unsaveWord = useCallback(
    async (vocabularyId: string): Promise<SaveResult> => {
      if (!userId) return { error: 'not_logged_in' };

      const { error } = await supabase
        .from('saved_vocabulary')
        .delete()
        .eq('user_id', userId)
        .eq('vocabulary_id', vocabularyId);

      if (error) return { error: 'unsave_failed' };
      await refresh();
      return { error: null };
    },
    [supabase, userId, refresh]
  );

  return { savedWords, isSaved, saveWord, unsaveWord, isLoaded, loadError, refresh };
}
