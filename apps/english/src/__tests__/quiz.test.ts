import { describe, expect, it } from 'vitest';
import { PHRASES, blanked } from '../data/phrases';
import { buildQuiz, buildReview } from '../quiz';

describe('영어 표현 콘텐츠', () => {
  it('90개 이상, 핵심 단어가 문장 안에 있고 대답이 있다', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(90);
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length);
    for (const p of PHRASES) {
      expect(p.en).toContain(p.key);
      expect(blanked(p)).toContain('____');
      expect(p.reply).toHaveLength(2);
      expect(p.say.length).toBeGreaterThan(2);
    }
  });
});

describe('퀴즈', () => {
  it('모든 표현에서 세 문제 모두 정답이 하나, 보기가 겹치지 않는다', () => {
    PHRASES.forEach((t, k) => {
      const qs = buildQuiz(t, PHRASES, 50 + k);
      for (const q of qs) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
      expect(qs[2].options[qs[2].answer]).toBe(t.key);
    });
  });
  it('창가/통로처럼 둘 다 맞는 보기는 같이 나오지 않는다', () => {
    const w = PHRASES.find((p) => p.key === 'window')!;
    for (let s = 0; s < 40; s++) expect(buildQuiz(w, PHRASES, s)[2].options).not.toContain('aisle');
  });
  it('복습 3문제', () => {
    expect(buildReview(PHRASES.slice(0, 6), PHRASES, 1)).toHaveLength(3);
  });
});
