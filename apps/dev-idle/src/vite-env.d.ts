/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_AD_REWARDED_ID?: string;
  readonly VITE_GAME_RATING?: string; // 예: 전체이용가
  readonly VITE_GAME_RATING_NO?: string; // 등급분류번호
}
