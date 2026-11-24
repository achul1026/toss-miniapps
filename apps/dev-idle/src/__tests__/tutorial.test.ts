import { describe, expect, it } from 'vitest';
import { newState } from 'dev-idle-core';
import { finishedTips, nextTip } from '../tutorial';

describe('안내 말풍선', () => {
  it('처음엔 사무실 누르기부터', () => {
    expect(nextTip(newState(), [])?.id).toBe('tap');
  });
  it('첫 납품 전에는 채용 안내를 먼저 보여 주지 않는다', () => {
    expect(nextTip({ ...newState(), fee: 100 }, [])?.id).toBe('tap');
  });
  it('납품 후 용역비가 모이면 채용 안내', () => {
    const s = { ...newState(), delivered: 1, fee: 20 };
    expect(nextTip(s, [])?.id).toBe('hire');
    expect(finishedTips(s, [])).toEqual(['tap']);
  });
  it('채용하면 조는 팀원 안내, 넘기면 장비 안내', () => {
    const s = { ...newState(), delivered: 2, fee: 20, hires: { junior: 1 } };
    expect(nextTip(s, ['tap', 'hire'])?.id).toBe('nap');
    expect(nextTip(s, ['tap', 'hire', 'nap'])?.id).toBe('gear');
  });
  it('다 본 사람에겐 아무것도 안 보여 준다', () => {
    const s = { ...newState(), delivered: 40, fee: 1e9, totalFee: 1e9, hires: { junior: 3 }, gears: { keyboard: 1 } };
    expect(nextTip(s, ['tap', 'hire', 'nap', 'gear', 'resign'])).toBeNull();
  });
});
