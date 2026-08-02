-- OHAYO! 홈 화면 "의견 보내기" 기능
-- 이메일/이름/Google 프로필/토큰/IP/user agent 등 개인정보는 저장하지 않는다.
-- Supabase Dashboard > SQL Editor에서 005_vocabulary_source_sentence.sql 다음에 실행하세요.

create table if not exists user_feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  -- 로그인 상태에서 작성하면 본인 user_id만 남긴다(이메일/이름 등은 저장하지 않음).
  -- 비로그인 작성은 null. 계정이 삭제되어도 남긴 의견 자체는 보존한다(on delete set null).
  user_id uuid references auth.users (id) on delete set null,
  source text not null default 'home',
  created_at timestamptz not null default now(),
  constraint user_feedback_message_length check (
    char_length(btrim(message)) >= 1 and char_length(message) <= 500
  ),
  constraint user_feedback_source_allowed check (source in ('home'))
);

create index if not exists idx_user_feedback_created_at on user_feedback (created_at desc);

alter table user_feedback enable row level security;

-- 의도적으로 어떤 정책도 만들지 않는다 — RLS는 켜져 있고 정책이 하나도 없으므로
-- anon/authenticated 역할은 SELECT/INSERT/UPDATE/DELETE를 전혀 수행할 수 없다.
-- 클라이언트가 Supabase REST API를 anon/로그인 키로 직접 호출해 검증을 우회하거나
-- 스팸을 넣는 경로를 원천 차단한다. 저장은 오직 서버(/api/feedback)가 service role
-- 키(admin client, RLS 우회)로만 수행하고, 조회는 Supabase Dashboard의 Table
-- Editor(service role 키로 RLS 우회)에서만 한다.
