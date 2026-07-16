// 일회성 백필 스크립트: 이미 ai_status='success'인 기존 운세에
// korean_segments / lucky_item_ko / lucky_item_ko_segments를 채운다.
//
// - original_text, korean_translation, vocabulary(surfaceForm/reading/meaning)는
//   절대 다시 생성하거나 수정하지 않는다. Gemini에게는 luckyItemKo와 각 vocabulary의
//   koreanText만 요청한다.
// - 검증 로직은 src/lib/ai/validation.ts의 validateBackfillResult와 동일한 규칙이다
//   (koreanText가 koreanTranslation 또는 luckyItemKo 안에 정확히 한 번만 존재해야
//   하고, 겹치는 범위가 없어야 한다). 이 스크립트는 Next.js 빌드 없이 독립 실행하기
//   위한 것이라 그 규칙을 아래에 순수 JS로 그대로 옮겨 두었다 — 로직을 바꿀 때는
//   validation.ts와 함께 수정해야 한다.
// - 실패한 항목은 ai_status를 건드리지 않는다(기존 데이터는 계속 유효하므로).
//   그냥 korean_segments 등이 null로 남고, 이 스크립트 출력에만 실패 사유가 남는다.
// - quota-safe: 운세 사이에 고정 간격을 두고, 429(RESOURCE_EXHAUSTED)를 만나면
//   Gemini가 응답에 알려주는 retryDelay만큼(없으면 기본값) 대기 후 재시도한다.
//   재시도도 실패하면 그 운세만 실패로 기록하고 다음으로 넘어간다(전체를 죽이지 않음).
//
// 실행:
//   node scripts/backfill-korean-segments.mjs                 # 기본 1개만 테스트
//   node scripts/backfill-korean-segments.mjs --limit=5        # 5개까지
//   node scripts/backfill-korean-segments.mjs --limit=all      # 24개 전체
//   node scripts/backfill-korean-segments.mjs --date=2026-07-13 --limit=3

import { readFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = env.GEMINI_API_KEY;
const GEMINI_MODEL = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// ── CLI 인자 ──
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? 'true'];
  })
);
const LIMIT = args.limit === 'all' ? Infinity : Number(args.limit ?? 1); // 기본: 1개만(테스트)
const DATE_FILTER = args.date ?? null;
const ZODIAC_FILTER = args.zodiac ?? null; // 예: --zodiac=cancer (특정 운세 하나만 타깃 테스트)

// ── quota-safe 호출 설정 ──
const DELAY_BETWEEN_FORTUNES_MS = 5000; // 운세 사이 고정 간격(연속 요청으로 인한 429 예방)
const MAX_RETRIES_ON_429 = 3;
const DEFAULT_RETRY_DELAY_MS = 20000; // Gemini가 retryDelay를 안 주면 20초 대기 후 재시도

const TARGET_DATES = DATE_FILTER ? [DATE_FILTER] : ['2026-07-11', '2026-07-13'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const BACKFILL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    luckyItemKo: { type: 'string' },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          koreanText: { type: 'string' },
        },
        required: ['id', 'koreanText'],
      },
    },
  },
  required: ['luckyItemKo', 'vocabulary'],
};

function buildBackfillPrompt(koreanTranslation, luckyItem, vocabulary) {
  const vocabList = vocabulary
    .map((v) => `- id: "${v.id}", 일본어: "${v.surface_form}", 사전적 의미: "${v.meaning}"`)
    .join('\n');

  return `당신은 한국인 일본어 초급 학습자를 돕는 친절한 일본어 교사입니다.

이미 완성된 한국어 번역문과, 그 문장에서 이미 선정된 핵심 단어 목록이 있습니다.
번역문의 내용은 절대 바꾸지 마세요. 새 문장을 추가하지 마세요.

한국어 번역문(수정 금지, 그대로 두고 안에서 표현만 찾을 것):
"""
${koreanTranslation}
"""

행운의 장소·아이템(일본어, 한국어로 번역만 하세요):
"""
${luckyItem}
"""

핵심 단어 목록:
${vocabList}

다음 작업만 수행하세요.

1. 행운의 장소·아이템을 자연스러운 한국어로 번역하세요(luckyItemKo).
2. 핵심 단어 목록의 각 id에 대해, 위 한국어 번역문(koreanTranslation) 안에 실제로
   그대로 등장하는 활용된 한국어 표현을 찾아 koreanText로 반환하세요.
   - koreanText는 번역문에 있는 문자열을 그대로(조사·어미를 임의로 붙이거나 빼지 않고)
     가져와야 합니다. 번역문에 없는 문자열을 새로 만들지 마세요.
   - 사전적 의미가 활용되지 않은 형태(예: "깊어지다")라도, 번역문에서 실제로 쓰인
     형태(예: "깊어질")를 그대로 찾아 반환하세요.
   - 번역문 안에서 찾을 수 없다면, luckyItemKo 번역문 안에서 찾아보세요.
   - 두 문장 어디에도 정확히 일치하는 문자열이 없다면, 번역문 안에서 그 단어와
     의미가 가장 가까운 부분을 있는 그대로 반환하세요. 번역문/luckyItemKo에
     전혀 존재하지 않는 새로운 단어나 어미를 지어내지 마세요.

지정된 JSON 구조 이외의 설명은 출력하지 마세요.`;
}

