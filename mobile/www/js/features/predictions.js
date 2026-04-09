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
    formData.append('file', file, file.name);
    formData.append('type', type);

    try {
        const response = await apiFetch(CONFIG.PREDICT_ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: formData,
        });

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
