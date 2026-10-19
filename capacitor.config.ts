import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.example.split', // change to your own reverse-domain id before publishing
  appName: 'Split',
  webDir: 'dist',
  android: { allowMixedContent: false },
};
export default config;
