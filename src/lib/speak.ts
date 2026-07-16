// 프로젝트에 별도의 TTS 유틸이 없어 브라우저 내장 Web Speech API로 최소 구현한다.
export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
