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
  project,
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

import { ownsMacbook, recoverPending, SKU, type SkuId } from './lib/shop';
import { won } from './lib/format';

const rnd = () => Math.random();

export interface Perks {
  macbook: boolean; // 생산 영구 2배 (이직해도 유지)
}

const KEY = 'dev-idle:v1';

interface Saved {
  state: State;
  savedAt: number;
  perks?: Perks;
  granted?: string[]; // 지급 끝난 주문 번호 (중복 지급 방지)
  tips?: string[]; // 다 본 안내 말풍선
  lifetime?: number; // 이직 포함 지금까지 납품한 프로젝트 수 (리더보드 점수)
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

async function save(g: { s: State; perks: Perks; granted: string[]; tips: string[]; lifetime: number }) {
  const text = JSON.stringify({ state: g.s, savedAt: Date.now(), perks: g.perks, granted: g.granted.slice(-200), tips: g.tips, lifetime: g.lifetime } satisfies Saved);
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
  // 수익화
  perks: Perks;
  granted: string[];
  offlineDoubled: boolean;
  perkX: () => number;
  grant: (sku: SkuId, orderId: string) => boolean;
  doubleOffline: () => void; // 광고 보고 자리 비운 수익 2배
  answerEventBoosted: () => void; // 광고 보고 야근 4배
  // 안내
  tips: string[];
  seeTips: (ids: string[]) => void;
  lifetime: number;
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
  perks: { macbook: false },
  granted: [],
  offlineDoubled: false,
  tips: [],
  lifetime: 0,
  seeTips: (ids) => {
    const tips = [...new Set([...get().tips, ...ids])];
    if (tips.length !== get().tips.length) set({ tips });
  },
  perkX: () => (get().perks.macbook ? 2 : 1),
  init: async () => {
    const saved = await load();
    if (saved?.perks) set({ perks: saved.perks, granted: saved.granted ?? [] });
    if (saved?.tips) set({ tips: saved.tips });
    // 예전 저장본에는 누적 기록이 없어서 지금 회사의 납품 수로 시작한다
    if (saved) set({ lifetime: saved.lifetime ?? saved.state.delivered });
    // 지급 못 한 주문, 맥북 구매 내역 복원 (토스 앱에서만 동작)
    void recoverPending((sku, id) => get().grant(sku, id));
    void ownsMacbook().then((owns) => {
      if (owns !== null && owns !== get().perks.macbook) set({ perks: { ...get().perks, macbook: owns } });
    });
    if (!saved) {
      set({ ready: true });
      return;
    }
    const awaySec = Math.max(0, (Date.now() - saved.savedAt) / 1000);
    let s = saved.state;
    let offline: Offline | null = null;
    if (awaySec >= 60 && linesPerSec(s) > 0) {
      const gained = offlineLines(s, awaySec) * (saved.perks?.macbook ? 2 : 1);
      const after = addLines(s, gained);
      offline = {
        awaySec: Math.min(awaySec, OFFLINE_CAP_SEC),
        lines: gained,
        delivered: after.delivered - s.delivered,
        fee: after.totalFee - s.totalFee,
      };
      s = after;
    }
    set({ s, offline, ready: true, lifetime: get().lifetime + (offline?.delivered ?? 0) });
  },
  tick: (dt) => {
    const g = get();
    let s = g.s;
    let boost = g.boost;
    const lps = linesPerSec(s) * (boost?.x ?? 1) * g.perkX();
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
    set({ s: addLines(s, linesPerTap(s) * get().perkX()), taps: get().taps + 1 });
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
    await save({ ...get(), s: next });
  },
  dismissOffline: () => set({ offline: null, offlineDoubled: false }),
  persist: () => {
    void save(get());
  },
  grant: (sku, orderId) => {
    const g = get();
    if (g.granted.includes(orderId)) return true; // 이미 지급됨
    let { s, perks } = g;
    let notice: string;
    if (sku === SKU.starter) {
      const fee = project(s.delivered).fee * 10;
      s = { ...s, fee: s.fee + fee, totalFee: s.totalFee + fee };
      notice = '신입 지원금이 들어왔어요';
    } else if (sku === SKU.macbook) {
      perks = { ...perks, macbook: true };
      notice = '최신 맥북 지급! 생산량이 영구 2배가 됐어요';
    } else {
      return false;
    }
    const granted = [...g.granted, orderId];
    set({ s, perks, granted, notice });
    void save({ ...get(), s, perks, granted });
    return true;
  },
  doubleOffline: () => {
    const g = get();
    if (!g.offline || g.offlineDoubled) return;
    set({ s: addLines(g.s, g.offline.lines), offlineDoubled: true, notice: `자리 비운 수익 2배! 코드 +${won(g.offline.lines)}줄` });
  },
  answerEventBoosted: () => {
    const ev = get().event;
    if (ev?.kind !== 'overtime') return;
    set({
      boost: { x: 4, left: 60, reason: 'overtime' },
      notice: '광고 덕분에 야근 효율 4배!',
      event: null,
      nextEventIn: nextEventDelay(rnd),
    });
  },
}));

// 납품할 때마다 누적 기록을 올린다 (이직으로 납품 수가 0이 되는 건 빼고)
useGame.subscribe((g, prev) => {
  if (!g.ready || !prev.ready) return;
  const n = g.s.delivered - prev.s.delivered;
  if (n > 0 && g.s.career === prev.s.career) useGame.setState({ lifetime: g.lifetime + n });
});
