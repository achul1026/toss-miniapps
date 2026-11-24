// 효과음. 파일 없이 Web Audio로 짧은 8비트 소리를 만든다.
// 첫 터치 뒤에만 소리를 내고, 앱이 뒤로 가면 멈추고, 끄기 설정은 기기에 저장한다.

const KEY = 'dev-idle:sound';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

function readMuted() {
  try {
    return window.localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    window.localStorage.setItem(KEY, m ? 'off' : 'on');
  } catch {
    /* 저장 불가 */
  }
  if (m) void ctx?.suspend();
  listeners.forEach((f) => f(m));
}

export function onMutedChange(f: (m: boolean) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

function audio(): AudioContext | null {
  if (muted || document.visibilityState === 'hidden') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// 앱이 뒤로 가면 소리를 멈춘다
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void ctx?.suspend();
    else if (!muted) void ctx?.resume();
  });
}

function note(freq: number, at: number, len: number, type: OscillatorType = 'square', vol = 1) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + len + 0.02);
}

// 같은 소리가 너무 자주 겹치지 않게
const lastAt: Record<string, number> = {};
function throttle(key: string, ms: number) {
  const now = performance.now();
  if (now - (lastAt[key] ?? 0) < ms) return false;
  lastAt[key] = now;
  return true;
}

const KEYS = [880, 988, 1047, 1175, 1319];

export const sfx = {
  /** 키보드 치는 소리 */
  tap() {
    if (!throttle('tap', 45)) return;
    note(KEYS[Math.floor(Math.random() * KEYS.length)], 0, 0.035, 'square', 0.35);
  },
  /** 납품 */
  deliver() {
    if (!throttle('deliver', 450)) return;
    note(784, 0, 0.09, 'triangle');
    note(1175, 0.08, 0.16, 'triangle');
  },
  /** 채용·장비 구매 */
  buy() {
    note(988, 0, 0.06, 'square', 0.5);
    note(1319, 0.06, 0.12, 'square', 0.5);
  },
  /** 승진 */
  promote() {
    [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.18, 'triangle'));
  },
  /** 이벤트 발생 */
  alert() {
    note(660, 0, 0.12, 'sawtooth', 0.4);
    note(660, 0.18, 0.12, 'sawtooth', 0.4);
  },
  /** 버그 잡기·포스트잇 떼기·졸던 팀원 깨우기 */
  pop() {
    note(520, 0, 0.05, 'square', 0.5);
    note(1040, 0.03, 0.07, 'square', 0.4);
  },
};
