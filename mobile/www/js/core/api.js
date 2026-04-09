import { CONFIG, state } from './state.js';

export async function apiFetch(path, options = {}) {
    const candidates = state.apiBaseUrl
        ? [state.apiBaseUrl, ...CONFIG.API_BASE_URL_CANDIDATES.filter((url) => url !== state.apiBaseUrl)]
        : CONFIG.API_BASE_URL_CANDIDATES;

    let lastError;

    for (const baseUrl of candidates) {
        try {
            const response = await fetch(`${baseUrl}${path}`, options);
            state.apiBaseUrl = baseUrl;
            return response;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to reach backend.');
}

export function authHeaders(extra = {}) {
    const headers = { ...extra };
    if (state.authToken) {
        headers.Authorization = `Bearer ${state.authToken}`;
    }
    return headers;
}
