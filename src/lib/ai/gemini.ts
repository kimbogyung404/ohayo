import 'server-only';
import { GoogleGenAI } from '@google/genai';

// 공식 SDK(@google/genai) 사용. gemini-2.0 계열은 이미 종료(shut down)되어 사용하지 않는다.
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

function getModelName(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }
  return new GoogleGenAI({ apiKey });
}

// Gemini 구조화 출력 스키마. word(사전형)는 요청하지 않는다 —
// surfaceForm(원문 표기)만 받아서 word/surface_form 컬럼 모두에 그대로 저장한다.
// koreanText는 koreanTranslation 안에서 해당 단어가 실제로 사용된 한국어 활용형이다
// (meaning처럼 사전형/의역이 아니라, 번역문에 그대로 등장하는 문자열이어야 한다).
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    readingText: { type: 'string' },
    koreanTranslation: { type: 'string' },
    luckyItemKo: { type: 'string' },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          surfaceForm: { type: 'string' },
          reading: { type: 'string' },
          meaning: { type: 'string' },
          koreanText: { type: 'string' },
        },
        required: ['surfaceForm', 'reading', 'meaning', 'koreanText'],
      },
    },
  },
  required: ['readingText', 'koreanTranslation', 'luckyItemKo', 'vocabulary'],
} as const;

function buildPrompt(originalText: string, luckyItem: string): string {
  return `당신은 한국인 일본어 초급 학습자를 돕는 친절한 일본어 교사입니다.

다음은 일본식 별자리 운세 원문과 행운의 장소·아이템입니다. 내용을 절대 바꾸거나 새로 만들지 마세요.

원문:
"""
${originalText}
"""

행운의 장소·아이템(원문):
"""
${luckyItem}
"""

다음 작업만 수행하세요.

1. 원문의 줄바꿈 구조(줄 수)를 그대로 유지하면서, 한자 읽기를 학습자가 확인할 수 있는
   히라가나 읽는 법을 줄 단위로 작성하세요. 원문 문장 자체는 바꾸지 않습니다.
2. 자연스러운 한국어 번역을 작성하세요. 원문의 의미를 과장하거나 축소하지 마세요.
3. 행운의 장소·아이템도 자연스러운 한국어로 번역하세요(luckyItemKo).
4. 원문 안에 실제로 등장하는 표현 중, 일본어 초급 학습자(JLPT N5~N4 수준)에게
   의미 있는 핵심 단어를 정확히 3개 선택하세요.
   - 반드시 원문에 그대로 존재하는 문자열(surfaceForm)만 선택하세요.
     활용 전 기본형(사전형)으로 바꾸지 마세요. 원문에 있는 형태 그대로 반환하세요.
   - 조사 하나, 기호 하나, 의미 없는 한 글자는 선택하지 마세요.
   - 같은 표현을 중복 선택하지 마세요.
   - 원문 안에서 정확히 한 번만 등장하는 표현을 우선 선택하세요.
   - 각 단어의 읽는 법과, 이 문장 안에서 사용된 의미를 기준으로 한
     자연스러운 한국어 뜻(meaning)을 작성하세요.
   - 추가로 koreanText를 작성하세요: meaning이 사전형/의역이어도 상관없지만,
     koreanText는 반드시 2번에서 작성한 koreanTranslation 문장 안에 등장하는
     활용된 한국어 표현을 그대로(따옴표나 조사를 임의로 추가하지 않고) 가져와야 합니다.
     예를 들어 meaning이 "깊어지다"이고 koreanTranslation에 "깊어질 거예요"라고
     번역했다면 koreanText는 "깊어질"입니다. koreanTranslation에 없는 문자열을
     koreanText로 만들지 마세요.

지정된 JSON 구조 이외의 설명은 출력하지 마세요.`;
}

export type GeminiCallResult =
  | { ok: true; json: unknown }
  | { ok: false; errorMessage: string };

// Gemini 호출 결과의 raw 텍스트/에러 객체 전체는 절대 로그로 남기지 않는다.
// API 키, 모델 이름도 로그에 출력하지 않는다.
export async function generateFortuneStudyData(
  originalText: string,
  luckyItem: string
): Promise<GeminiCallResult> {
  try {
    const ai = getClient();
    const model = getModelName();

    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(originalText, luckyItem),
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      return { ok: false, errorMessage: 'empty response from Gemini' };
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, errorMessage: 'failed to parse Gemini response as JSON' };
    }

    return { ok: true, json };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : 'unknown error';
    return { ok: false, errorMessage: `Gemini request failed: ${message}` };
  }
}

// ─────────────────────────────────────────────────────────────
// 백필 전용: 이미 ai_status='success'로 저장된 기존 운세(원문/번역/vocabulary
// 확정됨)에 korean_segments/lucky_item_ko/lucky_item_ko_segments만 추가로
// 채울 때 사용한다. koreanTranslation과 vocabulary는 입력으로 고정하고
// 다시 생성하지 않는다 — 이미 검증된 데이터를 backfill이 건드리지 않기 위함이다.
// ─────────────────────────────────────────────────────────────

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
} as const;

export interface BackfillVocabularyInput {
  id: string;
  surfaceForm: string;
  meaning: string;
}

function buildBackfillPrompt(
  koreanTranslation: string,
  luckyItem: string,
  vocabulary: BackfillVocabularyInput[]
): string {
  const vocabList = vocabulary
    .map((v) => `- id: "${v.id}", 일본어: "${v.surfaceForm}", 사전적 의미: "${v.meaning}"`)
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

export async function generateKoreanSegmentBackfill(
  koreanTranslation: string,
  luckyItem: string,
  vocabulary: BackfillVocabularyInput[]
): Promise<GeminiCallResult> {
  try {
    const ai = getClient();
    const model = getModelName();

    const response = await ai.models.generateContent({
      model,
      contents: buildBackfillPrompt(koreanTranslation, luckyItem, vocabulary),
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: BACKFILL_RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      return { ok: false, errorMessage: 'empty response from Gemini' };
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, errorMessage: 'failed to parse Gemini response as JSON' };
    }

    return { ok: true, json };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : 'unknown error';
    return { ok: false, errorMessage: `Gemini request failed: ${message}` };
  }
}
