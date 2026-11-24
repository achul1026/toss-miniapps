// 사무실 이벤트: 장애 발생, 감리 지적, 야근 제안, 요구사항 변경.
// 화면이 켜져 있을 때만 2~4분마다 하나씩 일어난다. 순수 로직이라 테스트할 수 있다.
import { project, type State } from 'dev-idle-core';

export interface Spot {
  x: number;
  y: number;
  done: boolean;
}

export type GameEvent =
  | { kind: 'outage'; left: number; bugs: Spot[] }
  | { kind: 'audit'; left: number; notes: Spot[] }
  | { kind: 'overtime'; left: number } // 수락 대기
  | { kind: 'change'; left: number }; // 수락 대기

export interface Boost {
  x: number; // 생산 배율
  left: number; // 남은 초
  reason: 'overtime' | 'outage';
}

export const EVENT_SEC = 15;
export const OVERTIME_SEC = 60;

// 버그가 나타날 수 있는 바닥 자리 (통로·복도). 사무실 좌표계(160x144)
const FLOOR: [number, number][] = [
  [24, 70], [44, 70], [66, 70], [88, 70], [108, 70],
  [30, 114], [50, 112], [74, 114], [96, 112],
  [120, 54], [120, 90], [140, 60], [146, 96],
];
// 감리 포스트잇이 붙는 책상 위 자리
const DESK_TOPS: [number, number][] = [
  [18, 36], [46, 36], [74, 36], [102, 36],
  [18, 88], [46, 88], [74, 88], [102, 88],
];

function pick<T>(list: T[], n: number, r: () => number): T[] {
  const copy = [...list];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
}

export function nextEventDelay(r: () => number) {
  return 120 + r() * 120;
}

export function makeEvent(r: () => number): GameEvent {
  const roll = r();
  if (roll < 0.35) return { kind: 'outage', left: EVENT_SEC, bugs: pick(FLOOR, 4, r).map(([x, y]) => ({ x, y, done: false })) };
  if (roll < 0.6) return { kind: 'audit', left: EVENT_SEC, notes: pick(DESK_TOPS, 3, r).map(([x, y]) => ({ x, y, done: false })) };
  if (roll < 0.85) return { kind: 'overtime', left: EVENT_SEC };
  return { kind: 'change', left: EVENT_SEC };
}

// 보상은 '지금 프로젝트 납품 보상'에 비례해서 성장 단계와 상관없이 의미 있게
export const rewardOf = (s: State, ratio: number) => Math.max(10, Math.round(project(s.delivered).fee * ratio));

export interface Outcome {
  s: State;
  boost: Boost | null;
  message: string;
}

export function finishOutage(s: State, ev: Extract<GameEvent, { kind: 'outage' }>): Outcome {
  if (ev.bugs.every((b) => b.done)) {
    const fee = rewardOf(s, 0.6);
    return { s: { ...s, fee: s.fee + fee, totalFee: s.totalFee + fee }, boost: null, message: `장애 복구 완료! 긴급 대응비 +${fee}` };
  }
  return { s, boost: { x: 0.5, left: 20, reason: 'outage' }, message: '장애 복구가 늦어져 20초 동안 생산량이 절반이에요' };
}

export function finishAudit(s: State, ev: Extract<GameEvent, { kind: 'audit' }>): Outcome {
  if (ev.notes.every((n) => n.done)) {
    const fee = rewardOf(s, 0.8);
    return { s: { ...s, fee: s.fee + fee, totalFee: s.totalFee + fee }, boost: null, message: `감리 통과! 잔금 조기 지급 +${fee}` };
  }
  return { s, boost: null, message: '지적 사항이 남아 다음 감리로 넘어갔어요' };
}

export function acceptChange(s: State): Outcome {
  const p = project(s.delivered);
  const fee = rewardOf(s, 0.6);
  return {
    s: { ...s, lines: Math.max(0, s.lines - p.lines * 0.3), fee: s.fee + fee, totalFee: s.totalFee + fee },
    boost: null,
    message: `변경 계약 체결. 진척률은 줄었지만 추가 용역비 +${fee}`,
  };
}

export function acceptOvertime(): Boost {
  return { x: 2, left: OVERTIME_SEC, reason: 'overtime' };
}

// 화면에서 누른 자리에 버그·포스트잇이 있으면 처리. 처리했으면 그 인덱스
export function hitSpot(spots: Spot[], x: number, y: number, radius = 9): number {
  return spots.findIndex((p) => !p.done && Math.abs(p.x - x) <= radius && Math.abs(p.y - y) <= radius);
}