// Gemini 429 응답은 보통 error.details 안에 RetryInfo.retryDelay("20s" 형식)를
// 함께 준다. 그 값을 최우선으로 쓰고, 파싱이 안 되면 DEFAULT_RETRY_DELAY_MS를 쓴다.
function parseRetryDelayMs(err) {
  try {
    const parsed = JSON.parse(err.message);
    const details = parsed?.error?.details ?? [];
    const retryInfo = details.find((d) => typeof d['@type'] === 'string' && d['@type'].includes('RetryInfo'));
    const raw = retryInfo?.retryDelay; // 예: "20s"
    if (typeof raw === 'string' && raw.endsWith('s')) {
      const seconds = Number(raw.slice(0, -1));
      if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000) + 1000; // 여유 1초
    }
  } catch {
    // 파싱 실패 시 기본값으로 폴백
  }
  return DEFAULT_RETRY_DELAY_MS;
}

function is429(err) {
  return typeof err.message === 'string' && err.message.includes('"code":429');
}

async function callGeminiOnce(koreanTranslation, luckyItem, vocabulary) {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildBackfillPrompt(koreanTranslation, luckyItem, vocabulary),
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: BACKFILL_RESPONSE_SCHEMA,
    },
  });
  const text = response.text;
  if (!text) throw new Error('empty response from Gemini');
  return JSON.parse(text);
}

