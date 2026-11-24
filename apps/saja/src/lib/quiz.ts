import type { Idiom } from '../data/idioms';
import { seededOrder } from './daily';

export type QuestionKind = 'meaning' | 'blank' | 'situation';

export interface Question {
  kind: QuestionKind;
  prompt: string;
  sub?: string;
  options: string[];
  answer: number;
  idiomId: string;
}

function pickOthers<T>(pool: T[], exclude: (t: T) => boolean, count: number, seed: number): T[] {
  const candidates = pool.filter((t) => !exclude(t));
  return seededOrder(candidates.length, seed).slice(0, count).map((i) => candidates[i]);
}

function withAnswer(correct: string, wrong: string[], seed: number) {
  const all = [correct, ...wrong];
  const order = seededOrder(all.length, seed);
  const options = order.map((i) => all[i]);
  return { options, answer: options.indexOf(correct) };
}

export function buildQuiz(target: Idiom, all: Idiom[], seed: number): Question[] {
  const others = (n: number, s: number) => pickOthers(all, (i) => i.id === target.id, n, s);

  // 1) 뜻 맞히기
  const q1 = withAnswer(target.meaning, others(3, seed + 1).map((i) => i.meaning), seed + 2);

  // 2) 빈칸 채우기 (한글 한 글자)
  const pos = seed % 4;
  const chars = [...target.hangul];
  const missing = chars[pos];
  const masked = chars.map((c, i) => (i === pos ? '□' : c)).join('');
  const charPool = Array.from(new Set(all.flatMap((i) => [...i.hangul]))).filter((c) => !chars.includes(c));
  const wrongChars = seededOrder(charPool.length, seed + 3).slice(0, 3).map((i) => charPool[i]);
  const q2 = withAnswer(missing, wrongChars, seed + 4);

  // 3) 상황에 맞는 사자성어
  const q3 = withAnswer(target.hangul, others(3, seed + 5).map((i) => i.hangul), seed + 6);

  return [
    { kind: 'meaning', prompt: `'${target.hangul}'의 뜻은?`, sub: target.hanja, idiomId: target.id, ...q1 },
    { kind: 'blank', prompt: '빈칸에 들어갈 글자는?', sub: masked, idiomId: target.id, ...q2 },
    { kind: 'situation', prompt: '빈칸에 알맞은 사자성어는?', sub: target.example.replace('____', '○○○○'), idiomId: target.id, ...q3 },
  ];
}

// 보너스 복습 퀴즈: 이전에 배운 사자성어 중에서 뜻 맞히기 3문제.
export function buildReview(learned: Idiom[], all: Idiom[], seed: number): Question[] {
  if (learned.length === 0) return [];
  const order = seededOrder(learned.length, seed).slice(0, 3);
  return order.map((idx, n) => {
    const t = learned[idx];
    const wrong = pickOthers(all, (i) => i.id === t.id, 3, seed + 10 + n).map((i) => i.meaning);
    return { kind: 'meaning' as const, prompt: `'${t.hangul}'의 뜻은?`, sub: t.hanja, idiomId: t.id, ...withAnswer(t.meaning, wrong, seed + 20 + n) };
  });
}
