-- OHAYO! 단어 카드 뒷면(품사·등장 문장) 마이그레이션
-- vocabulary에 품사/등장 문장 관련 컬럼만 추가한다. 기존 컬럼, 제약 조건, 데이터,
-- fortunes 테이블(공식 운세 데이터)은 전혀 변경하지 않는다. 신규 컬럼은 전부
-- nullable이며 기존 행은 null로 남는다(백필 없음).
-- Supabase Dashboard > SQL Editor에서 004_detail_fortunes_and_vocab_difficulty.sql
-- 다음에 실행하세요.

alter table public.vocabulary
  add column if not exists part_of_speech text,
  add column if not exists source_key text,
  add column if not exists source_sentence text,
  add column if not exists source_sentence_reading text,
  add column if not exists source_sentence_translation text;

-- 재실행해도 안전하도록, 명시적으로 이름 붙인 제약을 먼저 제거한 뒤 다시 추가한다.
-- (ALTER TABLE ... ADD CONSTRAINT는 IF NOT EXISTS를 지원하지 않아 이 방식을 쓴다.)
alter table public.vocabulary
  drop constraint if exists vocabulary_part_of_speech_check;

alter table public.vocabulary
  add constraint vocabulary_part_of_speech_check
  check (part_of_speech in ('noun', 'verb', 'adjective', 'expression'));

alter table public.vocabulary
  drop constraint if exists vocabulary_source_key_check;

alter table public.vocabulary
  add constraint vocabulary_source_key_check
  check (source_key in ('main', 'love', 'money', 'work'));

comment on column public.vocabulary.part_of_speech is
  '품사(noun/verb/adjective/expression). 이 컬럼 추가 이전 행은 null(레거시).';

comment on column public.vocabulary.source_key is
  '단어가 등장한 출처(main/love/money/work). lucky_item은 문장이 아니라 후보에서 제외.';

comment on column public.vocabulary.source_sentence is
  '단어가 실제로 등장한 일본어 문장 원문(surface_form이 정확히 한 번 등장함을 생성 시 검증).';

comment on column public.vocabulary.source_sentence_reading is
  'source_sentence 전체의 읽는 법.';

comment on column public.vocabulary.source_sentence_translation is
  'source_sentence의 한국어 번역.';
