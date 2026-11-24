import { create } from 'zustand';
import { Storage } from '@apps-in-toss/web-framework';
import {
  addLines,
  buyGear,
  buyHire,
  careerFrom,
  linesPerSec,
  linesPerTap,
  newState,
  offlineLines,
  OFFLINE_CAP_SEC,
  type State,
} from 'dev-idle-core';

const KEY = 'dev-idle:v1';

interface Saved {
  state: State;
  savedAt: number;
}

async function load(): Promise<Saved | null> {
  try {
    const v = (await Storage.getItem(KEY)) ?? window.localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Saved) : null;
  } catch {
    try {
      const v = window.localStorage.getItem(KEY);
      return v ? (JSON.parse(v) as Saved) : null;
    } catch {
      return null;
    }
  }
}

async function save(state: State) {
  const text = JSON.stringify({ state, savedAt: Date.now() } satisfies Saved);
  try {
    await Storage.setItem(KEY, text);
  } catch {
    try {
      window.localStorage.setItem(KEY, text);
    } catch {
      /* 저장 불가 */
    }
  }
}

export interface Offline {
  awaySec: number;
  lines: number;
  delivered: number;
  fee: number;
}

interface Game {
  ready: boolean;
  s: State;
  offline: Offline | null;
  taps: number; // 화면 연출용 누적 탭
  init: () => Promise<void>;
  tick: (dtSec: number) => void;
  tap: () => void;
  hire: (id: string) => void;
  gear: (id: string) => void;
  resign: () => Promise<void>; // 이직(환생)
  dismissOffline: () => void;
  persist: () => void;
}

export const useGame = create<Game>((set, get) => ({
  ready: false,
  s: newState(),
  offline: null,
  taps: 0,
  init: async () => {
    const saved = await load();
    if (!saved) {
      set({ ready: true });
      return;
    }
    const awaySec = Math.max(0, (Date.now() - saved.savedAt) / 1000);
    let s = saved.state;
    let offline: Offline | null = null;
    if (awaySec >= 60 && linesPerSec(s) > 0) {
      const gained = offlineLines(s, awaySec);
      const after = addLines(s, gained);
      offline = {
        awaySec: Math.min(awaySec, OFFLINE_CAP_SEC),
        lines: gained,
        delivered: after.delivered - s.delivered,
        fee: after.totalFee - s.totalFee,
      };
      s = after;
    }
    set({ s, offline, ready: true });
  },
  tick: (dt) => {
    const s = get().s;
    const lps = linesPerSec(s);
    if (lps > 0) set({ s: addLines(s, lps * dt) });
  },
  tap: () => {
    const s = get().s;
    set({ s: addLines(s, linesPerTap(s)), taps: get().taps + 1 });
  },
  hire: (id) => {
    const next = buyHire(get().s, id);
    if (next) set({ s: next });
  },
  gear: (id) => {
    const next = buyGear(get().s, id);
    if (next) set({ s: next });
  },
  resign: async () => {
    const s = get().s;
    const gain = careerFrom(s.totalFee);
    if (gain <= 0) return;
    const next = newState(s.career + gain);
    set({ s: next });
    await save(next);
  },
  dismissOffline: () => set({ offline: null }),
  persist: () => {
    void save(get().s);
  },
}));
