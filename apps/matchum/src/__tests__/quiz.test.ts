import { describe, expect, it } from 'vitest';
import { ITEMS, fill } from '../data/items';
import { buildQuiz, buildReview } from '../quiz';

describe('맞춤법 콘텐츠', () => {
  it('모든 항목이 예문 빈칸과 서로 다른 표기를 가진다', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(90);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) {
      expect(i.sentence).toContain('{}');
      expect(i.right).not.toBe(i.wrong);
      expect(i.rule.length).toBeGreaterThan(5);
    }
  });
});

describe('퀴즈', () => {
  it('세 문제 모두 정답이 보기 안에 하나 있다', () => {
    for (let k = 0; k < ITEMS.length; k++) {
      const t = ITEMS[k];
      const qs = buildQuiz(t, ITEMS, 100 + k);
      expect(qs).toHaveLength(3);
      for (const q of qs) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
      expect(qs[1].options[qs[1].answer]).toBe(fill(t, t.right));
      expect(qs[2].options[qs[2].answer]).toBe(t.right);
    }
  });
  it('복습은 배운 것 중 최대 3문제', () => {
    expect(buildReview(ITEMS.slice(0, 5), 3)).toHaveLength(3);
    expect(buildReview(ITEMS.slice(0, 2), 3)).toHaveLength(2);
  });
});
