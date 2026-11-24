import { pickOthers, seededOrder, withAnswer, type Question } from 'daily-kit';
import { blanked, type Phrase } from './data/phrases';

// 빈칸에 둘 다 말이 되는 짝은 보기에서 뺀다
const CLASH: Record<string, string[]> = { window: ['aisle'], aisle: ['window'], picture: ['pictures'], pictures: ['picture'] };

function keyDistractors(t: Phrase, all: Phrase[], seed: number) {
  const k = t.key.toLowerCase();
  const pool = Array.from(new Set(all.map((p) => p.key.toLowerCase()))).filter((w) => w !== k && !(CLASH[k] ?? []).includes(w));
  // 첫 글자 대소문자를 정답과 맞춘다
  const cap = t.key[0] === t.key[0].toUpperCase();
  return seededOrder(pool.length, seed)
    .slice(0, 3)
    .map((i) => (cap ? pool[i][0].toUpperCase() + pool[i].slice(1) : pool[i]));
}

export function buildQuiz(t: Phrase, all: Phrase[], seed: number): Question[] {
  const others = (n: number, s: number) => pickOthers(all, (p) => p.id === t.id, n, s);
  const q1 = withAnswer(t.ko, others(3, seed + 1).map((p) => p.ko), seed + 2);
  const q2 = withAnswer(t.en, others(3, seed + 3).map((p) => p.en), seed + 4);
  const q3 = withAnswer(t.key, keyDistractors(t, all, seed + 5), seed + 6);
  return [
    { kind: 'meaning', prompt: '이 말의 뜻은?', sub: t.en, itemId: t.id, explain: `${t.en} = ${t.ko}`, ...q1 },
    { kind: 'when', prompt: `${t.when}, 뭐라고 말할까요?`, itemId: t.id, explain: `${t.en} (${t.say})`, ...q2 },
    { kind: 'blank', prompt: '빈칸에 들어갈 단어는?', sub: blanked(t), itemId: t.id, explain: `${t.en} = ${t.ko}`, ...q3 },
  ];
}

export function buildReview(learned: Phrase[], all: Phrase[], seed: number): Question[] {
  return seededOrder(learned.length, seed)
    .slice(0, 3)
    .map((idx, n) => {
      const t = learned[idx];
      const wrong = pickOthers(all, (p) => p.id === t.id, 3, seed + 10 + n).map((p) => p.ko);
      return { kind: 'meaning', prompt: '이 말의 뜻은?', sub: t.en, itemId: t.id, explain: `${t.en} = ${t.ko}`, ...withAnswer(t.ko, wrong, seed + 20 + n) };
    });
}
