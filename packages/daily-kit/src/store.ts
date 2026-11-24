// "하루 하나" 앱 공용 저장소: 오늘의 항목, 연속 출석, 배운 것, 오답 노트, 알림 동의.
import { create } from 'zustand';
import { completeToday, currentStreak, kstDateKey, todayIndex, type StreakState } from './daily';
import { loadJSON, saveJSON } from './platform';

export interface Saved extends StreakState {
  learned: string[];
  wrong: string[];
  doneDates: string[];
  todayScore: Record<string, number>;
  reminder: 'agreed' | 'rejected' | null;
}

const EMPTY: Saved = { lastDoneDate: null, streak: 0, bestStreak: 0, learned: [], wrong: [], doneDates: [], todayScore: {}, reminder: null };

export interface DailyState<T> {
  ready: boolean;
  today: string;
  item: T;
  saved: Saved;
  init: () => Promise<void>;
  finishToday: (correct: number, wrongIds: string[]) => Promise<void>;
  clearWrong: (id: string) => Promise<void>;
  setReminder: (r: 'agreed' | 'rejected') => Promise<void>;
  streakNow: () => number;
}

export function createDailyStore<T extends { id: string }>(key: string, items: T[], seed: number) {
  return create<DailyState<T>>((set, get) => {
    const today = kstDateKey();
    const persist = async (next: Saved) => {
      set({ saved: next });
      await saveJSON(key, next);
    };
    return {
      ready: false,
      today,
      item: items[todayIndex(today, items.length, seed)],
      saved: EMPTY,
      init: async () => {
        const saved = await loadJSON<Saved>(key, EMPTY);
        set({ saved: { ...EMPTY, ...saved }, ready: true });
      },
      finishToday: async (correct, wrongIds) => {
        const { saved, today, item } = get();
        await persist({
          ...saved,
          ...completeToday(saved, today),
          learned: saved.learned.includes(item.id) ? saved.learned : [...saved.learned, item.id],
          wrong: Array.from(new Set([...saved.wrong, ...wrongIds])),
          doneDates: saved.doneDates.includes(today) ? saved.doneDates : [...saved.doneDates, today].slice(-400),
          todayScore: { ...saved.todayScore, [today]: Math.max(saved.todayScore[today] ?? 0, correct) },
        });
      },
      clearWrong: (id) => persist({ ...get().saved, wrong: get().saved.wrong.filter((w) => w !== id) }),
      setReminder: (r) => persist({ ...get().saved, reminder: r }),
      streakNow: () => currentStreak(get().saved, get().today),
    };
  });
}
