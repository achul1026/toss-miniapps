// 인앱 결제. 콘솔 > 인앱 결제에 같은 SKU로 상품을 등록해야 한다.
// 흐름: 주문 → processProductGrant에서 지급 후 true → 완료.
// 지급 전에 앱이 꺼진 주문은 다음 실행 때 getPendingOrders로 찾아 지급하고 completeProductGrant.
import { IAP, type CompletedOrRefundedOrdersResult, type IapProductListItem } from '@apps-in-toss/web-framework';

export const SKU = {
  starter: 'dev_idle_starter', // 소모성: 신입 지원금
  macbook: 'dev_idle_macbook', // 비소모성: 생산량 영구 2배
} as const;
export type SkuId = (typeof SKU)[keyof typeof SKU];

export interface Catalog {
  sku: SkuId;
  name: string;
  desc: string;
  price: string | null; // 토스 앱에서 받아 온 표시 가격
}

export const CATALOG: Omit<Catalog, 'price'>[] = [
  { sku: SKU.starter, name: '신입 지원금', desc: '지금 단계 프로젝트 10건분 용역비를 바로 받아요. 여러 번 살 수 있어요.' },
  { sku: SKU.macbook, name: '최신 맥북 지급', desc: '모든 생산량이 영구히 2배. 이직해도 그대로예요.' },
];

export function iapSupported() {
  try {
    return IAP.createOneTimePurchaseOrder.isSupported();
  } catch {
    return false;
  }
}

export async function loadPrices(): Promise<Record<string, string>> {
  if (!iapSupported()) return {};
  try {
    const { products } = await IAP.getProductItemList();
    return Object.fromEntries(products.map((p: IapProductListItem) => [p.sku, p.displayAmount]));
  } catch {
    return {};
  }
}

// 구매. grant는 실제 지급 함수 (성공하면 true)
export function buy(sku: SkuId, grant: (sku: SkuId, orderId: string) => boolean): Promise<'done' | 'failed'> {
  if (!iapSupported()) return Promise.resolve('failed');
  return new Promise((resolve) => {
    let cleanup: (() => void) | null = null;
    cleanup = IAP.createOneTimePurchaseOrder({
      options: { sku, processProductGrant: ({ orderId }) => grant(sku, orderId) },
      onEvent: () => {
        cleanup?.();
        resolve('done');
      },
      onError: () => {
        cleanup?.();
        resolve('failed');
      },
    });
  });
}

// 지급 못 한 주문 다시 지급
export async function recoverPending(grant: (sku: SkuId, orderId: string) => boolean) {
  if (!iapSupported()) return;
  try {
    const { orders } = await IAP.getPendingOrders();
    for (const o of orders) {
      if (grant(o.sku as SkuId, o.orderId)) await IAP.completeProductGrant({ params: { orderId: o.orderId } });
    }
  } catch {
    /* 다음 실행 때 다시 시도 */
  }
}

// 비소모성(맥북) 구매 내역 복원. 환불됐으면 false
export async function ownsMacbook(): Promise<boolean | null> {
  if (!iapSupported()) return null;
  try {
    let key: string | null | undefined = null;
    let owns = false;
    for (let i = 0; i < 10; i++) {
      const r: CompletedOrRefundedOrdersResult = await IAP.getCompletedOrRefundedOrders(key ? { key } : undefined);
      for (const o of r.orders) if (o.sku === SKU.macbook) owns = o.status === 'COMPLETED';
      if (!r.hasNext) break;
      key = r.nextKey;
    }
    return owns;
  } catch {
    return null;
  }
}
