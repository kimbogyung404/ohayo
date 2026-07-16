'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { SavedWord } from '@/types/vocabulary';

type SaveOutcome =
  | { status: 'saved' }
  | { status: 'duplicate' } // 이미 저장되어 있던 단어 (중복 저장 아님)
  | { status: 'error'; error: 'not_logged_in' | 'save_failed' };

type UnsaveOutcome =
  | { status: 'removed' }
  | { status: 'error'; error: 'not_logged_in' | 'unsave_failed' };

type BulkSaveOutcome =
  | { status: 'saved'; savedCount: number }
  | { status: 'duplicate' } // 전달받은 id가 전부 이미 저장되어 있었음
  | { status: 'error'; error: 'not_logged_in' | 'save_failed' };

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
  //
  // 훅에 전달된 userId(React state) 대신 매번 supabase.auth.getUser()로 직접
  // 확인한다. OAuth 리다이렉트 복귀 직후처럼 userId prop이 아직 갱신되지 않은
  // 시점에 호출돼도(예: saveWord 내부 호출) 항상 최신 세션 기준으로 동작하기 위함이다.
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const currentUserId = data.user?.id ?? null;
    if (!currentUserId) return;

    const { words, error } = await fetchSavedWords(supabase, currentUserId);
    if (!isMountedRef.current) return;

    // error와 savedWords는 항상 함께 갱신해 두 상태가 섞이지 않게 한다.
    if (error) {
      setLoadError(true);
    } else {
      setSavedWords(words);
      setLoadError(false);
    }
    setIsLoaded(true);
  }, [supabase]);

  const saveWord = useCallback(
    async (vocabularyId: string): Promise<SaveOutcome> => {
      // React state의 userId를 신뢰하지 않고, 저장 시점에 실제 인증 사용자를 직접 확인한다.
      // (OAuth 리다이렉트 복귀 직후에는 useAuth의 user state가 아직 최신이 아닐 수 있음)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const verifiedUserId = userData.user?.id ?? null;

      if (userError || !verifiedUserId) {
        return { status: 'error', error: 'not_logged_in' };
      }

      if (isSaved(vocabularyId)) return { status: 'duplicate' }; // 로컬에서 이미 저장 상태로 확인됨

      const { error } = await supabase
        .from('saved_vocabulary')
        .insert({ user_id: verifiedUserId, vocabulary_id: vocabularyId });

      if (error) {
        // 23505 = unique_violation: 동시 요청 등으로 서버에는 이미 저장되어 있던 경우
        // 화면 상태를 실제 저장 상태와 일치시키기 위해 refresh 후 duplicate로 반환한다.
        if (error.code === '23505') {
          await refresh();
          return { status: 'duplicate' };
        }
        console.error('[useSavedVocabulary] saveWord failed', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return { status: 'error', error: 'save_failed' };
      }

      await refresh();
      return { status: 'saved' };
    },
    [supabase, isSaved, refresh]
  );

  // 상세 화면의 "단어 복습하기" 단계에서 선택한 단어 여러 개를 한 번에 저장할 때 사용한다.
  // 이미 저장된 vocabulary_id는 insert 전에 걸러내 중복 저장을 막는다.
  const saveWords = useCallback(
    async (vocabularyIds: string[]): Promise<BulkSaveOutcome> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const verifiedUserId = userData.user?.id ?? null;

      if (userError || !verifiedUserId) {
        return { status: 'error', error: 'not_logged_in' };
      }

      const idsToInsert = vocabularyIds.filter((id) => !isSaved(id));
      if (idsToInsert.length === 0) {
        return { status: 'duplicate' };
      }

      const { error } = await supabase
        .from('saved_vocabulary')
        .insert(idsToInsert.map((vocabularyId) => ({ user_id: verifiedUserId, vocabulary_id: vocabularyId })));

      if (error) {
        // 23505 = unique_violation: 동시 요청 등으로 idsToInsert 중 일부가 이미
        // 저장되어 있던 경우. 여러 행을 한 번에 insert하는 문장은 한 행이라도 유니크
        // 제약(user_id, vocabulary_id)에 걸리면 문장 전체가 롤백되므로, 이 호출 자체는
        // 어떤 단어도 새로 저장하지 못했다 — idsToInsert가 지금 저장되어 있더라도 그건
        // 동시에 들어온 다른 요청이 저장한 것이지 이 호출이 새로 저장한 것이 아니다.
        // refresh로 화면 상태만 실제 DB와 동기화하고, 이 호출 기준으로는 새로 저장된
        // 것이 없다고 확정할 수 있으므로 duplicate로 보고한다(호출부는 complete로
        // 넘어가지 않고 review 단계를 유지한다).
        if (error.code === '23505') {
          await refresh();
          return { status: 'duplicate' };
        }
        console.error('[useSavedVocabulary] saveWords failed', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return { status: 'error', error: 'save_failed' };
      }

      await refresh();
      return { status: 'saved', savedCount: idsToInsert.length };
    },
    [supabase, isSaved, refresh]
  );

  const unsaveWord = useCallback(
    async (vocabularyId: string): Promise<UnsaveOutcome> => {
      if (!userId) return { status: 'error', error: 'not_logged_in' };

      const { error } = await supabase
        .from('saved_vocabulary')
        .delete()
        .eq('user_id', userId)
        .eq('vocabulary_id', vocabularyId);

      if (error) {
        console.error('[useSavedVocabulary] unsaveWord failed', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return { status: 'error', error: 'unsave_failed' };
      }

      await refresh();
      return { status: 'removed' };
    },
    [supabase, userId, refresh]
  );

  // 저장된 단어 화면의 삭제 선택 모드에서 여러 개를 한 번에 지울 때 사용한다.
  // vocabulary_id가 아니라 saved_vocabulary 행 자체의 id(SavedWord.id)로 지운다.
  const unsaveWords = useCallback(
    async (savedWordIds: string[]): Promise<UnsaveOutcome> => {
      if (!userId || savedWordIds.length === 0) {
        return { status: 'error', error: 'not_logged_in' };
      }

      const { error } = await supabase
        .from('saved_vocabulary')
        .delete()
        .eq('user_id', userId)
        .in('id', savedWordIds);

      if (error) {
        console.error('[useSavedVocabulary] unsaveWords failed', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return { status: 'error', error: 'unsave_failed' };
      }

      await refresh();
      return { status: 'removed' };
    },
    [supabase, userId, refresh]
  );

  return { savedWords, isSaved, saveWord, saveWords, unsaveWord, unsaveWords, isLoaded, loadError, refresh };
}
