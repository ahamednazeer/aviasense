import { $, state, CONFIG } from '../core/state.js';
import { apiFetch, authHeaders } from '../core/api.js';
import { clearAuth, renderAuthState, requireAuth } from '../auth/session.js';
import { showToast, triggerHaptic } from '../ui/feedback.js';
import { checkOnline } from '../ui/network.js';
import { renderPredictions } from './results.js';
import { prependHistoryEntry } from './history.js';

export async function sendPrediction(file, type) {
    if (!checkOnline() || !requireAuth()) return;

    const resultsSection = $('#results-section');
    const loadingState = $('#loading-state');
    const predictionsList = $('#predictions-list');

    resultsSection.classList.remove('hidden');
    loadingState.classList.remove('hidden');
    predictionsList.innerHTML = '';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const formData = new FormData();
    formData.append('file', file, file.name || fallbackFilename(type, file));
    formData.append('type', type);

    try {
        let response = await apiFetch(CONFIG.PREDICT_ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: formData,
        });

        if (response.status === 400) {
            const errData = await response.json().catch(() => ({}));
            if (shouldRetryWithBase64(errData.error)) {
                response = await apiFetch(CONFIG.PREDICT_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders(),
                    },
                    body: JSON.stringify(await createBase64Payload(file, type)),
                });
            } else {
                throw new Error(errData.error || `Server error (${response.status})`);
            }
        }

        if (response.status === 401) {
            clearAuth();
            renderAuthState();
            throw new Error('Session expired. Please sign in again.');
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error (${response.status})`);
        }

        const data = await response.json();
        loadingState.classList.add('hidden');

        if (data.error) {
            showToast(data.error, 'error');
            return;
        }

        renderPredictions(data.predictions);
        prependHistoryEntry(data.history_entry);
        triggerHaptic();
        showToast('Bird identified successfully!', 'success');
    } catch (error) {
        loadingState.classList.add('hidden');
        console.error('Prediction error:', error);

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showToast('Cannot reach server. Check your connection and server URL.', 'error');
        } else {
            showToast(error.message || 'Prediction failed.', 'error');
        }
    }
}

function shouldRetryWithBase64(errorMessage) {
    return [
        'No file payload.',
        'No file part.',
        'No selected file.',
        'No type specified.',
        'Unsupported upload type.',
    ].includes(errorMessage);
}

async function createBase64Payload(file, type) {
    const dataUrl = await readFileAsDataUrl(file);
    return {
        type,
        filename: file?.name || fallbackFilename(type, file),
        mime_type: file?.type || '',
        file_data: dataUrl,
    };
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file for upload.'));
        reader.readAsDataURL(file);
    });
}

function fallbackFilename(type, file) {
    const ext = inferExtension(type, file?.type);
    return `upload.${ext}`;
}

function inferExtension(type, mimeType) {
    const mime = (mimeType || '').toLowerCase();
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
    if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('webm')) return 'webm';
    return type === 'audio' ? 'webm' : 'jpg';
}
