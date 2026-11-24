import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 콘솔에 '게임' 유형으로 등록한 appName과 같아야 한다 (등록 후 수정 불가).
  appName: 'si-dev-idle',
  brand: { primaryColor: '#2F6FED' },
  webView: {},
  permissions: [],
  webBundleDir: 'dist',
});
