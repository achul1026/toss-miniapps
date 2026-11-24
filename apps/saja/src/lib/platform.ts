// 토스 SDK 호출을 감싸는 얇은 계층. 일반 브라우저(로컬 개발)에서는 대체 동작을 한다.
import { Storage, loadFullScreenAd, showFullScreenAd, TossAds } from '@apps-in-toss/web-framework';

// 콘솔에서 광고 그룹을 만든 뒤 .env 에 넣는다.
export const AD_IDS = {
  rewarded: import.meta.env.VITE_AD_REWARDED_ID ?? '',
  banner: import.meta.env.VITE_AD_BANNER_ID ?? '',
};

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await Storage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    try {
      const v = window.localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  try {
    await Storage.setItem(key, text);
  } catch {
    try {
      window.localStorage.setItem(key, text);
    } catch {
      /* 저장 불가 환경: 무시 */
    }
  }
}

// 보상형 광고를 보여주고, 끝까지 시청했으면 true.
export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    const adGroupId = AD_IDS.rewarded;
    const supported = adGroupId && loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
    if (!supported) {
      // 로컬 개발: 광고 없이 보상 지급
      resolve(import.meta.env.DEV);
      return;
    }
    let earned = false;
    loadFullScreenAd({
      options: { adGroupId },
      onEvent: (e) => {
        if (e.type !== 'loaded') return;
        showFullScreenAd({
          options: { adGroupId },
          onEvent: (s) => {
            if (s.type === 'userEarnedReward') earned = true;
            if (s.type === 'dismissed') resolve(earned);
            if (s.type === 'failedToShow') resolve(false);
          },
          onError: () => resolve(false),
        });
      },
      onError: () => resolve(false),
    });
  });
}

// 결과 화면 배너. 반환값은 정리 함수.
export function attachBanner(target: HTMLElement): () => void {
  const adGroupId = AD_IDS.banner;
  if (!adGroupId || !TossAds.attachBanner.isSupported()) return () => {};
  try {
    const r = TossAds.attachBanner(adGroupId, target, { theme: 'light', variant: 'card' });
    return r.destroy;
  } catch {
    return () => {};
  }
}
