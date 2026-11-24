// 보기 섞기 도우미. 같은 seed면 모든 사용자에게 같은 보기 순서.
import { seededOrder } from './daily';

export interface Question {
  kind: string;
  prompt: string;
  sub?: string;
  options: string[];
  answer: number;
  itemId: string;
  explain?: string; // 답을 고른 뒤 보여 주는 한 줄 설명
}

export function pickOthers<T>(pool: T[], exclude: (t: T) => boolean, count: number, seed: number): T[] {
  const candidates = pool.filter((t) => !exclude(t));
  return seededOrder(candidates.length, seed).slice(0, count).map((i) => candidates[i]);
}

export function withAnswer(correct: string, wrong: string[], seed: number) {
  const all = [correct, ...wrong.filter((w) => w !== correct)];
  const order = seededOrder(all.length, seed);
  const options = order.map((i) => all[i]);
  return { options, answer: options.indexOf(correct) };
}
