import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 앱인토스 콘솔에 등록한 앱 이름과 똑같아야 업로드할 수 있어요.
  appName: 'daily-sajaseongeo',
  brand: {
    primaryColor: '#3182F6',
  },
  webView: {},
  permissions: [],
  webBundleDir: 'dist',
});
