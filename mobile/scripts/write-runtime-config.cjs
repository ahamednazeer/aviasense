const fs = require('node:fs');
const path = require('node:path');

const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
const runtimeConfigPath = path.resolve(__dirname, '..', 'www', 'js', 'core', 'runtime-config.js');

function loadEnvFile(envPath) {
  const values = {};

  if (!fs.existsSync(envPath)) {
    return values;
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

    values[key] = value;
  }

  return values;
}

function normalizeBaseUrl(value) {
  if (!value) {
    return '';
  }

  return value.trim().replace(/\/+$/, '');
}

const envValues = loadEnvFile(rootEnvPath);
const androidApiBaseUrl = normalizeBaseUrl(
  process.env.ANDROID_API_BASE_URL || envValues.ANDROID_API_BASE_URL || ''
);

const fileContents = `window.__AVIASENSE_RUNTIME_CONFIG__ = Object.freeze({
  ANDROID_API_BASE_URL: ${JSON.stringify(androidApiBaseUrl)}
});
`;

fs.writeFileSync(runtimeConfigPath, fileContents, 'utf8');
console.log(`Wrote runtime config to ${runtimeConfigPath}`);
