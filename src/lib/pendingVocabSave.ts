// OAuth 로그인 왕복(같은 탭에서 Google로 나갔다가 /auth/callback으로 돌아오는 동안)에
// "복습 화면에서 저장하기를 눌렀다"는 의도를 보존하기 위한 sessionStorage 페이로드.
// 같은 탭 안에서만 유지되면 되므로 sessionStorage를 쓰고, 오래되었거나 다른 zodiac의
// 값이 잘못 복원되지 않도록 버전·유효시간·zodiacId를 함께 저장한다.
// 단어 원문이나 개인정보는 저장하지 않고, 화면 복원에 필요한 최소 상태(id 목록)만 둔다.
const STORAGE_KEY = 'ohayo_pending_vocab_save';
const TTL_MS = 10 * 60 * 1000; // 10분
const PAYLOAD_VERSION = 1;

export interface PendingVocabSave {
  version: 1;
  returnPath: string;
  zodiacId: string;
  stage: 'review';
  selectedVocabIds: string[];
  pendingAction: 'save_vocab';
  createdAt: number;
  status: 'pending' | 'processing';
}

export function savePendingVocabSave(input: { zodiacId: string; selectedVocabIds: string[] }): void {
  const payload: PendingVocabSave = {
    version: PAYLOAD_VERSION,
    returnPath: `/fortune/${input.zodiacId}`,
    zodiacId: input.zodiacId,
    stage: 'review',
    selectedVocabIds: input.selectedVocabIds,
    pendingAction: 'save_vocab',
    createdAt: Date.now(),
    status: 'pending',
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage를 쓸 수 없는 환경이면 OAuth 복귀 후 자동 재개는 포기한다 —
    // 사용자가 review 화면에서 다시 저장을 시도해야 한다.
  }
}

function isValidPayload(value: unknown): value is PendingVocabSave {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === PAYLOAD_VERSION &&
    typeof v.returnPath === 'string' &&
    typeof v.zodiacId === 'string' &&
    v.stage === 'review' &&
    Array.isArray(v.selectedVocabIds) &&
    v.selectedVocabIds.every((id) => typeof id === 'string') &&
    v.pendingAction === 'save_vocab' &&
    typeof v.createdAt === 'number' &&
    (v.status === 'pending' || v.status === 'processing')
  );
}

// currentZodiacId와 저장된 zodiacId가 일치하고, 유효시간 안이며, 형식이 올바른 경우에만
// 페이로드를 반환한다. JSON parsing 실패나 만료된 값은 안전하게 폐기(삭제)한다.
// zodiacId가 다르면 — 다른 화면의 값을 이 화면에 잘못 복원하지 않기 위해 — 삭제하지
// 않고 그대로 둔 채 null만 반환한다(해당 zodiac 화면에서 나중에 다시 유효할 수 있음).
export function readPendingVocabSave(currentZodiacId: string): PendingVocabSave | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingVocabSave();
    return null;
  }

  if (!isValidPayload(parsed)) {
    clearPendingVocabSave();
    return null;
  }

  if (Date.now() - parsed.createdAt > TTL_MS) {
    clearPendingVocabSave();
    return null;
  }

  if (parsed.zodiacId !== currentZodiacId) {
    return null;
  }

  return parsed;
}

export function markPendingVocabSaveProcessing(): void {
  updateStatus('processing');
}

export function revertPendingVocabSaveToPending(): void {
  updateStatus('pending');
}

function updateStatus(status: PendingVocabSave['status']): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PendingVocabSave;
    parsed.status = status;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // 무시 — 다음 판독에서 형식 오류로 안전하게 폐기된다.
  }
}

export function clearPendingVocabSave(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
