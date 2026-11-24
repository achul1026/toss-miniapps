// SI 개발자 키우기 — 경제 규칙. 게임 화면과 밸런스 시뮬레이터가 같은 코드를 쓴다.
// 재화: 코드 줄(lines) → 프로젝트 납품 → 용역비(fee) → 팀원·장비 구매 → 생산량 증가
// 이직(환생): 누적 용역비로 경력(career)을 얻고 처음부터. 경력 1당 생산 +10%.

export const COST_GROWTH = 1.15;

export interface Hire {
  id: string;
  name: string;
  baseCost: number; // 용역비
  linesPerSec: number; // 1명당
}

export const HIRES: Hire[] = [
  { id: 'junior', name: '신입 개발자', baseCost: 15, linesPerSec: 1 },
  { id: 'publisher', name: '퍼블리셔', baseCost: 180, linesPerSec: 8 },
  { id: 'qa', name: 'QA', baseCost: 2_000, linesPerSec: 60 },
  { id: 'designer', name: '디자이너', baseCost: 24_000, linesPerSec: 420 },
  { id: 'dba', name: 'DBA', baseCost: 300_000, linesPerSec: 3_000 },
  { id: 'architect', name: '아키텍트', baseCost: 4_000_000, linesPerSec: 22_000 },
  { id: 'pmo', name: 'PMO', baseCost: 60_000_000, linesPerSec: 170_000 },
  { id: 'consultant', name: '외부 컨설턴트', baseCost: 900_000_000, linesPerSec: 1_300_000 },
];

export interface Gear {
  id: string;
  name: string;
  baseCost: number;
  tapBonus: number; // 탭당 코드 줄 추가
}

export const GEARS: Gear[] = [
  { id: 'keyboard', name: '기계식 키보드', baseCost: 10, tapBonus: 1 },
  { id: 'monitor', name: '듀얼 모니터', baseCost: 400, tapBonus: 12 },
  { id: 'chair', name: '허리 편한 의자', baseCost: 9_000, tapBonus: 150 },
];

export const RANKS = ['인턴', '신입', '주니어', '시니어', 'PL', 'PM', '리드 아키텍트', 'CTO'] as const;
// 누적 납품 프로젝트 수 기준
export const RANK_AT = [0, 3, 10, 22, 40, 65, 95, 130];

export function rankIndex(delivered: number): number {
  let r = 0;
  RANK_AT.forEach((need, i) => {
    if (delivered >= need) r = i;
  });
  return r;
}

// k번째 프로젝트 (0부터): 필요한 코드 줄과 보상 용역비
// 60번째 프로젝트까지는 빠르게, 이후로는 완만하게 커진다 (후반 벽 완화)
const EARLY = 60;
function growth(k: number, early: number, late: number): number {
  return k <= EARLY ? Math.pow(early, k) : Math.pow(early, EARLY) * Math.pow(late, k - EARLY);
}

export function project(k: number) {
  return {
    lines: Math.round(40 * growth(k, 1.22, 1.13)),
    fee: Math.round(12 * growth(k, 1.21, 1.125)),
  };
}

export function costOf(base: number, owned: number): number {
  return Math.ceil(base * Math.pow(COST_GROWTH, owned));
}

// 이직 시 얻는 경력: 누적 용역비 10만부터 1, 이후 10배마다 3씩
export function careerFrom(totalFee: number): number {
  if (totalFee < 100_000) return 0;
  return Math.floor(1 + 3 * Math.log10(totalFee / 100_000));
}

export interface State {
  lines: number; // 현재 프로젝트 진행 중인 코드 줄
  fee: number;
  totalFee: number; // 이번 회차 누적
  delivered: number;
  career: number;
  hires: Record<string, number>;
  gears: Record<string, number>;
}

export function newState(career = 0): State {
  return { lines: 0, fee: 0, totalFee: 0, delivered: 0, career, hires: {}, gears: {} };
}

export function multiplier(s: State): number {
  return 1 + 0.1 * s.career;
}

// 같은 팀원을 25·50·100·200명 모을 때마다 그 팀원의 생산량이 2배 (팀 시너지)
export const SYNERGY_AT = [25, 50, 100, 200];
export function synergy(owned: number): number {
  return Math.pow(2, SYNERGY_AT.filter((n) => owned >= n).length);
}

export function linesPerSec(s: State): number {
  return (
    HIRES.reduce((sum, h) => {
      const owned = s.hires[h.id] ?? 0;
      return sum + owned * h.linesPerSec * synergy(owned);
    }, 0) * multiplier(s)
  );
}

export function linesPerTap(s: State): number {
  return (1 + GEARS.reduce((sum, g) => sum + (s.gears[g.id] ?? 0) * g.tapBonus, 0)) * multiplier(s);
}

// 코드 줄을 더하고, 요구량을 채운 프로젝트는 납품 처리한다.
export function addLines(s: State, amount: number): State {
  let { lines, fee, totalFee, delivered } = s;
  lines += amount;
  for (;;) {
    const p = project(delivered);
    if (lines < p.lines) break;
    lines -= p.lines;
    fee += p.fee;
    totalFee += p.fee;
    delivered += 1;
  }
  return { ...s, lines, fee, totalFee, delivered };
}

export function buyHire(s: State, id: string): State | null {
  const h = HIRES.find((x) => x.id === id);
  if (!h) return null;
  const owned = s.hires[id] ?? 0;
  const cost = costOf(h.baseCost, owned);
  if (s.fee < cost) return null;
  return { ...s, fee: s.fee - cost, hires: { ...s.hires, [id]: owned + 1 } };
}

export function buyGear(s: State, id: string): State | null {
  const g = GEARS.find((x) => x.id === id);
  if (!g) return null;
  const owned = s.gears[id] ?? 0;
  const cost = costOf(g.baseCost, owned);
  if (s.fee < cost) return null;
  return { ...s, fee: s.fee - cost, gears: { ...s.gears, [id]: owned + 1 } };
}

export const OFFLINE_CAP_SEC = 8 * 60 * 60;

export function offlineLines(s: State, awaySec: number): number {
  return linesPerSec(s) * Math.min(awaySec, OFFLINE_CAP_SEC);
}
