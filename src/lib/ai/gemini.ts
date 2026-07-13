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
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    readingText: { type: 'string' },
    koreanTranslation: { type: 'string' },
    vocabulary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          surfaceForm: { type: 'string' },
          reading: { type: 'string' },
          meaning: { type: 'string' },
        },
        required: ['surfaceForm', 'reading', 'meaning'],
      },
    },
  },
  required: ['readingText', 'koreanTranslation', 'vocabulary'],
} as const;

function buildPrompt(originalText: string): string {
  return `당신은 한국인 일본어 초급 학습자를 돕는 친절한 일본어 교사입니다.

다음은 일본식 별자리 운세 원문입니다. 이 원문의 내용을 절대 바꾸거나 새로 만들지 마세요.

원문:
"""
${originalText}
"""

다음 작업만 수행하세요.

1. 원문의 줄바꿈 구조(줄 수)를 그대로 유지하면서, 한자 읽기를 학습자가 확인할 수 있는
   히라가나 읽는 법을 줄 단위로 작성하세요. 원문 문장 자체는 바꾸지 않습니다.
2. 자연스러운 한국어 번역을 작성하세요. 원문의 의미를 과장하거나 축소하지 마세요.
3. 원문 안에 실제로 등장하는 표현 중, 일본어 초급 학습자(JLPT N5~N4 수준)에게
   의미 있는 핵심 단어를 정확히 3개 선택하세요.
   - 반드시 원문에 그대로 존재하는 문자열(surfaceForm)만 선택하세요.
     활용 전 기본형(사전형)으로 바꾸지 마세요. 원문에 있는 형태 그대로 반환하세요.
   - 조사 하나, 기호 하나, 의미 없는 한 글자는 선택하지 마세요.
   - 같은 표현을 중복 선택하지 마세요.
   - 원문 안에서 정확히 한 번만 등장하는 표현을 우선 선택하세요.
   - 각 단어의 읽는 법과, 이 문장 안에서 사용된 의미를 기준으로 한
     자연스러운 한국어 뜻을 작성하세요.

지정된 JSON 구조 이외의 설명은 출력하지 마세요.`;
}

export type GeminiCallResult =
  | { ok: true; json: unknown }
  | { ok: false; errorMessage: string };

// Gemini 호출 결과의 raw 텍스트/에러 객체 전체는 절대 로그로 남기지 않는다.
// API 키, 모델 이름도 로그에 출력하지 않는다.
export async function generateFortuneStudyData(originalText: string): Promise<GeminiCallResult> {
  try {
    const ai = getClient();
    const model = getModelName();

    const response = await ai.models.generateContent({
      model,
      contents: buildPrompt(originalText),
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
