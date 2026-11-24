// 큰 수를 한국식 단위로: 1.2만, 3.4억, 5.6조, 7.8경
const UNITS: [number, string][] = [
  [1e16, '경'],
  [1e12, '조'],
  [1e8, '억'],
  [1e4, '만'],
];

export function won(n: number): string {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  for (const [v, u] of UNITS) {
    if (abs >= v) {
      const x = n / v;
      return `${x >= 100 ? Math.floor(x).toLocaleString('ko-KR') : x.toFixed(1).replace(/\.0$/, '')}${u}`;
    }
  }
  // 10 미만 소수는 한 자리까지 (초당 0.5줄 같은 값)
  if (abs < 10 && !Number.isInteger(n)) return (Math.floor(n * 10) / 10).toString();
  return Math.floor(n).toLocaleString('ko-KR');
}

export function duration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  if (m > 0) return `${m}분`;
  return `${Math.max(1, Math.floor(sec))}초`;
}
