import { create } from 'zustand';
import { kstDateKey, loadJSON, saveJSON } from 'daily-kit';
import { EMPTY, rollDay, tap as tapLogic, type Mode, type Saved } from './logic';

const KEY = 'moktak:v1';

interface App {
  ready: boolean;
  s: Saved;
  init: () => Promise<void>;
  tap: () => { reachedGoal: boolean; roundDone: boolean };
  set: (patch: Partial<Saved>) => void;
  setMode: (m: Mode) => void;
  flush: () => Promise<void>;
}

let saveTimer: number | undefined;

export const useApp = create<App>((set, get) => {
  const persistSoon = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveJSON(KEY, get().s), 600); // 빠르게 두드려도 저장은 몰아서
  };
  return {
    ready: false,
    s: EMPTY,
    init: async () => {
      const saved = await loadJSON<Saved>(KEY, EMPTY);
      set({ s: rollDay({ ...EMPTY, ...saved }, kstDateKey()), ready: true });
    },
    tap: () => {
      const r = tapLogic(get().s, kstDateKey(), get().s.mode);
      set({ s: r.next });
      if (r.reachedGoal) void saveJSON(KEY, r.next);
      else persistSoon();
      return r;
    },
    set: (patch) => {
      set({ s: { ...get().s, ...patch } });
      void saveJSON(KEY, get().s);
    },
    setMode: (mode) => get().set({ mode }),
    flush: async () => {
      window.clearTimeout(saveTimer);
      await saveJSON(KEY, get().s);
    },
  };
});
