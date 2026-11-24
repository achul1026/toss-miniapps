// 듣기: 기기에 들어 있는 영어 음성으로 읽어 준다. 지원하지 않으면 버튼을 숨긴다.
export function canSpeak(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  } catch {
    return false;
  }
}

export function speak(text: string, slow = false) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = slow ? 0.65 : 0.85;
  const voice = synth.getVoices().find((v) => v.lang?.startsWith('en-US')) ?? synth.getVoices().find((v) => v.lang?.startsWith('en'));
  if (voice) u.voice = voice;
  synth.speak(u);
}

// 앱이 뒤로 가면 읽던 것을 멈춘다
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && canSpeak()) window.speechSynthesis.cancel();
  });
}
