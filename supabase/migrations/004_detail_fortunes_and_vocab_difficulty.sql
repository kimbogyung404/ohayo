-- OHAYO! 세부 운세(연애·금전·일학업) + 단어 난이도 마이그레이션
-- 기존 컬럼(original_text, rank, lucky_item, korean_translation, segments 등), 제약 조건,
-- 데이터는 전혀 변경하지 않는다. 신규 컬럼은 전부 nullable이며 기존 행은 null로 남는다.
-- Supabase Dashboard > SQL Editor에서 003_korean_segments.sql 다음에 실행하세요.

alter table public.fortunes
  add column if not exists detail_fortunes jsonb;

comment on column public.fortunes.detail_fortunes is
  '공식 오하아사 소스에는 없는 세부 운세 3종(연애·인간관계/금전/일·학업). M5가 '
  'original_text의 분위기와 핵심 내용을 근거로 생성한 AI 보충 콘텐츠이며 공식 원문이 '
  '아니다. 정확히 3개(category: love/money/work, 서로 달라야 함)의 배열이며, 각 항목은 '
  '{ category, japaneseText, koreanTranslation, koreanSegments } 형태다. koreanSegments는 '
  'korean_segments와 동일한 방식(M5가 결정론적으로 조립, 조립 결과는 koreanTranslation과 '
  '글자 단위로 완전히 동일)이다. 생성 실패/미생성 시 null.';

alter table public.vocabulary
  add column if not exists difficulty text check (difficulty in ('easy', 'challenge'));

comment on column public.vocabulary.difficulty is
  'M5(Gemini)가 스스로 선정한 난이도 태그. easy=쉬운 핵심 단어(2개), challenge=도전 '
  '단어(1개). 외부 JLPT 공식 등급 판정이 아니라 생성 시점의 선정 의도를 기록한 값이다. '
  '이 컬럼 추가 이전에 생성된 기존 행은 null(레거시, 난이도 불명).';
