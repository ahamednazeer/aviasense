import { CONFIG, state, getApiBaseUrlCandidates } from './state.js';

export async function apiFetch(path, options = {}) {
    const candidates = getApiBaseUrlCandidates();

    let lastError;

    for (const baseUrl of candidates) {
        try {
            const response = await fetchWithTimeout(`${baseUrl}${path}`, options, state.apiTimeoutMs || CONFIG.DEFAULT_API_TIMEOUT_MS);
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

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
    }, timeoutMs);
    const externalSignal = options.signal;
    let removeAbortListener = null;

    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort();
        } else {
            const handleAbort = () => controller.abort();
            externalSignal.addEventListener('abort', handleAbort, { once: true });
            removeAbortListener = () => externalSignal.removeEventListener('abort', handleAbort);
        }
    }

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } catch (error) {
        if (didTimeout && error.name === 'AbortError') {
            throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
        removeAbortListener?.();
    }
}
