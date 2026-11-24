// 토스 SDK 호출을 감싸는 얇은 계층. 일반 브라우저(로컬 개발)에서는 대체 동작을 한다.
// 광고 규칙: https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa.md
import {
  Storage,
  loadFullScreenAd,
  showFullScreenAd,
  TossAds,
  isMinVersionSupported,
  requestNotificationAgreement,
} from '@apps-in-toss/web-framework';

// 개발 중에는 반드시 테스트 ID를 쓴다(실제 ID로 테스트하면 정책 위반).
// 실제 ID는 .env.production 에만 넣는다.
export const AD_IDS = {
  rewarded: import.meta.env.VITE_AD_REWARDED_ID || 'ait-ad-test-rewarded-id',
  banner: import.meta.env.VITE_AD_BANNER_ID || 'ait-ad-test-banner-id',
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

/* ── 리워드 광고 ──
   규칙: 화면 진입 시 미리 불러오고(load), 보여준 뒤(show) 다시 불러온다.
   보상은 userEarnedReward 이벤트에서만 준다. */

function rewardedSupported() {
  try {
    return loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
  } catch {
    return false;
  }
}

let rewardedReady = false;
let unloadRewarded: (() => void) | null = null;

export function preloadRewarded(onReady?: (ready: boolean) => void): () => void {
  if (!rewardedSupported()) {
    onReady?.(import.meta.env.DEV); // 로컬 브라우저: 개발 모드에선 광고 없이 동작 확인
    return () => {};
  }
  if (rewardedReady) {
    onReady?.(true);
    return () => {};
  }
  unloadRewarded?.();
  unloadRewarded = loadFullScreenAd({
    options: { adGroupId: AD_IDS.rewarded },
    onEvent: (e) => {
      if (e.type === 'loaded') {
        rewardedReady = true;
        onReady?.(true);
      }
    },
    onError: () => onReady?.(false),
  });
  return () => {
    unloadRewarded?.();
    unloadRewarded = null;
  };
}

// 리워드 광고를 보여주고, 보상을 받았으면 true.
export function showRewarded(): Promise<boolean> {
  if (!rewardedSupported()) return Promise.resolve(import.meta.env.DEV);
  if (!rewardedReady) return Promise.resolve(false);
  rewardedReady = false;
  return new Promise((resolve) => {
    let earned = false;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
      preloadRewarded(); // 다음 시청을 위해 다시 불러오기
    };
    showFullScreenAd({
      options: { adGroupId: AD_IDS.rewarded },
      onEvent: (e) => {
        if (e.type === 'userEarnedReward') {
          earned = true;
          // 일부 Android 버전에서 dismissed가 오지 않는 문제 대비
          setTimeout(() => finish(true), 1500);
        }
        if (e.type === 'dismissed') finish(earned);
        if (e.type === 'failedToShow') finish(false);
      },
      onError: () => finish(false),
    });
  });
}

/* ── 배너 광고 ──
   규칙: initialize는 앱 전체에서 한 번. 컨테이너는 width 100%, 비워 둔다.
   버튼 바로 옆에 두지 않고, 한 화면에 같은 형식 광고는 하나만. 토스 앱 5.241.0 이상. */

let bannerInit: 'idle' | 'pending' | 'ready' | 'failed' = 'idle';
const waiters: Array<(ok: boolean) => void> = [];

function initBanner(): Promise<boolean> {
  if (bannerInit === 'ready') return Promise.resolve(true);
  if (bannerInit === 'failed') return Promise.resolve(false);
  return new Promise((resolve) => {
    waiters.push(resolve);
    if (bannerInit === 'pending') return;
    const flush = (ok: boolean) => {
      bannerInit = ok ? 'ready' : 'failed';
      waiters.splice(0).forEach((w) => w(ok));
    };
    try {
      if (!TossAds.initialize.isSupported() || !isMinVersionSupported({ android: '5.241.0', ios: '5.241.0' })) {
        flush(false);
        return;
      }
      bannerInit = 'pending';
      TossAds.initialize({
        callbacks: { onInitialized: () => flush(true), onInitializationFailed: () => flush(false) },
      });
    } catch {
      flush(false);
    }
  });
}

// 배너를 붙이고 정리 함수를 돌려준다. 광고가 없으면 onEmpty가 호출된다.
export function attachBanner(target: HTMLElement, onEmpty: () => void): () => void {
  let destroy: (() => void) | null = null;
  let cancelled = false;
  initBanner().then((ok) => {
    if (cancelled) return;
    if (!ok || !TossAds.attachBanner.isSupported()) {
      onEmpty();
      return;
    }
    try {
      destroy = TossAds.attachBanner(AD_IDS.banner, target, {
        theme: 'light',
        tone: 'grey',
        variant: 'card',
        callbacks: { onNoFill: onEmpty, onAdFailedToRender: onEmpty },
      }).destroy;
    } catch {
      onEmpty();
    }
  });
  return () => {
    cancelled = true;
    destroy?.();
  };
}

/* ── 매일 아침 알림 동의 ──
   알림은 콘솔 > 푸시알림에서 '토스에게 발송 요청하기'로 매일 오전 8시 반복 발송한다.
   앱은 동의 화면만 띄운다. templateCode는 콘솔 템플릿의 발송 코드. */

export const PUSH_TEMPLATE_CODE = import.meta.env.VITE_PUSH_TEMPLATE_CODE ?? '';

export type ReminderResult = 'agreed' | 'rejected' | 'unsupported';

export function reminderSupported(): boolean {
  try {
    return !!PUSH_TEMPLATE_CODE && requestNotificationAgreement.isSupported();
  } catch {
    return false;
  }
}

export function requestDailyReminder(): Promise<ReminderResult> {
  if (!reminderSupported()) return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    let cleanup: (() => void) | null = null;
    const done = (r: ReminderResult) => {
      cleanup?.();
      resolve(r);
    };
    cleanup = requestNotificationAgreement({
      options: { templateCode: PUSH_TEMPLATE_CODE },
      onEvent: ({ type }) => done(type === 'agreementRejected' ? 'rejected' : 'agreed'),
      onError: () => done('unsupported'),
    });
  });
}
