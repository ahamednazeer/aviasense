export const STORAGE_KEYS = {
    authToken: 'aviasense_auth_token',
    authUser: 'aviasense_auth_user',
    apiBaseUrlOverride: 'aviasense_api_base_url_override',
    apiTimeoutOverrideMs: 'aviasense_api_timeout_override_ms',
};

const runtimeConfig = globalThis.__AVIASENSE_RUNTIME_CONFIG__ || {};
const runtimeApiBaseUrl = normalizeApiBaseUrl(runtimeConfig.ANDROID_API_BASE_URL);
const storedApiBaseUrlOverride = readStoredApiBaseUrlOverride();
const defaultApiTimeoutMs = 90000;
const storedApiTimeoutOverrideMs = readStoredApiTimeoutOverrideMs();

export const CONFIG = {
    DEFAULT_API_TIMEOUT_MS: defaultApiTimeoutMs,
    PREDICT_ENDPOINT: '/api/predict',
    HISTORY_ENDPOINT: '/api/history',
    VALIDATE_IMAGE_ENDPOINT: '/api/validate-image',
    SIGNIN_ENDPOINT: '/api/auth/signin',
    SIGNUP_ENDPOINT: '/api/auth/signup',
    ME_ENDPOINT: '/api/auth/me',
    LOGOUT_ENDPOINT: '/api/auth/logout',
    MAX_RECORDING_SECONDS: 30,
};

export const state = {
    currentAppView: 'scan',
    currentMode: 'image',
    imageFile: null,
    imageValidation: {
        isValidating: false,
        isBirdCandidate: false,
        message: '',
        confidence: null,
    },
    audioFile: null,
    isRecording: false,
    mediaRecorder: null,
    recordingChunks: [],
    recordingStartTime: null,
    recordingTimerInterval: null,
    analyserNode: null,
    audioContext: null,
    waveformRAF: null,
    isOnline: navigator.onLine,
    authMode: 'signin',
    apiBaseUrl: storedApiBaseUrlOverride || runtimeApiBaseUrl || null,
    apiBaseUrlOverride: storedApiBaseUrlOverride,
    apiTimeoutMs: storedApiTimeoutOverrideMs || defaultApiTimeoutMs,
    apiTimeoutOverrideMs: storedApiTimeoutOverrideMs,
    runtimeApiBaseUrl,
    historyItems: [],
    selectedHistoryId: null,
    authToken: localStorage.getItem(STORAGE_KEYS.authToken),
    authUser: parseStoredUser(),
};

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

function parseStoredUser() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.authUser);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getApiBaseUrlCandidates() {
    return uniqueUrls([
        normalizeAndroidEmulatorUrl(state.apiBaseUrl),
        state.apiBaseUrl,
        normalizeAndroidEmulatorUrl(state.apiBaseUrlOverride),
        state.apiBaseUrlOverride,
        normalizeAndroidEmulatorUrl(state.runtimeApiBaseUrl),
        state.runtimeApiBaseUrl,
        'http://10.0.2.2:5000',
        'http://10.0.2.2:5001',
    ]);
}

export function getPreferredApiBaseUrl() {
    return state.apiBaseUrlOverride || state.runtimeApiBaseUrl || '';
}

export function getPreferredApiTimeoutMs() {
    return state.apiTimeoutOverrideMs || CONFIG.DEFAULT_API_TIMEOUT_MS;
}

export function setApiBaseUrlOverride(value) {
    const normalizedValue = normalizeApiBaseUrl(value);

    state.apiBaseUrlOverride = normalizedValue;
    state.apiBaseUrl = normalizedValue || state.runtimeApiBaseUrl || null;

    if (normalizedValue) {
        localStorage.setItem(STORAGE_KEYS.apiBaseUrlOverride, normalizedValue);
        return normalizedValue;
    }

    localStorage.removeItem(STORAGE_KEYS.apiBaseUrlOverride);
    return '';
}

export function setApiTimeoutOverrideMs(value) {
    const normalizedValue = normalizeApiTimeoutMs(value);

    state.apiTimeoutOverrideMs = normalizedValue;
    state.apiTimeoutMs = normalizedValue || CONFIG.DEFAULT_API_TIMEOUT_MS;

    if (normalizedValue) {
        localStorage.setItem(STORAGE_KEYS.apiTimeoutOverrideMs, String(normalizedValue));
        return normalizedValue;
    }

    localStorage.removeItem(STORAGE_KEYS.apiTimeoutOverrideMs);
    return 0;
}

function readStoredApiBaseUrlOverride() {
    try {
        return normalizeApiBaseUrl(localStorage.getItem(STORAGE_KEYS.apiBaseUrlOverride));
    } catch {
        return '';
    }
}

function readStoredApiTimeoutOverrideMs() {
    try {
        return normalizeApiTimeoutMs(localStorage.getItem(STORAGE_KEYS.apiTimeoutOverrideMs));
    } catch {
        return 0;
    }
}

function normalizeApiBaseUrl(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }

    return value.trim().replace(/\/+$/, '');
}

function normalizeApiTimeoutMs(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return 0;
    }

    const rounded = Math.round(number);
    if (rounded < 5000 || rounded > 300000) {
        return 0;
    }

    return rounded;
}

function normalizeAndroidEmulatorUrl(value) {
    if (!value) {
        return '';
    }

    try {
        const url = new URL(value);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            url.hostname = '10.0.2.2';
            return url.toString().replace(/\/+$/, '');
        }
    } catch {
        return value;
    }

    return value;
}

function uniqueUrls(urls) {
    return urls.filter((url, index) => url && urls.indexOf(url) === index);
}
