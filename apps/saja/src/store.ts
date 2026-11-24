import { create } from 'zustand';
import { IDIOMS, type Idiom } from './data/idioms';
import { completeToday, currentStreak, kstDateKey, todayIndex, type StreakState } from './lib/daily';
import { loadJSON, saveJSON } from './lib/platform';

const KEY = 'saja:v1';

interface Saved extends StreakState {
  learned: string[]; // 배운 사자성어 id
  wrong: string[]; // 오답 노트 id
  doneDates: string[]; // 완료한 날짜 (출석표)
  todayScore: Record<string, number>;
  reminder: 'agreed' | 'rejected' | null; // 매일 아침 알림 동의 여부
}

const EMPTY: Saved = { lastDoneDate: null, streak: 0, bestStreak: 0, learned: [], wrong: [], doneDates: [], todayScore: {}, reminder: null };

interface AppState {
  ready: boolean;
  today: string;
  idiom: Idiom;
  saved: Saved;
  init: () => Promise<void>;
  finishToday: (correct: number, wrongIds: string[]) => Promise<void>;
  clearWrong: (id: string) => Promise<void>;
  setReminder: (r: 'agreed' | 'rejected') => Promise<void>;
  streakNow: () => number;
}

export const useApp = create<AppState>((set, get) => {
  const today = kstDateKey();
  return {
    ready: false,
    today,
    idiom: IDIOMS[todayIndex(today, IDIOMS.length)],
    saved: EMPTY,
    init: async () => {
      const saved = await loadJSON<Saved>(KEY, EMPTY);
      set({ saved: { ...EMPTY, ...saved }, ready: true });
    },
    finishToday: async (correct, wrongIds) => {
      const { saved, today, idiom } = get();
      const streak = completeToday(saved, today);
      const next: Saved = {
        ...saved,
        ...streak,
        learned: saved.learned.includes(idiom.id) ? saved.learned : [...saved.learned, idiom.id],
        wrong: Array.from(new Set([...saved.wrong, ...wrongIds])),
        doneDates: saved.doneDates.includes(today) ? saved.doneDates : [...saved.doneDates, today].slice(-400),
        todayScore: { ...saved.todayScore, [today]: Math.max(saved.todayScore[today] ?? 0, correct) },
      };
      set({ saved: next });
      await saveJSON(KEY, next);
    },
    clearWrong: async (id) => {
      const next = { ...get().saved, wrong: get().saved.wrong.filter((w) => w !== id) };
      set({ saved: next });
      await saveJSON(KEY, next);
    },
    setReminder: async (r) => {
      const next = { ...get().saved, reminder: r };
      set({ saved: next });
      await saveJSON(KEY, next);
    },
    streakNow: () => currentStreak(get().saved, get().today),
  };
});
