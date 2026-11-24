import { describe, expect, it } from 'vitest';
import { COFFEE_SPOTS, DESKS, SOFA_SPOTS, makeAgent, rand, routeTo, seatOf, step, wake, type Point } from '../sim';

// 책상(모니터 포함) 영역: drawDesk 기준 x..x+24, y-2..y+14
const deskRects = DESKS.map((d) => ({ x0: d.x, x1: d.x + 24, y0: d.y - 2, y1: d.y + 14 }));

function crossesDesk(a: Point, b: Point) {
  for (let t = 0; t <= 1; t += 0.02) {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (deskRects.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1)) return true;
  }
  return false;
}

describe('사무실 동선', () => {
  const seats = DESKS.map(seatOf);
  const spots = [...COFFEE_SPOTS, ...SOFA_SPOTS];
  it('어느 자리에서 탕비실·소파로 가도 책상을 지나가지 않는다 (왕복)', () => {
    for (const seat of seats) {
      for (const spot of spots) {
        for (const [from, to] of [[seat, spot], [spot, seat]] as const) {
          const pts = [from, ...routeTo(from, to)];
          for (let i = 1; i < pts.length; i++) expect(crossesDesk(pts[i - 1], pts[i])).toBe(false);
        }
      }
    }
  });

  it('일하다가 쉬러 갔다가 결국 자리로 돌아온다', () => {
    const r = rand(7);
    const agents = seats.slice(0, 5).map((s, i) => makeAgent(`a${i}`, 'junior', s, r));
    const visited = new Set<string>();
    for (let t = 0; t < 600; t++) {
      step(agents, 0.5, r);
      agents.forEach((a) => visited.add(a.activity));
    }
    expect(visited.has('coffee') || visited.has('nap')).toBe(true);
    // 쉬는 자리를 두 사람이 동시에 쓰지 않는다
    for (let t = 0; t < 400; t++) {
      step(agents, 0.25, r);
      const used = agents.filter((a) => a.spot).map((a) => `${a.spot!.kind}${a.spot!.i}`);
      expect(new Set(used).size).toBe(used.length);
    }
  });

  it('조는 사람은 깨우면 자리로 돌아간다', () => {
    const r = rand(3);
    const a = makeAgent('z', 'qa', seats[0], r);
    a.activity = 'nap';
    a.pos = { ...SOFA_SPOTS[0] };
    a.spot = { kind: 'sofa', i: 0 };
    expect(wake(a)).toBe(true);
    for (let t = 0; t < 200; t++) step([a], 0.1, r);
    expect(a.pos).toEqual(a.seat);
  });
});
