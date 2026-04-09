import fs from 'node:fs';
import path from 'node:path';

import type { CapacitorConfig } from '@capacitor/cli';

function loadRootEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  return value == null ? fallback : value.toLowerCase() === 'true';
}

function envValue(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

loadRootEnv();

const config: CapacitorConfig = {
  appId: process.env.ANDROID_APP_ID || 'com.aviasense.app',
  appName: process.env.ANDROID_APP_NAME || 'AviaSense',
  webDir: 'www',
  android: {
    allowMixedContent: envFlag('ANDROID_ALLOW_MIXED_CONTENT', true),
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
    androidScheme: envValue('ANDROID_SCHEME', 'http'),
    cleartext: envFlag('ANDROID_CLEARTEXT', true)
  }
};

export default config;
