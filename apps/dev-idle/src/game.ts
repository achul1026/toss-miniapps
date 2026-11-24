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
import {
  acceptChange,
  acceptOvertime,
  finishAudit,
  finishOutage,
  hitSpot,
  makeEvent,
  nextEventDelay,
  type Boost,
  type GameEvent,
} from './events';

const rnd = () => Math.random();

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
  bonus: (lines: number) => void; // 조는 팀원 깨우기 등
  hire: (id: string) => void;
  gear: (id: string) => void;
  resign: () => Promise<void>; // 이직(환생)
  dismissOffline: () => void;
  persist: () => void;
  // 이벤트
  event: GameEvent | null;
  boost: Boost | null;
  nextEventIn: number; // 초
  notice: string | null;
  hitEvent: (x: number, y: number) => boolean; // 사무실 좌표에서 버그·포스트잇 처리
  answerEvent: (accept: boolean) => void; // 야근·요구사항 변경 제안에 답하기
  clearNotice: () => void;
}

export const useGame = create<Game>((set, get) => ({
  ready: false,
  s: newState(),
  offline: null,
  taps: 0,
  event: null,
  boost: null,
  nextEventIn: 90, // 첫 이벤트는 90초 뒤
  notice: null,
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
    const g = get();
    let s = g.s;
    let boost = g.boost;
    const lps = linesPerSec(s) * (boost?.x ?? 1);
    if (lps > 0) s = addLines(s, lps * dt);
    if (boost) boost = boost.left - dt > 0 ? { ...boost, left: boost.left - dt } : null;

    // 이벤트 진행
    let event = g.event;
    let nextEventIn = g.nextEventIn;
    let notice = g.notice;
    if (event) {
      const left = event.left - dt;
      const allDone =
        (event.kind === 'outage' && event.bugs.every((b) => b.done)) || (event.kind === 'audit' && event.notes.every((n) => n.done));
      if (left <= 0 || allDone) {
        if (event.kind === 'outage') {
          const o = finishOutage(s, event);
          s = o.s;
          boost = o.boost ?? boost;
          notice = o.message;
        } else if (event.kind === 'audit') {
          const o = finishAudit(s, event);
          s = o.s;
          notice = o.message;
        }
        event = null;
        nextEventIn = nextEventDelay(rnd);
      } else {
        event = { ...event, left } as GameEvent;
      }
    } else if (s.delivered >= 3) {
      // 신입이 된 뒤부터 이벤트 시작
      nextEventIn -= dt;
      if (nextEventIn <= 0) event = makeEvent(rnd);
    }
    set({ s, boost, event, nextEventIn, notice });
  },
  hitEvent: (x, y) => {
    const ev = get().event;
    if (!ev) return false;
    if (ev.kind === 'outage') {
      const i = hitSpot(ev.bugs, x, y);
      if (i < 0) return false;
      set({ event: { ...ev, bugs: ev.bugs.map((b, k) => (k === i ? { ...b, done: true } : b)) } });
      return true;
    }
    if (ev.kind === 'audit') {
      const i = hitSpot(ev.notes, x, y);
      if (i < 0) return false;
      set({ event: { ...ev, notes: ev.notes.map((n, k) => (k === i ? { ...n, done: true } : n)) } });
      return true;
    }
    return false;
  },
  answerEvent: (accept) => {
    const g = get();
    const ev = g.event;
    if (!ev || (ev.kind !== 'overtime' && ev.kind !== 'change')) return;
    let { s, boost, notice } = g;
    if (accept && ev.kind === 'overtime') {
      boost = acceptOvertime();
      notice = '야근 시작! 60초 동안 생산량 2배';
    } else if (accept && ev.kind === 'change') {
      const o = acceptChange(s);
      s = o.s;
      notice = o.message;
    } else {
      notice = ev.kind === 'overtime' ? '오늘은 칼퇴했어요' : '변경 요청을 정중히 거절했어요';
    }
    set({ s, boost, notice, event: null, nextEventIn: nextEventDelay(rnd) });
  },
  clearNotice: () => set({ notice: null }),
  tap: () => {
    const s = get().s;
    set({ s: addLines(s, linesPerTap(s)), taps: get().taps + 1 });
  },
  bonus: (lines) => set({ s: addLines(get().s, lines) }),
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
