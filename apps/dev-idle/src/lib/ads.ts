// 보상형 광고. 규칙: 미리 불러오고(load) → 보여주고(show) → 다시 불러온다.
// 보상은 userEarnedReward에서만. 개발 중에는 테스트 ID만 쓴다.
import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

const REWARDED_ID = import.meta.env.VITE_AD_REWARDED_ID || 'ait-ad-test-rewarded-id';

function supported() {
  try {
    return loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
  } catch {
    return false;
  }
}

let ready = false;
let unload: (() => void) | null = null;
const listeners = new Set<(r: boolean) => void>();

export function adReady() {
  return supported() ? ready : import.meta.env.DEV;
}

export function onAdReady(fn: (r: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function preloadRewarded() {
  if (!supported() || ready || unload) return;
  unload = loadFullScreenAd({
    options: { adGroupId: REWARDED_ID },
    onEvent: (e) => {
      if (e.type === 'loaded') {
        ready = true;
        listeners.forEach((l) => l(true));
      }
    },
    onError: () => {
      unload = null;
    },
  });
}

export function showRewarded(): Promise<boolean> {
  if (!supported()) return Promise.resolve(import.meta.env.DEV);
  if (!ready) return Promise.resolve(false);
  ready = false;
  listeners.forEach((l) => l(false));
  return new Promise((resolve) => {
    let earned = false;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      unload?.();
      unload = null;
      resolve(ok);
      preloadRewarded();
    };
    showFullScreenAd({
      options: { adGroupId: REWARDED_ID },
      onEvent: (e) => {
        if (e.type === 'userEarnedReward') {
          earned = true;
          setTimeout(() => finish(true), 1500); // 일부 Android에서 dismissed 누락 대비
        }
        if (e.type === 'dismissed') finish(earned);
        if (e.type === 'failedToShow') finish(false);
      },
      onError: () => finish(false),
    });
  });
}
