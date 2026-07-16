-- OHAYO! 한국어 세그먼트 마이그레이션
-- fortunes 테이블에 한국어 본문/행운 아이템의 vocabulary 위치 정보를 추가한다.
-- 기존 컬럼(original_text, korean_translation, lucky_item, segments 등), 제약 조건,
-- 데이터는 전혀 변경하지 않는다. 신규 컬럼은 전부 nullable이며 기존 행은 null로 남는다
-- (백필 스크립트가 별도로 채운다).
-- Supabase Dashboard > SQL Editor에서 002_fortunes_ai_error.sql 다음에 실행하세요.

alter table fortunes
  add column if not exists korean_segments jsonb,
  add column if not exists lucky_item_ko text,
  add column if not exists lucky_item_ko_segments jsonb;

comment on column fortunes.korean_segments is
  'korean_translation을 순서대로 조립할 수 있는 문장 조각(KoreanSegment[]). '
  '조립 결과는 korean_translation과 글자 단위로 완전히 동일해야 한다. '
  'M5가 결정론적으로 생성하며(AI는 vocabulary별 koreanText만 제공), 프론트는 문자열 매칭을 하지 않는다.';

comment on column fortunes.lucky_item_ko is
  'lucky_item(일본어)의 한국어 번역. M5가 생성한다. 데이터가 없으면 null이며, '
  '이 경우 프론트는 행운의 장소·아이템을 한국어로 표시할 수 없다.';

comment on column fortunes.lucky_item_ko_segments is
  'lucky_item_ko를 순서대로 조립할 수 있는 문장 조각(KoreanSegment[]). '
  '조립 결과는 lucky_item_ko와 글자 단위로 완전히 동일해야 한다.';