// quota-safe 래퍼: 429를 만나면 Gemini가 알려준 대기 시간(또는 기본값)만큼 쉬고
// 최대 MAX_RETRIES_ON_429번 재시도한다. 429가 아닌 오류는 즉시 던진다(재시도 안 함).
// 반환값에 재시도 횟수(retries429)를 포함해 리포트에서 확인할 수 있게 한다.
async function callGemini(koreanTranslation, luckyItem, vocabulary, log) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES_ON_429; attempt++) {
    try {
      const json = await callGeminiOnce(koreanTranslation, luckyItem, vocabulary);
      return { json, retries429: attempt };
    } catch (err) {
      lastError = err;
      if (!is429(err) || attempt === MAX_RETRIES_ON_429) throw err;
      const waitMs = parseRetryDelayMs(err);
      log(`  429 rate limited — waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${MAX_RETRIES_ON_429}...`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

// ── validation.ts의 규칙을 그대로 옮긴 순수 JS 버전 ──

function countOccurrences(haystack, needle) {
  if (needle.length === 0) return 0;
  let count = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1) {
    count += 1;
    pos = haystack.indexOf(needle, pos + 1);
  }
  return count;
}

function locateUniqueOccurrence(haystack, needle) {
  if (needle.trim() === '') return { kind: 'none' };
  const count = countOccurrences(haystack, needle);
  if (count === 0) return { kind: 'none' };
  if (count > 1) return { kind: 'ambiguous' };
  return { kind: 'found', startIndex: haystack.indexOf(needle) };
}

function findOverlap(itemsSortedByStart) {
  for (let i = 0; i < itemsSortedByStart.length - 1; i++) {
    const current = itemsSortedByStart[i];
    const next = itemsSortedByStart[i + 1];
    if (current.startIndex + current.length > next.startIndex) {
      return { a: current.label, b: next.label };
    }
  }
  return null;
}

function buildKoreanSegments(text, placements) {
  const sorted = [...placements].sort((a, b) => a.startIndex - b.startIndex);
  const segments = [];
  let cursor = 0;
  for (const p of sorted) {
    if (p.startIndex > cursor) segments.push({ type: 'text', text: text.slice(cursor, p.startIndex) });
    segments.push({ type: 'vocabulary', vocabularyId: p.vocabularyId, koreanText: p.koreanText });
    cursor = p.startIndex + p.koreanText.length;
  }
  if (cursor < text.length) segments.push({ type: 'text', text: text.slice(cursor) });
  if (segments.length === 0) segments.push({ type: 'text', text });
  const reconstructed = segments.map((s) => (s.type === 'text' ? s.text : s.koreanText)).join('');
  return { segments, reconstructed };
}

function validateBackfillResult(json, koreanTranslation, expectedVocabularyIds) {
  if (typeof json !== 'object' || json === null) return { ok: false, reason: 'response is not an object' };
  const { luckyItemKo, vocabulary } = json;
  if (typeof luckyItemKo !== 'string' || luckyItemKo.trim() === '') {
    return { ok: false, reason: 'luckyItemKo is empty or missing' };
  }
  if (!Array.isArray(vocabulary)) return { ok: false, reason: 'vocabulary is not an array' };

  const expectedSet = new Set(expectedVocabularyIds);
  const returnedSet = new Set(vocabulary.map((v) => v.id));
  if (vocabulary.length !== expectedVocabularyIds.length || returnedSet.size !== expectedSet.size) {
    return {
      ok: false,
      reason: `vocabulary id count mismatch: expected ${expectedVocabularyIds.length}, got ${vocabulary.length}`,
    };
  }
  for (const id of expectedVocabularyIds) {
    if (!returnedSet.has(id)) return { ok: false, reason: `missing koreanText for vocabulary id: ${id}` };
  }

  const withPositions = [];
  for (const v of vocabulary) {
    if (typeof v.koreanText !== 'string' || v.koreanText.trim() === '') {
      return { ok: false, reason: `empty koreanText for id "${v.id}"` };
    }
    const inKorean = locateUniqueOccurrence(koreanTranslation, v.koreanText);
    if (inKorean.kind === 'ambiguous') {
      return { ok: false, reason: `ambiguous koreanText occurrence in koreanTranslation: "${v.koreanText}"` };
    }
    const inLuckyItem = locateUniqueOccurrence(luckyItemKo, v.koreanText);
    if (inLuckyItem.kind === 'ambiguous') {
      return { ok: false, reason: `ambiguous koreanText occurrence in luckyItemKo: "${v.koreanText}"` };
    }
    if (inKorean.kind === 'none' && inLuckyItem.kind === 'none') {
      return { ok: false, reason: `koreanText not found in koreanTranslation or luckyItemKo: "${v.koreanText}"` };
    }
    withPositions.push({
      id: v.id,
      koreanText: v.koreanText,
      koreanStartIndex: inKorean.kind === 'found' ? inKorean.startIndex : null,
      luckyItemKoStartIndex: inLuckyItem.kind === 'found' ? inLuckyItem.startIndex : null,
    });
  }

  const koreanOverlap = findOverlap(
    withPositions
      .filter((v) => v.koreanStartIndex !== null)
      .map((v) => ({ startIndex: v.koreanStartIndex, length: v.koreanText.length, label: v.koreanText }))
      .sort((a, b) => a.startIndex - b.startIndex)
  );
  if (koreanOverlap) {
    return { ok: false, reason: `overlapping koreanText ranges in koreanTranslation: "${koreanOverlap.a}" / "${koreanOverlap.b}"` };
  }
  const luckyOverlap = findOverlap(
    withPositions
      .filter((v) => v.luckyItemKoStartIndex !== null)
      .map((v) => ({ startIndex: v.luckyItemKoStartIndex, length: v.koreanText.length, label: v.koreanText }))
      .sort((a, b) => a.startIndex - b.startIndex)
  );
  if (luckyOverlap) {
    return { ok: false, reason: `overlapping koreanText ranges in luckyItemKo: "${luckyOverlap.a}" / "${luckyOverlap.b}"` };
  }

  return { ok: true, data: { luckyItemKo, vocabulary: withPositions } };
}

// ── Supabase REST 헬퍼(service role — RLS 우회) ──

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const report = {
    total: 0,
    koreanSegmentsSuccess: 0,
    luckyItemKoSuccess: 0,
    allThreeConnected: 0,
    skippedAlreadyDone: 0,
    successes: [],
    failures: [],
  };
  const log = (msg) => console.error(msg); // stdout은 최종 JSON 리포트 전용으로 남겨둔다

  let processed = 0;
  let stopAfterFailure = false;

  outer: for (const date of TARGET_DATES) {
    if (stopAfterFailure) break;

    // 이미 백필된 행(korean_segments not null)은 대상에서 제외한다 — 재실행 시
    // 이미 성공한 운세에 다시 quota를 쓰지 않기 위함.
    const zodiacQuery = ZODIAC_FILTER ? `&zodiac_id=eq.${ZODIAC_FILTER}` : '';
    const fortunes = await sbGet(
      `fortunes?select=id,zodiac_id,zodiac_korean,rank,original_text,korean_translation,lucky_item,korean_segments&date=eq.${date}&ai_status=eq.success${zodiacQuery}&order=rank.asc`
    );

    for (const f of fortunes) {
      if (f.korean_segments !== null) {
        report.skippedAlreadyDone += 1;
        continue;
      }

      if (processed >= LIMIT) break outer;
      processed += 1;

      const label = `${date} ${f.zodiac_id}(${f.zodiac_korean} #${f.rank})`;
      report.total += 1;
      log(`[${processed}/${LIMIT === Infinity ? '전체' : LIMIT}] ${label} 처리 중...`);

      if (processed > 1) {
        log(`  ${DELAY_BETWEEN_FORTUNES_MS / 1000}초 대기(quota 보호)...`);
        await sleep(DELAY_BETWEEN_FORTUNES_MS);
      }

      const vocabulary = await sbGet(
        `vocabulary?select=id,surface_form,reading,meaning&fortune_id=eq.${f.id}`
      );
      if (vocabulary.length !== 3) {
        report.failures.push({ label, reason: `expected 3 vocabulary rows, found ${vocabulary.length}` });
        stopAfterFailure = true;
        break outer;
      }

      let json, retries429;
      try {
        ({ json, retries429 } = await callGemini(f.korean_translation, f.lucky_item, vocabulary, log));
      } catch (err) {
        report.failures.push({ label, reason: `Gemini call failed: ${String(err.message || err).slice(0, 200)}` });
        stopAfterFailure = true;
        break outer;
      }

      const expectedIds = vocabulary.map((v) => v.id);
      const validation = validateBackfillResult(json, f.korean_translation, expectedIds);
      if (!validation.ok) {
        report.failures.push({ label, reason: validation.reason });
        stopAfterFailure = true;
        break outer;
      }

      const koreanPlacements = validation.data.vocabulary
        .filter((v) => v.koreanStartIndex !== null)
        .map((v) => ({ vocabularyId: v.id, koreanText: v.koreanText, startIndex: v.koreanStartIndex }));
      const { segments: koreanSegments, reconstructed: koreanReconstructed } = buildKoreanSegments(
        f.korean_translation,
        koreanPlacements
      );
      const koreanMatches = koreanReconstructed === f.korean_translation;
      if (!koreanMatches) {
        report.failures.push({ label, reason: 'koreanSegments reconstruction mismatch' });
        stopAfterFailure = true;
        break outer;
      }

      const luckyItemKoPlacements = validation.data.vocabulary
        .filter((v) => v.luckyItemKoStartIndex !== null)
        .map((v) => ({ vocabularyId: v.id, koreanText: v.koreanText, startIndex: v.luckyItemKoStartIndex }));
      const { segments: luckyItemKoSegments, reconstructed: luckyItemKoReconstructed } = buildKoreanSegments(
        validation.data.luckyItemKo,
        luckyItemKoPlacements
      );
      if (luckyItemKoReconstructed !== validation.data.luckyItemKo) {
        report.failures.push({ label, reason: 'luckyItemKoSegments reconstruction mismatch' });
        stopAfterFailure = true;
        break outer;
      }

      const connected = new Set([
        ...koreanPlacements.map((p) => p.vocabularyId),
        ...luckyItemKoPlacements.map((p) => p.vocabularyId),
      ]);
      const allConnected = expectedIds.every((id) => connected.has(id));

      try {
        await sbPatch(`fortunes?id=eq.${f.id}`, {
          korean_segments: koreanSegments,
          lucky_item_ko: validation.data.luckyItemKo,
          lucky_item_ko_segments: luckyItemKoSegments,
        });
      } catch (err) {
        report.failures.push({ label, reason: `DB update failed: ${String(err.message || err).slice(0, 200)}` });
        stopAfterFailure = true;
        break outer;
      }

      report.koreanSegmentsSuccess += 1;
      report.luckyItemKoSuccess += 1;
      if (allConnected) report.allThreeConnected += 1;

      report.successes.push({
        date,
        zodiacId: f.zodiac_id,
        zodiacKorean: f.zodiac_korean,
        koreanSegmentsGenerated: true,
        koreanSegmentsMatchTranslation: koreanMatches,
        allThreeVocabularyConnected: allConnected,
        vocabulary: validation.data.vocabulary.map((v) => {
          const original = vocabulary.find((ov) => ov.id === v.id);
          const connectedIn =
            v.koreanStartIndex !== null && v.luckyItemKoStartIndex !== null
              ? 'both'
              : v.koreanStartIndex !== null
                ? 'koreanTranslation'
                : 'luckyItemKo';
          return {
            id: v.id,
            surfaceForm: original.surface_form,
            meaning: original.meaning,
            koreanText: v.koreanText,
            connectedIn,
          };
        }),
        koreanTranslation: f.korean_translation,
        luckyItem: f.lucky_item,
        luckyItemKo: validation.data.luckyItemKo,
        luckyItemKoHasVocabularySegment: luckyItemKoPlacements.length > 0,
        luckyItemKoSegmentTypes: luckyItemKoSegments.map((s) => s.type),
        retries429,
      });
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
