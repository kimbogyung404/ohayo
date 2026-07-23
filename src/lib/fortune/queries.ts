import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Fortune,
  FortuneDetailEntry,
  KoreanSegment,
  PartOfSpeech,
  Segment,
  Vocabulary,
  VocabularyDifficulty,
  VocabularySourceKey,
  ZodiacId,
  ZodiacRankItem,
} from '@/types/fortune';

// 서버 클라이언트(쿠키 기반)와 브라우저 클라이언트 양쪽에서 모두 쓸 수 있도록
// SupabaseClient를 인자로 받는다. fortunes/vocabulary는 공개 SELECT RLS라
// service role 키가 필요 없다.

interface FortuneRow {
  id: string;
  date: string;
  zodiac_id: ZodiacId;
  zodiac_japanese: string;
  zodiac_korean: string;
  rank: number;
  original_text: string;
  reading_text: string | null;
  korean_translation: string | null;
  lucky_item: string | null;
  segments: Segment[] | null;
  korean_segments: KoreanSegment[] | null;
  lucky_item_ko: string | null;
  lucky_item_ko_segments: KoreanSegment[] | null;
  detail_fortunes: FortuneDetailEntry[] | null;
  source_url: string | null;
  ai_status: 'pending' | 'success' | 'failed';
}

interface VocabularyRow {
  id: string;
  word: string;
  surface_form: string;
  reading: string;
  meaning: string;
  difficulty: VocabularyDifficulty | null;
  part_of_speech: PartOfSpeech | null;
  source_key: VocabularySourceKey | null;
  source_sentence: string | null;
  source_sentence_reading: string | null;
  source_sentence_translation: string | null;
}

// 12개 별자리가 전부 존재하고 AI 처리(success)까지 완료된 가장 최신 날짜를 찾는다.
// 완료되지 않은(pending/failed 섞인) 날짜는 건너뛴다.
export async function getLatestReadyDate(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('fortunes')
    .select('date, ai_status')
    .order('date', { ascending: false });

  if (error || !data || data.length === 0) return null;

  const byDate = new Map<string, { total: number; success: number }>();
  for (const row of data) {
    const entry = byDate.get(row.date) ?? { total: 0, success: 0 };
    entry.total += 1;
    if (row.ai_status === 'success') entry.success += 1;
    byDate.set(row.date, entry);
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));
  for (const date of sortedDates) {
    const entry = byDate.get(date)!;
    if (entry.total === 12 && entry.success === 12) {
      return date;
    }
  }
  return null;
}

export async function getRankingForDate(
  supabase: SupabaseClient,
  date: string
): Promise<ZodiacRankItem[]> {
  const { data, error } = await supabase
    .from('fortunes')
    .select('zodiac_id, zodiac_japanese, zodiac_korean, rank, lucky_item')
    .eq('date', date)
    .order('rank', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    zodiacId: row.zodiac_id as ZodiacId,
    zodiacJapanese: row.zodiac_japanese,
    zodiacKorean: row.zodiac_korean,
    rank: row.rank,
    luckyItem: row.lucky_item ?? '',
  }));
}

export async function getFortuneByZodiac(
  supabase: SupabaseClient,
  date: string,
  zodiacId: ZodiacId
): Promise<Fortune | null> {
  const { data: fortuneRow, error: fortuneError } = await supabase
    .from('fortunes')
    .select(
      'id, date, zodiac_id, zodiac_japanese, zodiac_korean, rank, original_text, reading_text, korean_translation, lucky_item, segments, korean_segments, lucky_item_ko, lucky_item_ko_segments, detail_fortunes, source_url, ai_status'
    )
    .eq('date', date)
    .eq('zodiac_id', zodiacId)
    .maybeSingle();

  if (fortuneError || !fortuneRow) return null;

  const row = fortuneRow as FortuneRow;

  const { data: vocabRows, error: vocabError } = await supabase
    .from('vocabulary')
    .select(
      'id, word, surface_form, reading, meaning, difficulty, part_of_speech, source_key, source_sentence, source_sentence_reading, source_sentence_translation'
    )
    .eq('fortune_id', row.id);

  if (vocabError) return null;

  const vocabulary: Vocabulary[] = (vocabRows ?? []).map((v: VocabularyRow) => ({
    id: v.id,
    word: v.word,
    surfaceForm: v.surface_form,
    reading: v.reading,
    meaning: v.meaning,
    difficulty: v.difficulty,
    partOfSpeech: v.part_of_speech,
    sourceKey: v.source_key,
    sourceSentence: v.source_sentence,
    sourceSentenceReading: v.source_sentence_reading,
    sourceSentenceTranslation: v.source_sentence_translation,
  }));

  return {
    id: row.id,
    date: row.date,
    zodiacId: row.zodiac_id,
    zodiacJapanese: row.zodiac_japanese,
    zodiacKorean: row.zodiac_korean,
    rank: row.rank,
    originalText: row.original_text,
    readingText: row.reading_text ?? '',
    koreanTranslation: row.korean_translation ?? '',
    luckyItem: row.lucky_item ?? '',
    segments: row.segments && row.segments.length > 0
      ? row.segments
      : [{ text: row.original_text, vocabularyId: null }],
    koreanSegments: row.korean_segments && row.korean_segments.length > 0 ? row.korean_segments : null,
    luckyItemKo: row.lucky_item_ko ?? null,
    luckyItemKoSegments:
      row.lucky_item_ko_segments && row.lucky_item_ko_segments.length > 0 ? row.lucky_item_ko_segments : null,
    detailFortunes: row.detail_fortunes && row.detail_fortunes.length === 3 ? row.detail_fortunes : null,
    vocabulary,
    sourceUrl: row.source_url ?? '',
    sourceDate: row.date,
    aiStatus: row.ai_status,
  };
}
