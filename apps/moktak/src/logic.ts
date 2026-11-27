// 마음 목탁의 기록 계산. 점수·순위 없이 "오늘 몇 번 했는지"만 센다(게임이 아닌 기록 앱).
import { completeToday, currentStreak, type StreakState } from 'daily-kit';

export const GOAL = 108; // 하루 목표, 염주 한 바퀴
export type Mode = 'moktak' | 'yeomju';

export interface Saved extends StreakState {
  day: string; // today가 바뀌면 오늘 횟수를 0으로
  today: number; // 오늘 두드린 횟수
  total: number; // 지금까지 모두
  bead: number; // 염주 알 위치 (0~107)
  rounds: number; // 염주 바퀴 수
  doneDates: string[]; // 108번 채운 날
  phrase: string; // 떠오르는 문구 (예: 공덕)
  minus: boolean; // "걱정 -1"처럼 빼기로 보여 줄지
  mode: Mode;
  sound: boolean;
  haptic: boolean;
  reminder: 'agreed' | 'rejected' | null;
}

export const EMPTY: Saved = {
  lastDoneDate: null,
  streak: 0,
  bestStreak: 0,
  day: '',
  today: 0,
  total: 0,
  bead: 0,
  rounds: 0,
  doneDates: [],
  phrase: '공덕',
  minus: false,
  mode: 'moktak',
  sound: true,
  haptic: true,
  reminder: null,
};

/** 날짜가 바뀌었으면 오늘 횟수를 비운다 */
export function rollDay(s: Saved, today: string): Saved {
  return s.day === today ? s : { ...s, day: today, today: 0 };
}

export interface TapResult {
  next: Saved;
  reachedGoal: boolean; // 이번 탭으로 오늘 108번을 처음 채움
  roundDone: boolean; // 염주 한 바퀴를 돎
}

export function tap(prev: Saved, today: string, mode: Mode): TapResult {
  const s = rollDay(prev, today);
  const count = s.today + 1;
  let next: Saved = { ...s, today: count, total: s.total + 1 };
  let roundDone = false;
  if (mode === 'yeomju') {
    const bead = s.bead + 1;
    roundDone = bead >= GOAL;
    next = { ...next, bead: roundDone ? 0 : bead, rounds: s.rounds + (roundDone ? 1 : 0) };
  }
  const reachedGoal = count === GOAL;
  if (reachedGoal) {
    next = {
      ...next,
      ...completeToday(next, today),
      doneDates: next.doneDates.includes(today) ? next.doneDates : [...next.doneDates, today].slice(-400),
    };
  }
  return { next, reachedGoal, roundDone };
}

export const streakOf = (s: Saved, today: string) => currentStreak(s, today);

export const PHRASES: { phrase: string; minus: boolean }[] = [
  { phrase: '공덕', minus: false },
  { phrase: '행운', minus: false },
  { phrase: '건강', minus: false },
  { phrase: '평안', minus: false },
  { phrase: '지혜', minus: false },
  { phrase: '걱정', minus: true },
  { phrase: '번뇌', minus: true },
];

export const floatText = (s: Pick<Saved, 'phrase' | 'minus'>) => `${s.phrase} ${s.minus ? '-1' : '+1'}`;

/** 직접 쓴 문구 다듬기: 앞뒤 공백 빼고 6자까지 */
export const cleanPhrase = (t: string) => [...t.trim()].slice(0, 6).join('');
