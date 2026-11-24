// 화면 이동: 토스·안드로이드 뒤로가기로 홈에 돌아온다. 자체 뒤로가기 버튼은 두지 않는다.
import { useEffect, useRef, useState } from 'react';

export function useScreens<S extends { name: string }>(home: S) {
  const [screen, setScreen] = useState<S>(home);
  const depth = useRef(0);
  useEffect(() => {
    const onPop = () => {
      depth.current = Math.max(0, depth.current - 1);
      setScreen(home);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (s: S) => {
    window.scrollTo(0, 0);
    if (s.name === home.name) {
      if (depth.current > 0) {
        const n = depth.current;
        depth.current = 0;
        history.go(-n);
      }
      setScreen(s);
      return;
    }
    if (depth.current === 0) {
      history.pushState({ screen: true }, '');
      depth.current = 1;
    }
    setScreen(s);
  };
  return [screen, go] as const;
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export { WEEK };
export function koreanDate(key: string) {
  const d = new Date(`${key}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEK[d.getUTCDay()]}요일`;
}
