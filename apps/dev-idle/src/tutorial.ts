// 처음 하는 사람 안내 말풍선. 게임 상태만 보고 지금 보여 줄 안내 하나를 고른다.
// 화면을 가리지 않는 말풍선으로, 할 일을 하면 저절로 사라지고 "알겠어요"로 넘길 수도 있다.
import { careerFrom, costOf, GEARS, HIRES, type State } from 'dev-idle-core';

export type TipTarget = 'scene' | 'hire' | 'gear' | 'resign' | 'event';

export interface Tip {
  id: string;
  text: string;
  target: TipTarget;
}

const count = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

interface Rule extends Tip {
  show: (s: State) => boolean; // 이때 보여 준다
  done: (s: State) => boolean; // 이렇게 되면 할 일을 한 것
}

const RULES: Rule[] = [
  {
    id: 'tap',
    target: 'scene',
    text: '가만히 있어도 내가 알아서 코드를 써요. 사무실을 누르면 더 빨리 써요. 진척률을 100% 채우면 납품하고 용역비를 받아요.',
    show: () => true,
    done: (s) => s.delivered >= 1,
  },
  {
    id: 'hire',
    target: 'hire',
    text: `용역비가 모였어요. ${HIRES[0].name}를 채용하면 팀원도 알아서 코드를 써서 훨씬 빨라져요.`,
    show: (s) => s.fee >= HIRES[0].baseCost,
    done: (s) => count(s.hires) > 0,
  },
  {
    id: 'nap',
    target: 'scene',
    text: '팀원은 가끔 커피를 마시거나 졸아요. 조는 팀원을 누르면 깨워서 보너스를 받아요.',
    show: (s) => count(s.hires) > 0,
    done: () => false,
  },
  {
    id: 'gear',
    target: 'gear',
    text: `${GEARS[0].name}를 사면 내가 자동으로 쓰는 속도와 누를 때 쓰는 코드가 같이 늘어요.`,
    show: (s) => count(s.hires) > 0 && s.fee >= costOf(GEARS[0].baseCost, s.gears[GEARS[0].id] ?? 0),
    done: (s) => count(s.gears) > 0,
  },
  {
    id: 'resign',
    target: 'resign',
    text: '이직하면 처음부터 다시 하지만, 쌓인 경력만큼 모든 생산량이 영구히 늘어요.',
    show: (s) => s.career === 0 && careerFrom(s.totalFee) >= 3,
    done: (s) => s.career > 0,
  },
];

/** 지금 보여 줄 안내. 본 것과 이미 한 일은 건너뛴다. */
export function nextTip(s: State, seen: readonly string[]): Tip | null {
  for (const r of RULES) {
    if (seen.includes(r.id) || r.done(s)) continue;
    if (r.show(s)) return { id: r.id, text: r.text, target: r.target };
    // 앞 단계가 아직이면 뒤 단계도 기다린다 (순서대로 배우도록)
    if (r.id === 'tap' || r.id === 'hire') return null;
  }
  return null;
}

/** 상태가 바뀌어 할 일을 마친 안내들 (본 것으로 기록) */
export function finishedTips(s: State, seen: readonly string[]): string[] {
  return RULES.filter((r) => !seen.includes(r.id) && r.done(s)).map((r) => r.id);
}
