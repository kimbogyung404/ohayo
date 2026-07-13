-- OHAYO! M5 추가 마이그레이션
-- fortunes 테이블에 AI 처리 실패 원인을 기록할 nullable 컬럼만 추가한다.
-- 기존 컬럼, 제약 조건, 데이터는 전혀 변경하지 않는다.
-- Supabase Dashboard > SQL Editor에서 001_initial_schema.sql 다음에 실행하세요.

alter table fortunes
  add column if not exists ai_error_message text;

-- 성공 시 null, 실패 시에만 짧은 오류 원인을 기록한다(민감정보·원본 응답 전체 저장 금지).
comment on column fortunes.ai_error_message is
  'M5 AI 처리 실패 시의 짧은 오류 원인. 성공 시 null. 민감정보나 원본 Gemini 응답 전체를 저장하지 않는다.';
