import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.noah.split', // the app's identity in the stores; the Android namespace stays org.example.split for now
  appName: 'Split',
  webDir: 'dist',
  android: { allowMixedContent: false },
};
export default config;
