// 사무실 사람들의 움직임. 그림과 분리된 순수 로직이라 테스트하기 쉽다.
// 일하다(work) → 지치면 커피(coffee) 또는 낮잠(nap) → 자리로 돌아와 다시 일.

export type Activity = 'work' | 'walk' | 'coffee' | 'nap' | 'cheer';
export interface Point {
  x: number;
  y: number;
}

export interface Agent {
  id: string;
  role: string;
  seat: Point; // 앉는 자리 (발밑)
  pos: Point;
  activity: Activity;
  next: Activity; // 걷기가 끝나면 할 일
  path: Point[];
  timer: number; // 현재 활동 남은 시간(초)
  facing: 1 | -1;
  dir: 'down' | 'up' | 'side'; // 걷는 방향 (그림 선택용)
  spot: { kind: 'coffee' | 'sofa'; i: number } | null; // 잡아 둔 탕비실·소파 자리
}

// 사무실 동선: 위 줄은 책상 아래 통로(y=70), 아래 줄은 맨 아래 통로(y=116),
// 탕비실·소파로는 오른쪽 복도(x=120)를 따라 오르내린다. 책상을 가로지르지 않는다.
export const AISLE_TOP = 70;
export const AISLE_BOTTOM = 116;
export const CORRIDOR_X = 120;
export const COFFEE_SPOTS: Point[] = [
  { x: 150, y: 40 },
  { x: 140, y: 44 },
  { x: 132, y: 40 },
];
export const SOFA_SPOTS: Point[] = [
  { x: 134, y: 128 },
  { x: 147, y: 128 },
];
const WALK_SPEED = 22; // px/초

// 책상 8개: 위 줄 4개, 아래 줄 4개. 의자 위치(발밑)
export const DESKS: Point[] = [
  { x: 6, y: 32 },
  { x: 34, y: 32 },
  { x: 62, y: 32 },
  { x: 90, y: 32 },
  { x: 6, y: 84 },
  { x: 34, y: 84 },
  { x: 62, y: 84 },
  { x: 90, y: 84 },
];
export const seatOf = (desk: Point): Point => ({ x: desk.x + 12, y: desk.y + 22 });

// 내 자리: 직급이 오르면 창가 쪽(위 줄 오른쪽)으로 옮긴다
export function myDeskIndex(rank: number): number {
  if (rank >= 4) return 3; // PL부터 창가 끝자리
  if (rank >= 2) return 2;
  return 4; // 인턴·신입은 서버실 옆 구석
}

export function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function makeAgent(id: string, role: string, seat: Point, r: () => number): Agent {
  return {
    id,
    role,
    seat,
    pos: { ...seat },
    activity: 'work',
    next: 'work',
    path: [],
    timer: 8 + r() * 30, // 처음엔 일하는 시간을 흩어 놓는다
    facing: 1,
    dir: 'down',
    spot: null,
  };
}

const aisleOf = (p: Point) => (p.y > 80 ? AISLE_BOTTOM : AISLE_TOP);
const inDeskArea = (p: Point) => p.x < CORRIDOR_X - 2;

export function routeTo(from: Point, to: Point): Point[] {
  const pts: Point[] = [];
  if (inDeskArea(from)) {
    pts.push({ x: from.x, y: aisleOf(from) }, { x: CORRIDOR_X, y: aisleOf(from) });
  } else {
    pts.push({ x: CORRIDOR_X, y: from.y });
  }
  if (inDeskArea(to)) {
    pts.push({ x: CORRIDOR_X, y: aisleOf(to) }, { x: to.x, y: aisleOf(to) });
  } else {
    pts.push({ x: CORRIDOR_X, y: to.y });
  }
  pts.push({ ...to });
  return pts;
}

function go(a: Agent, to: Point, then: Activity) {
  a.path = routeTo(a.pos, to);
  a.activity = 'walk';
  a.next = then;
}

export function step(agents: Agent[], dt: number, r: () => number) {
  const takenCoffee = new Set(agents.filter((a) => a.spot?.kind === 'coffee').map((a) => a.spot!.i));
  const takenSofa = new Set(agents.filter((a) => a.spot?.kind === 'sofa').map((a) => a.spot!.i));

  for (const a of agents) {
    if (a.activity === 'walk') {
      let budget = WALK_SPEED * dt;
      while (budget > 0 && a.path.length) {
        const t = a.path[0];
        const dx = t.x - a.pos.x;
        const dy = t.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        if (dx !== 0) a.facing = dx > 0 ? 1 : -1;
        a.dir = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
        if (d <= budget) {
          a.pos = { ...t };
          a.path.shift();
          budget -= d;
        } else {
          a.pos = { x: a.pos.x + (dx / d) * budget, y: a.pos.y + (dy / d) * budget };
          budget = 0;
        }
      }
      if (!a.path.length) {
        a.activity = a.next;
        a.timer = a.next === 'coffee' ? 5 + r() * 4 : a.next === 'nap' ? 10 + r() * 10 : 25 + r() * 35;
      }
      continue;
    }

    a.timer -= dt;
    if (a.timer > 0) continue;

    if (a.activity === 'work') {
      // 지쳤다: 커피 70%, 낮잠 30% (자리가 비어 있을 때)
      const free = (spots: Point[], taken: Set<number>) => spots.findIndex((_, i) => !taken.has(i));
      const wantNap = r() < 0.3;
      const sofa = free(SOFA_SPOTS, takenSofa);
      const cup = free(COFFEE_SPOTS, takenCoffee);
      if (wantNap && sofa >= 0) {
        takenSofa.add(sofa);
        a.spot = { kind: 'sofa', i: sofa };
        go(a, SOFA_SPOTS[sofa], 'nap');
      } else if (cup >= 0) {
        takenCoffee.add(cup);
        a.spot = { kind: 'coffee', i: cup };
        go(a, COFFEE_SPOTS[cup], 'coffee');
      } else {
        a.timer = 10; // 탕비실이 붐비면 조금 더 일한다
      }
    } else {
      // 커피·낮잠·만세가 끝나면 자리로
      a.spot = null;
      if (a.pos.x === a.seat.x && a.pos.y === a.seat.y) {
        a.activity = 'work';
        a.timer = 25 + r() * 35;
      } else {
        go(a, a.seat, 'work');
      }
    }
  }
}

// 조는 사람을 깨운다. 깨웠으면 true.
export function wake(a: Agent): boolean {
  if (a.activity !== 'nap') return false;
  a.spot = null;
  go(a, a.seat, 'work');
  return true;
}

// 납품하면 다 같이 만세
export function cheerAll(agents: Agent[]) {
  for (const a of agents) {
    if (a.activity === 'work') {
      a.activity = 'cheer';
      a.timer = 1.6;
    }
  }
}

export const workingCount = (agents: Agent[]) => agents.filter((a) => a.activity === 'work').length;
