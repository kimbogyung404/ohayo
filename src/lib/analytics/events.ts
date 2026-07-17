import { track } from './mixpanel';

// Mixpanel 이벤트 명세와 1:1로 대응하는 타입 있는 래퍼. 개인정보(이메일/이름/Google
// 계정 정보/access·refresh token/운세 원문 전체/Supabase 키/Mixpanel 토큰)는 어떤
// 속성에도 포함하지 않는다 — zodiacId, vocabularyId, 개수, 선택지 값 등 구조적
// 데이터만 보낸다.
//
// login_started / login_completed는 src/hooks/useAuth.ts에서만 다룬다. login_started는
// signInWithGoogle() 호출 시점, login_completed는 이 저장 플로우에서 실제로 로그인을
// 새로 시작해 성공한 경우에만(pending 로그인 시도 존재 여부로 판별) 전송한다 —
// identify()(mixpanel.ts)는 세션 연결만 하고 이벤트를 보내지 않는다.

// 사이트에 처음 진입하는 시점(RootLayout 마운트, PageViewTracker에서만 호출)에
// 무조건 한 번 보낸다 — zodiac_selected/learning_started 등 다른 모든 이벤트보다
// 먼저 발생해야 한다.
export function trackPageViewed(): void {
  track('page_viewed', {});
}

// 홈 화면에서 별자리를 클릭해 선택하는 시점(learning_started보다 앞선 시점 —
// learning_started는 이동 후 fortune 데이터 fetch가 성공했을 때 발생한다).
export function trackZodiacSelected(props: { zodiacId: string }): void {
  track('zodiac_selected', props);
}

export function trackLearningStarted(props: { zodiacId: string }): void {
  track('learning_started', props);
}

export function trackVocabOpened(props: { zodiacId: string; vocabularyId: string }): void {
  track('vocab_opened', props);
}

export function trackAllVocabViewed(props: { zodiacId: string }): void {
  track('all_vocab_viewed', props);
}

// timeSpentMs: learning_started 시점부터 review_started까지 걸린 시간(ms). 계산할
// 수 없는 경우(예: 기준 시점을 기록하지 못한 예외 상황)에는 생략하고 보내지 않는다.
export function trackReviewStarted(props: { zodiacId: string; timeSpentMs?: number }): void {
  const { zodiacId, timeSpentMs } = props;
  track('review_started', {
    zodiacId,
    ...(timeSpentMs !== undefined ? { timeSpentMs } : {}),
  });
}

// timeSpentMs: review_started 시점부터 저장 버튼 클릭까지 걸린 시간(ms). 계산할 수
// 없는 경우에는 생략하고 보내지 않는다.
export function trackSaveButtonClicked(props: {
  zodiacId: string;
  selectedCount: number;
  timeSpentMs?: number;
}): void {
  const { zodiacId, selectedCount, timeSpentMs } = props;
  track('save_button_clicked', {
    zodiacId,
    selectedCount,
    ...(timeSpentMs !== undefined ? { timeSpentMs } : {}),
  });
}

export function trackVocabSaved(props: { zodiacId: string; savedCount: number }): void {
  track('vocab_saved', props);
}

export function trackSavedTabViewed(props: { count: number }): void {
  track('saved_tab_viewed', props);
}

// 앞면 → 뒷면(공개)으로 바뀌는 순간에만 호출한다. 뒷면 → 앞면으로 되돌아갈 때는
// 호출하지 않는다(호출부에서 그 방향일 때만 이 함수를 부르도록 보장한다).
export function trackSavedVocabFlipped(props: { vocabularyId: string }): void {
  track('saved_vocab_flipped', props);
}

export function trackLearningFeedbackSelected(props: { zodiacId: string; value: string }): void {
  track('learning_feedback_selected', props);
}

export function trackLearningFeedbackReasonToggled(props: {
  zodiacId: string;
  reasonId: string;
  checked: boolean;
}): void {
  track('learning_feedback_reason_toggled', props);
}

export function trackCompletionActionClicked(props: {
  zodiacId: string;
  action: 'return_to_fortune' | 'view_saved';
}): void {
  track('completion_action_clicked', props);
}
