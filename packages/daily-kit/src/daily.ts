// 날짜·연속 출석 계산. 모든 날짜는 한국 시간(KST) 기준 'YYYY-MM-DD' 문자열.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function kstDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS);
}

export function addDays(dateKey: string, days: number): string {
  return new Date((dayNumber(dateKey) + days) * DAY_MS).toISOString().slice(0, 10);
}

// 시드 기반 셔플: 같은 시드면 모든 사용자에게 같은 순서.
export function seededOrder(length: number, seed: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// 오늘의 항목 인덱스. 한 바퀴를 다 돌면 새 순서로 다시 섞는다. 앱마다 seed를 달리 준다.
export function todayIndex(dateKey: string, total: number, seed = 20261125): number {
  const n = dayNumber(dateKey);
  const cycle = Math.floor(n / total);
  const order = seededOrder(total, seed + cycle);
  return order[n % total];
}

export interface StreakState {
  lastDoneDate: string | null;
  streak: number;
  bestStreak: number;
}

// 오늘 퀴즈를 끝냈을 때의 연속 출석 갱신.
export function completeToday(state: StreakState, today: string): StreakState {
  if (state.lastDoneDate === today) return state;
  const streak = state.lastDoneDate === addDays(today, -1) ? state.streak + 1 : 1;
  return { lastDoneDate: today, streak, bestStreak: Math.max(state.bestStreak, streak) };
}

// 화면에 보여줄 현재 연속 일수 (어제 이후로 끊겼으면 0).
export function currentStreak(state: StreakState, today: string): number {
  if (!state.lastDoneDate) return 0;
  if (state.lastDoneDate === today || state.lastDoneDate === addDays(today, -1)) return state.streak;
  return 0;
}
