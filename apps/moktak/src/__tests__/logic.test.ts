import { describe, expect, it } from 'vitest';
import { cleanPhrase, EMPTY, floatText, GOAL, rollDay, tap, type Saved } from '../logic';

const run = (s: Saved, n: number, day: string, mode: 'moktak' | 'yeomju' = 'moktak') => {
  let cur = s;
  let goals = 0;
  let rounds = 0;
  for (let i = 0; i < n; i++) {
    const r = tap(cur, day, mode);
    cur = r.next;
    if (r.reachedGoal) goals++;
    if (r.roundDone) rounds++;
  }
  return { s: cur, goals, rounds };
};

describe('마음 목탁 기록', () => {
  it('하루 108번을 채우면 그날 한 번만 도장', () => {
    const { s, goals } = run(EMPTY, 250, '2026-11-27');
    expect(goals).toBe(1);
    expect(s.today).toBe(250);
    expect(s.doneDates).toEqual(['2026-11-27']);
    expect(s.streak).toBe(1);
  });
  it('날짜가 바뀌면 오늘 횟수는 0부터, 누적은 유지', () => {
    const a = run(EMPTY, GOAL, '2026-11-27').s;
    const b = rollDay(a, '2026-11-28');
    expect(b.today).toBe(0);
    expect(b.total).toBe(GOAL);
    const c = run(b, GOAL, '2026-11-28').s;
    expect(c.streak).toBe(2);
  });
  it('염주는 108알마다 한 바퀴', () => {
    const { s, rounds } = run(EMPTY, 230, '2026-11-27', 'yeomju');
    expect(rounds).toBe(2);
    expect(s.rounds).toBe(2);
    expect(s.bead).toBe(230 - 216);
  });
  it('문구', () => {
    expect(floatText({ phrase: '공덕', minus: false })).toBe('공덕 +1');
    expect(floatText({ phrase: '걱정', minus: true })).toBe('걱정 -1');
    expect(cleanPhrase('  우리 가족 건강하자 ')).toBe('우리 가족 ');
  });
});
