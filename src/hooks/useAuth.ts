'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { identify, resetAnalytics, track } from '@/lib/analytics/mixpanel';
import {
  consumePendingLoginAttempt,
  clearPendingLoginAttempt,
  savePendingLoginAttempt,
  type VocabSaveLoginContext,
} from '@/lib/analytics/pendingLogin';

export function useAuth() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsLoading(false);
      // 이미 로그인된 상태로 페이지가 로드된 경우 — identify만 재연결한다.
      // login_completed는 여기서 보내지 않는다(아래 onAuthStateChange에서만 판단).
      if (data.user) identify(data.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        identify(session.user.id);
      }

      if (event === 'SIGNED_OUT') {
        resetAnalytics();
        return;
      }

      // login_completed는 "이 저장 플로우에서 실제로 로그인을 새로 시작해서 성공한
      // 경우"에만 보낸다 — pending 로그인 시도(login_started 시점에 기록)가 있을 때만
      // 전송하고, 소비 즉시 제거하므로 같은 시도가 두 번 처리될 수 없다.
      //
      // 이 프로젝트의 OAuth 코드 교환은 서버(/auth/callback)에서 일어나고 브라우저는
      // 완전한 새 페이지 로드로 돌아오기 때문에, 브라우저 SDK 입장에서는 "새로
      // 로그인"이 아니라 "이미 유효한 세션을 가진 채로 초기화됨"으로 관측되어
      // SIGNED_IN이 아니라 INITIAL_SESSION이 발생한다(Supabase-js 표준 동작). 그래서
      // SIGNED_IN만 허용하면 실제 OAuth 복귀 흐름에서 login_completed가 전혀 발생하지
      // 않는다 — INITIAL_SESSION도 함께 허용하되, pending 로그인 시도 존재 여부가
      // 진짜 판별 기준이므로 일반 재방문(pending 없음)에서는 여전히 전송되지 않는다.
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        const pending = consumePendingLoginAttempt();
        if (pending) {
          track('login_completed', {
            login_provider: pending.provider,
            login_source: pending.source,
            zodiac_id: pending.zodiacId,
            selected_vocab_count: pending.selectedVocabCount,
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Google 로그인 시작. 로그인 완료 후 redirectPath로 복귀한다.
  //
  // context를 넘기면(현재는 복습 화면의 저장 플로우만 넘긴다) 그 로그인 시도만
  // login_started/ohayo_mixpanel_pending_login 대상이 된다. 프로필·상단 내비게이션 등
  // context 없이 부르는 일반 로그인은 login_started를 보내지 않고, pending도 새로
  // 만들지 않는다 — 오히려 남아 있는 이전 vocab_save pending(만료 여부 무관)을 지워서,
  // 이번 일반 로그인의 완료가 그 pending을 잘못 소비해 login_completed로 이어지지
  // 않게 한다.
  const signInWithGoogle = useCallback(
    async (redirectPath: string, context?: VocabSaveLoginContext) => {
      if (context) {
        savePendingLoginAttempt({
          zodiacId: context.zodiacId,
          selectedVocabCount: context.selectedVocabCount,
        });
        track('login_started', {
          login_provider: 'google',
          login_source: context.source,
          zodiac_id: context.zodiacId,
          selected_vocab_count: context.selectedVocabCount,
        });
      } else {
        clearPendingLoginAttempt();
      }

      const next = encodeURIComponent(redirectPath);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        },
      });

      // signInWithOAuth 호출 자체가 실패하면(리다이렉트가 일어나지 않음) 이번
      // vocab_save 시도로 만든 pending만 제거한다. 일반 로그인은 애초에 pending을
      // 만들지 않았으므로 여기서 추가로 할 일이 없다.
      if (error && context) {
        clearPendingLoginAttempt();
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    resetAnalytics();
  }, [supabase]);

  // OAuth 리다이렉트 복귀 직후 등, React state(isLoggedIn)는 true여도
  // 브라우저 세션이 아직 완전히 준비되지 않았을 수 있어 재확인한다.
  // 최대 3회, 400ms 간격으로 재시도하고 확인되면 user state도 갱신한다.
  const waitForSession = useCallback(async (): Promise<string | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUser(data.user);
        return data.user.id;
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    return null;
  }, [supabase]);

  return { user, isLoggedIn: !!user, isLoading, signInWithGoogle, signOut, waitForSession };
}
