import { describe, expect, it } from 'vitest';
import { newState, project } from 'dev-idle-core';
import { acceptChange, finishAudit, finishOutage, hitSpot, makeEvent, rewardOf } from '../events';

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('사무실 이벤트', () => {
  it('확률에 따라 네 종류가 나온다', () => {
    expect(makeEvent(seq(0.1, 0.5)).kind).toBe('outage');
    expect(makeEvent(seq(0.4, 0.5)).kind).toBe('audit');
    expect(makeEvent(seq(0.7)).kind).toBe('overtime');
    expect(makeEvent(seq(0.9)).kind).toBe('change');
  });

  it('장애: 버그를 모두 잡으면 보상, 남기면 20초 동안 생산 절반', () => {
    const s = { ...newState(), delivered: 10 };
    const ev = makeEvent(seq(0.1, 0.3, 0.6, 0.2, 0.9));
    if (ev.kind !== 'outage') throw new Error();
    const fail = finishOutage(s, ev);
    expect(fail.boost).toEqual({ x: 0.5, left: 20, reason: 'outage' });
    const win = finishOutage(s, { ...ev, bugs: ev.bugs.map((b) => ({ ...b, done: true })) });
    expect(win.s.fee).toBe(rewardOf(s, 0.6));
    expect(win.boost).toBeNull();
  });

  it('감리: 모두 처리하면 보상, 아니면 보상 없음', () => {
    const s = { ...newState(), delivered: 5 };
    const ev = makeEvent(seq(0.4, 0.2, 0.7, 0.1));
    if (ev.kind !== 'audit') throw new Error();
    expect(finishAudit(s, ev).s.fee).toBe(0);
    expect(finishAudit(s, { ...ev, notes: ev.notes.map((n) => ({ ...n, done: true })) }).s.fee).toBe(rewardOf(s, 0.8));
  });

  it('요구사항 변경: 진척 30% 감소, 용역비 추가, 진척이 음수가 되지 않음', () => {
    const s = { ...newState(), delivered: 8, lines: 0 };
    const o = acceptChange(s);
    expect(o.s.lines).toBe(0);
    const s2 = { ...s, lines: project(8).lines * 0.5 };
    expect(acceptChange(s2).s.lines).toBeCloseTo(project(8).lines * 0.2);
    expect(o.s.fee).toBeGreaterThan(0);
  });

  it('누른 자리 근처의 버그만 잡히고, 이미 잡은 건 다시 안 잡힌다', () => {
    const spots = [
      { x: 20, y: 70, done: false },
      { x: 90, y: 70, done: true },
    ];
    expect(hitSpot(spots, 24, 66)).toBe(0);
    expect(hitSpot(spots, 90, 70)).toBe(-1);
    expect(hitSpot(spots, 60, 70)).toBe(-1);
  });
});

import { useGame } from '../game';
describe('누적 납품 기록', () => {
  it('납품하면 오르고 이직해도 줄지 않는다', () => {
    useGame.setState({ ready: true, lifetime: 5 });
    const s = useGame.getState().s;
    useGame.setState({ s: { ...s, delivered: s.delivered + 2 } });
    expect(useGame.getState().lifetime).toBe(7);
    const after = useGame.getState().s;
    useGame.setState({ s: { ...after, delivered: 0, career: after.career + 3 } });
    expect(useGame.getState().lifetime).toBe(7);
  });
});
