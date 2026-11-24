import { pickOthers, seededOrder, withAnswer, type Question } from 'daily-kit';
import { fill, type Spelling } from './data/items';

export function buildQuiz(t: Spelling, all: Spelling[], seed: number): Question[] {
  const others = (n: number, s: number) => pickOthers(all, (i) => i.id === t.id, n, s);

  // 1) 빈칸에 맞는 표기 (둘 중 하나)
  const q1 = withAnswer(t.right, [t.wrong], seed + 1);

  // 2) 바르게 쓴 문장 고르기
  const q2 = withAnswer(fill(t, t.right), [fill(t, t.wrong), ...others(2, seed + 2).map((o) => fill(o, o.wrong))], seed + 3);

  // 3) 맞춤법이 바른 말 고르기 (나머지는 다른 항목의 틀린 표기)
  const q3 = withAnswer(t.right, others(3, seed + 4).map((o) => o.wrong), seed + 5);

  return [
    { kind: 'blank', prompt: '빈칸에 맞는 말은?', sub: t.sentence.replace('{}', '○○'), itemId: t.id, explain: t.tip, ...q1 },
    { kind: 'sentence', prompt: '바르게 쓴 문장은?', itemId: t.id, explain: t.rule, ...q2 },
    { kind: 'word', prompt: '맞춤법이 바른 것은?', itemId: t.id, explain: `바른 표기는 ${t.right}, 틀린 표기는 ${t.wrong}. ${t.tip}`, ...q3 },
  ];
}

// 복습: 배운 것 중 3개를 빈칸 문제로
export function buildReview(learned: Spelling[], seed: number): Question[] {
  return seededOrder(learned.length, seed)
    .slice(0, 3)
    .map((idx, n) => {
      const t = learned[idx];
      return { kind: 'blank', prompt: '빈칸에 맞는 말은?', sub: t.sentence.replace('{}', '○○'), itemId: t.id, explain: t.tip, ...withAnswer(t.right, [t.wrong], seed + 10 + n) };
    });
}
