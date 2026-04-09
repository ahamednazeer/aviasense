export const STORAGE_KEYS = {
    authToken: 'aviasense_auth_token',
    authUser: 'aviasense_auth_user',
};

export const CONFIG = {
    API_BASE_URL_CANDIDATES: [
        'http://10.0.2.2:5000',
        'http://10.0.2.2:5001',
    ],
    PREDICT_ENDPOINT: '/api/predict',
    HISTORY_ENDPOINT: '/api/history',
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
    apiBaseUrl: null,
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
