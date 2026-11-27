import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 앱인토스 콘솔에 등록한 앱 이름과 똑같아야 업로드할 수 있어요.
  appName: 'maeum-moktak',
  brand: {
    primaryColor: '#2F6F6A',
  },
  webView: {},
  permissions: [],
  webBundleDir: 'dist',
});
