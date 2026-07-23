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
// detailFortunes: 공식 소스에 없는 세부 운세 3종(연애/금전/일·학업)을 원문 기반으로
// 새로 생성한다 — 원문 자체(readingText 대상)는 여전히 수정하지 않는다.
// vocabulary.difficulty: Gemini 스스로 선정한 난이도 태그(easy 2개 + challenge 1개).
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    readingText: { type: 'string' },
    koreanTranslation: { type: 'string' },
    luckyItemKo: { type: 'string' },
    detailFortunes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['love', 'money', 'work'] },
          japaneseText: { type: 'string' },
          koreanTranslation: { type: 'string' },
        },
        required: ['category', 'japaneseText', 'koreanTranslation'],
      },
    },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          surfaceForm: { type: 'string' },
          reading: { type: 'string' },
          meaning: { type: 'string' },
          koreanText: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'challenge'] },
        },
        required: ['surfaceForm', 'reading', 'meaning', 'koreanText', 'difficulty'],
      },
    },
  },
  required: ['readingText', 'koreanTranslation', 'luckyItemKo', 'detailFortunes', 'vocabulary'],
} as const;

function buildPrompt(originalText: string, luckyItem: string): string {
  return `당신은 한국인 일본어 초급 학습자(JLPT N4~N3 수준)를 돕는 친절한 일본어 교사입니다.

다음은 일본식 별자리 운세 원문과 행운의 장소·아이템입니다. 이 원문 자체는 공식 데이터이므로
내용을 절대 바꾸거나 새로 만들지 마세요.

원문:
"""
${originalText}
"""

행운의 장소·아이템(원문):
"""
${luckyItem}
"""

다음 작업을 순서대로 수행하세요.

1. 원문의 줄바꿈 구조(줄 수)를 그대로 유지하면서, 한자 읽기를 학습자가 확인할 수 있는
   히라가나 읽는 법을 줄 단위로 작성하세요(readingText). 원문 문장 자체는 바꾸지 않습니다.
2. 자연스러운 한국어 번역을 작성하세요(koreanTranslation). 원문의 의미를 과장하거나
   축소하지 마세요.
3. 행운의 장소·아이템도 자연스러운 한국어로 번역하세요(luckyItemKo).

4. 공식 원문에는 "연애운", "금전운", "일/학업운"처럼 나뉜 세부 운세가 따로 없습니다.
   원문의 전체적인 분위기와 핵심 내용을 근거로, 아래 3개 항목의 세부 운세를 새로
   작성하세요(detailFortunes, 정확히 3개, category는 각각 "love", "money", "work"
   하나씩):
   - love: 오늘의 연애·인간관계운
   - money: 오늘의 금전운
   - work: 오늘의 일·학업운
   각 항목을 작성할 때 반드시 지키세요.
   - 원문과 모순되면 안 됩니다. 원문이 조심하라는 분위기인데 세부 운세만 근거 없이
     지나치게 좋다고 쓰는 식으로 어긋나면 안 됩니다.
   - 원문에 없는 구체적인 사건, 숫자, 장소, 사람 이름 등을 임의로 지어내지 마세요.
     원문에 없는 디테일을 사실인 것처럼 단정하지 마세요.
   - 일본어로 1~2문장, 짧고 간결하게 작성하세요.
   - 자연스러운 한국어 번역을 함께 작성하세요(koreanTranslation).
   - 3개 항목이 서로 겹치지 않게 각자 다른 내용으로 작성하세요.
   - "좋은 일이 생길 거예요" 같은 뻔하고 상투적인 문장만 반복하지 말고, 원문의
     실제 뉘앙스를 반영해 매번 다르게 작성하세요. 특히 money 항목을 "돈을 낭비하지
     마세요/무駄遣いを控えて"로, work 항목을 "주변과 협력하면 일이 잘 풀려요/周りと
     協力すればうまくいく"로 습관적으로 채우지 마세요 — 이 두 문구는 여러 별자리에서
     기본값처럼 반복되기 쉬운 표현이니, 원문의 구체적인 분위기에 맞춰 다른 표현(예:
     소비 대신 저축, 계획 세우기, 새로운 시도, 휴식, 인내 등 원문 뉘앙스에 맞는
     다양한 소재)으로 바꿔 쓰세요.
   - 문법과 한자 표현은 일본어 초급 학습자가 읽을 수 있는 쉬운 수준으로 작성하세요.

5. 위 원문과, 4번에서 새로 작성한 detailFortunes의 japaneseText 3개까지 합쳐 총 4개의
   일본어 텍스트 전체를 대상 풀로 삼아, 그 안에 실제로 등장하는 표현 중 핵심 단어를
   정확히 3개 선택하세요(vocabulary).
   - 반드시 위 4개 텍스트 중 하나에 그대로 존재하는 문자열(surfaceForm)만 선택하세요.
     활용 전 기본형(사전형)으로 바꾸지 마세요. 등장한 형태 그대로 반환하세요.
   - 조사 하나, 보조동사, 기호 하나, 그 자체로는 학습 가치가 낮은 표현은 선택하지
     마세요.
   - 고유명사, 지나치게 문어적인 표현, 실생활에서 거의 쓰이지 않는 단어는 제외하세요.
   - 명사만 3개 고르지 말고, 가능하면 동사나 형용사를 포함해서 고르세요.
   - 문장 이해에 도움이 되고 다른 상황에서도 활용할 수 있는 실용적인 단어를
     우선하세요.
   - 같은 표현을 중복 선택하지 마세요. 같은 텍스트 안에서 정확히 한 번만 등장하는
     표현을 우선 선택하세요.
   - 3개 중 2개는 JLPT N4 수준이거나 그에 준하는 쉬운 핵심 단어(difficulty:
     "easy")로, 나머지 1개는 JLPT N3 수준이거나 그에 준하는 조금 더 도전적인 단어
     (difficulty: "challenge")로 선택하세요. JLPT N2·N1 수준의 고급 단어는 선택하지
     마세요. 정확한 JLPT 등급 판정이 어렵다면 등급을 억지로 맞추려 하지 말고,
     N3~N4 학습자가 실제로 이해하기 쉬운 난이도와 활용도를 기준으로 판단하세요.
     특히 "easy"로 고르는 단어는 소극적, 積極的 같은 "~적/~的" 형태의 추상적인
     복합어보다는, 더 일상적이고 구체적인 기초 어휘(동사·형용사·평범한 명사 등)를
     우선하세요.
   - 각 단어의 읽는 법과, 그 문장 안에서 사용된 의미를 기준으로 한 자연스러운
     한국어 뜻(meaning)을 작성하세요.
   - 추가로 koreanText를 작성하세요: koreanText는 반드시 아래 5개의 한국어 텍스트
     — koreanTranslation, luckyItemKo, detailFortunes 3개 각각의 koreanTranslation —
     중 하나 이상에 실제로 등장하는 활용된 한국어 표현을 그대로(따옴표나 조사를
     임의로 추가하지 않고) 가져와야 합니다. meaning은 사전형/의역이어도 되지만,
     koreanText는 반드시 실제 번역문에 존재하는 문자열이어야 합니다. 어디에도
     존재하지 않는 문자열을 koreanText로 만들지 마세요.

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
        // 0.2에서 상향: 별자리마다 독립적으로 호출되는 detailFortunes(연애/금전/일학업)가
        // 낮은 temperature에서는 "돈을 낭비하지 마세요", "협력하면 잘 풀려요" 같은
        // 가장 확률 높은 상투적 문구로 수렴해 여러 별자리가 거의 같은 문장을 반환하는
        // 문제가 있었다. 검증(Zod + 문자열 위치 검증)은 창의성과 무관하게 그대로
        // 강하게 걸리므로, temperature를 높여도 구조적 정합성은 동일하게 보장된다.
        temperature: 0.6,
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
