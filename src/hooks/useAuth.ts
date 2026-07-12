'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export function useAuth() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Google 로그인 시작. 로그인 완료 후 redirectPath로 복귀한다.
  const signInWithGoogle = useCallback(
    async (redirectPath: string) => {
      const next = encodeURIComponent(redirectPath);
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        },
      });
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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
