import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aviasense.app',
  appName: 'AviaSense',
  webDir: 'www',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false,
      launchAutoHide: true,
      splashFullScreen: true,
      splashImmersive: true
    },
    Camera: {
      presentationStyle: 'fullscreen'
    }
  },
  server: {
    cleartext: true
  }
};

export default config;
