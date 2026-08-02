-- OHAYO! 운세 출처 구분 마이그레이션
-- 공식 오하아사 데이터가 없는 날에도 AI로 오늘 운세를 생성하는 정책으로 바뀌면서,
-- 각 fortunes 행이 공식 원문인지 AI 대체 생성물인지 DB에서 구분할 수 있어야 한다.
-- source_date/generated_at은 기존 컬럼(date/created_at)이 이미 같은 목적이라
-- 새로 만들지 않고 재사용한다. 기존 컬럼, 제약 조건, 데이터는 전혀 변경하지 않는다.
-- 기존 행은 전부 공식 수집 데이터이므로 default 'official'로 자동 채워진다(백필 불필요).
-- Supabase Dashboard > SQL Editor에서 006_user_feedback.sql 다음에 실행하세요.

alter table public.fortunes
  add column if not exists source_type text not null default 'official';

alter table public.fortunes
  drop constraint if exists fortunes_source_type_check;

alter table public.fortunes
  add constraint fortunes_source_type_check
  check (source_type in ('official', 'ai_fallback'));

comment on column public.fortunes.source_type is
  '이 행의 운세 원문 출처. official=오하아사 공식 원문, ai_fallback=공식 데이터가 '
  '해당 날짜에 없어(수집 실패·미게시 등) Gemini가 새로 생성한 대체 원문. '
  'fortune_sources.source_type(weekday/weekend, 공식 수집 "시도"의 요일 구분)과는 '
  '다른 테이블·다른 의미의 컬럼이므로 혼동하지 말 것. ai_fallback 행은 공식 원문이 '
  '아니므로 source_url/source_id를 공식 URL로 채우지 않는다(둘 다 null). 이 행이 언제 '
  '만들어졌는지는 기존 created_at을, 어느 날짜 운세인지는 기존 date 컬럼을 그대로 쓴다 '
  '(generated_at/source_date를 별도로 추가하지 않음 — 같은 목적의 기존 컬럼 재사용).';
