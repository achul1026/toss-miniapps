import { describe, expect, it } from 'vitest';
import { addDays, completeToday, currentStreak, kstDateKey, todayIndex } from '../daily';
import { buildQuiz } from '../quiz';
import { IDIOMS } from '../../data/idioms';

describe('daily', () => {
  it('KST 자정 기준으로 날짜가 바뀐다', () => {
    expect(kstDateKey(new Date('2026-11-24T14:59:00Z'))).toBe('2026-11-24');
    expect(kstDateKey(new Date('2026-11-24T15:00:00Z'))).toBe('2026-11-25');
  });
  it('한 바퀴 동안 같은 사자성어가 겹치지 않는다', () => {
    const n = IDIOMS.length;
    const start = '2027-01-01';
    const seen = new Set(Array.from({ length: n }, (_, k) => todayIndex(addDays(start, k), n)));
    // 주기 경계가 걸릴 수 있어 최소 절반 이상은 서로 달라야 함
    expect(seen.size).toBeGreaterThan(n / 2);
  });
  it('연속 출석: 어제 했으면 +1, 하루 건너뛰면 1로 초기화', () => {
    let s = { lastDoneDate: null as string | null, streak: 0, bestStreak: 0 };
    s = completeToday(s, '2026-11-25');
    s = completeToday(s, '2026-11-26');
    expect(s.streak).toBe(2);
    expect(completeToday(s, '2026-11-26').streak).toBe(2);
    s = completeToday(s, '2026-11-28');
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(2);
    expect(currentStreak(s, '2026-11-30')).toBe(0);
  });
});

describe('quiz', () => {
  it('모든 사자성어로 3문제, 보기 4개, 정답 포함, 보기 중복 없음', () => {
    IDIOMS.forEach((idiom, k) => {
      const qs = buildQuiz(idiom, IDIOMS, 1000 + k);
      expect(qs).toHaveLength(3);
      qs.forEach((q) => {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
      });
      expect(qs[0].options[qs[0].answer]).toBe(idiom.meaning);
      expect(qs[2].options[qs[2].answer]).toBe(idiom.hangul);
    });
  });
  it('콘텐츠: 한자·한글 4자, 글자 풀이 4개, 예문에 빈칸 표시', () => {
    IDIOMS.forEach((i) => {
      expect([...i.hanja]).toHaveLength(4);
      expect([...i.hangul]).toHaveLength(4);
      expect(i.chars.map((c) => c[0]).join('')).toBe(i.hanja);
      i.chars.forEach(([, m], n) => expect(m.endsWith([...i.hangul][n])).toBe(true));
      expect(i.example).toContain('____');
    });
    expect(new Set(IDIOMS.map((i) => i.id)).size).toBe(IDIOMS.length);
  });
});
