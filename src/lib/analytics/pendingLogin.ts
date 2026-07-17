// "저장하기 → 로그인" 흐름에서 실제로 Google 로그인을 시작한 시점(login_started)에만
// 기록되는 sessionStorage 페이로드. login_completed를 "이 저장 플로우에서 실제로
// 로그인을 새로 시작해서 성공한 경우"에만 보내기 위한 게이트로만 쓰인다.
// ohayo_pending_vocab_save(단어 저장 재개용, 건드리지 않음)와는 완전히 별개의 키다.
const STORAGE_KEY = 'ohayo_mixpanel_pending_login';
const TTL_MS = 10 * 60 * 1000; // 10분
const PAYLOAD_VERSION = 1;

export interface PendingLoginAttempt {
  version: 1;
  provider: 'google';
  source: 'vocab_save';
  zodiacId: string;
  selectedVocabCount: number;
  createdAt: number;
}

// signInWithGoogle()이 선택적으로 받는 로그인 컨텍스트. 이 컨텍스트가 전달된
// 호출(=복습 화면의 저장 플로우)에서만 login_started/pending 기록을 남긴다.
export interface VocabSaveLoginContext {
  source: 'vocab_save';
  zodiacId: string;
  selectedVocabCount: number;
}

export function savePendingLoginAttempt(input: { zodiacId: string; selectedVocabCount: number }): void {
  const payload: PendingLoginAttempt = {
    version: PAYLOAD_VERSION,
    provider: 'google',
    source: 'vocab_save',
    zodiacId: input.zodiacId,
    selectedVocabCount: input.selectedVocabCount,
    createdAt: Date.now(),
  };
  try {
    // 새 로그인 시도가 시작되면 기존 값을 덮어쓴다.
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage를 쓸 수 없는 환경이면 이번 로그인은 login_completed 집계에서
    // 빠진다(핵심 로그인/저장 기능에는 영향 없음).
  }
}

function isValidPayload(value: unknown): value is PendingLoginAttempt {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === PAYLOAD_VERSION &&
    v.provider === 'google' &&
    v.source === 'vocab_save' &&
    typeof v.zodiacId === 'string' &&
    typeof v.selectedVocabCount === 'number' &&
    typeof v.createdAt === 'number'
  );
}

// 유효한 페이로드가 있으면 반환과 동시에 즉시 제거한다(한 번만 소비). JSON parse
// 실패, 형식 불일치, 만료된 값은 조용히 폐기하고 null을 반환한다 — 이미 처리됐거나
// 이 저장 플로우에서 시작되지 않은 로그인(SIGNED_IN)에서 login_completed가 나가지
// 않게 하는 유일한 근거가 이 함수이므로, 존재 자체가 "처리 대상"의 증거가 된다.
export function consumePendingLoginAttempt(): PendingLoginAttempt | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  clearPendingLoginAttempt();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isValidPayload(parsed)) return null;
  if (Date.now() - parsed.createdAt > TTL_MS) return null;

  return parsed;
}

export function clearPendingLoginAttempt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
