// 밸런스 시뮬레이터: node tools/balance-sim/sim.ts
// 가상의 플레이어가 초당 TAPS번 탭하고, 살 수 있으면 '1용역비당 생산 증가'가 가장 큰 것을 산다.
import {
  GEARS, HIRES, RANKS, RANK_AT, buyGear, buyHire, careerFrom, costOf, addLines,
  SELF_TAPS_PER_SEC, linesPerSec, linesPerTap, multiplier, newState, rankIndex, synergy, type State,
} from '../../packages/dev-idle-core/src/economy.ts';

const TAPS = Number(process.env.TAPS ?? 3);

function bestBuy(s: State): State | null {
  const tapValue = TAPS + SELF_TAPS_PER_SEC; // 탭 1줄 = 초당 (TAPS + 자동) 줄
  let best: { score: number; next: State } | null = null;
  for (const h of HIRES) {
    const next = buyHire(s, h.id);
    if (!next) continue;
    const owned = s.hires[h.id] ?? 0;
    const gain = (owned + 1) * h.linesPerSec * synergy(owned + 1) - owned * h.linesPerSec * synergy(owned);
    const score = (gain * multiplier(s)) / costOf(h.baseCost, owned);
    if (!best || score > best.score) best = { score, next };
  }
  for (const g of GEARS) {
    const next = buyGear(s, g.id);
    if (!next) continue;
    const score = (g.tapBonus * multiplier(s) * tapValue) / costOf(g.baseCost, s.gears[g.id] ?? 0);
    if (!best || score > best.score) best = { score, next };
  }
  return best?.next ?? null;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분 ${Math.round(sec % 60)}초`;
}

function run(career: number, maxSec: number) {
  let s = newState(career);
  const reached: (number | null)[] = RANKS.map(() => null);
  const feeAt: number[] = RANKS.map(() => 0);
  reached[0] = 0;
  for (let t = 1; t <= maxSec; t++) {
    s = addLines(s, linesPerSec(s) + linesPerTap(s) * TAPS);
    for (let k = 0; k < 20; k++) {
      const next = bestBuy(s);
      if (!next) break;
      s = next;
    }
    const r = rankIndex(s.delivered);
    for (let i = 0; i <= r; i++) if (reached[i] === null) { reached[i] = t; feeAt[i] = s.totalFee; }
    if (r === RANKS.length - 1) break;
  }
  return { s, reached, feeAt };
}

const MAX = Number(process.env.MAX_MIN ?? 240) * 60;
for (const career of (process.env.CAREERS ?? '0,6,12,20').split(',').map(Number)) {
  const { s, reached, feeAt } = run(career, MAX);
  console.log(`\n경력 ${career} (생산 x${multiplier(s).toFixed(1)}), 초당 ${TAPS}탭`);
  RANKS.forEach((name, i) => {
    const t = reached[i];
    console.log(`  ${name.padEnd(8)} 프로젝트 ${String(RANK_AT[i]).padStart(3)}개  ${t === null ? '도달 못 함' : fmt(t).padEnd(9)}${t === null ? '' : `  이직 시 경력 ${careerFrom(feeAt[i])}`}`);
  });
  console.log(`  끝난 시점 누적 용역비 ${Math.round(s.totalFee).toLocaleString()} → 이직하면 경력 ${careerFrom(s.totalFee)}`);
}
