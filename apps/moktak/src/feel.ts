// 소리와 진동. 목탁 소리는 파일 없이 Web Audio로 만든다(나무 울림 + 짧은 타격음).
import { Device, Screen } from '@apps-in-toss/web-framework';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (document.visibilityState === 'hidden') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void ctx?.suspend();
  });
}

function tone(c: AudioContext, freq: number, endFreq: number, vol: number, len: number, type: OscillatorType = 'sine') {
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(endFreq, t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + len + 0.02);
}

function knock(c: AudioContext, freq: number, vol: number) {
  // 나무를 칠 때의 짧은 잡음
  const len = 0.03;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

/** 목탁: 속이 빈 나무가 "똑" 울리는 소리 */
export function moktakSound() {
  const c = audio();
  if (!c) return;
  const pitch = 1 + (Math.random() - 0.5) * 0.04; // 칠 때마다 아주 조금씩 다르게
  tone(c, 560 * pitch, 470 * pitch, 0.7, 0.22);
  tone(c, 1260 * pitch, 1150 * pitch, 0.22, 0.07);
  knock(c, 2200, 0.5);
}

/** 염주: 알끼리 부딪히는 "딸깍" */
export function beadSound() {
  const c = audio();
  if (!c) return;
  tone(c, 2400, 2100, 0.18, 0.035, 'triangle');
  knock(c, 3500, 0.35);
}

/** 108번 채웠을 때 맑은 종소리 */
export function bellSound() {
  const c = audio();
  if (!c) return;
  tone(c, 660, 655, 0.35, 2.2);
  tone(c, 1320, 1310, 0.12, 1.4);
  tone(c, 1980, 1975, 0.06, 0.9);
}

export function vibrate(strong = false) {
  try {
    void Device.triggerHaptic({ type: strong ? 'success' : 'tap' }).catch(() => navigator.vibrate?.(strong ? 40 : 12));
  } catch {
    navigator.vibrate?.(strong ? 40 : 12);
  }
}

/** 자동으로 두드리는 동안 화면이 꺼지지 않게 */
export function keepAwake(on: boolean) {
  try {
    void Screen.setAwakeMode({ enabled: on }).catch(() => undefined);
  } catch {
    /* 지원하지 않는 기기 */
  }
}
