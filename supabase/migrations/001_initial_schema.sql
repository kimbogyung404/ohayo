-- OHAYO! M2 초기 스키마
-- PRD.md 20항 데이터베이스 구조 기준
-- Supabase Dashboard > SQL Editor에서 실행하세요.

-- ────────────────────────────────────────────
-- fortune_sources: 크롤링 실행 기록 (M4에서 사용, 브라우저에서 직접 조회하지 않음)
-- ────────────────────────────────────────────
create table if not exists fortune_sources (
  id uuid primary key default gen_random_uuid(),
  source_date date not null,
  source_type text not null check (source_type in ('weekday', 'weekend')),
  source_url text not null,
  fetched_at timestamptz not null,
  status text not null check (status in ('success', 'failed', 'partial')),
  raw_hash text,
  error_message text,
  created_at timestamptz not null default now()
);

-- ────────────────────────────────────────────
-- fortunes: 별자리별 운세 데이터
-- ────────────────────────────────────────────
create table if not exists fortunes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references fortune_sources(id) on delete set null,
  date date not null,
  zodiac_id text not null check (
    zodiac_id in (
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
    )
  ),
  zodiac_japanese text not null,
  zodiac_korean text not null,
  rank integer not null check (rank between 1 and 12),
  original_text text not null check (original_text <> ''),
  reading_text text,
  korean_translation text,
  lucky_item text,
  segments jsonb,
  source_url text,
  ai_status text not null default 'pending' check (ai_status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, zodiac_id),
  unique (date, rank)
);

create index if not exists idx_fortunes_date on fortunes (date);

-- ────────────────────────────────────────────
-- vocabulary: 운세별 핵심 단어 (운세당 정확히 3개, 애플리케이션/AI 파이프라인에서 보장)
-- ────────────────────────────────────────────
create table if not exists vocabulary (
  id text primary key,
  fortune_id uuid not null references fortunes(id) on delete cascade,
  word text not null,
  surface_form text not null,
  reading text not null,
  meaning text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_vocabulary_fortune_id on vocabulary (fortune_id);

-- ────────────────────────────────────────────
-- saved_vocabulary: 사용자가 저장한 단어
-- ────────────────────────────────────────────
create table if not exists saved_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_id text not null references vocabulary (id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (user_id, vocabulary_id)
);

create index if not exists idx_saved_vocabulary_user_id on saved_vocabulary (user_id);

-- ────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────
alter table fortune_sources enable row level security;
alter table fortunes enable row level security;
alter table vocabulary enable row level security;
alter table saved_vocabulary enable row level security;

-- fortune_sources: 브라우저에서 직접 조회할 필요가 없으므로 공개 정책을 만들지 않는다.
-- (RLS만 활성화하고 정책은 없음 -> service role 키를 사용하는 서버 작업만 접근 가능)

-- fortunes, vocabulary: 로그인 여부와 관계없이 누구나 조회 가능
create policy "fortunes are viewable by everyone"
  on fortunes for select
  using (true);

create policy "vocabulary is viewable by everyone"
  on vocabulary for select
  using (true);

-- saved_vocabulary: 로그인한 사용자가 자신의 데이터만 접근
create policy "users can view their own saved vocabulary"
  on saved_vocabulary for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own saved vocabulary"
  on saved_vocabulary for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can delete their own saved vocabulary"
  on saved_vocabulary for delete
  to authenticated
  using (auth.uid() = user_id);
