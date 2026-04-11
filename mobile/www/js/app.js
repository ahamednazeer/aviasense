import {
    CONFIG,
    getPreferredApiBaseUrl,
    getPreferredApiTimeoutMs,
    setApiBaseUrlOverride,
    setApiTimeoutOverrideMs,
    state,
} from './core/state.js';
import { initAuth, hydrateCurrentUser, renderAuthState } from './auth/session.js';
import { initImageCapture, initAudioCapture, initWaveformBars, resetCaptureState } from './features/media.js';
import { initNetworkDetection } from './ui/network.js';
import { sendPrediction } from './features/predictions.js';
import { initResults, initTabs } from './features/results.js';
import { initHistory, resetHistoryState } from './features/history.js';
import { showToast } from './ui/feedback.js';

document.addEventListener('DOMContentLoaded', async () => {
    initSplash();
    initServerSettings();
    initHistory();
    initTabs();
    initImageCapture({ onPredict: sendPrediction });
    initAudioCapture({ onPredict: sendPrediction });
    initResults({ onReset: resetAppState });
    initNetworkDetection();
    initWaveformBars();
    initAuth({ onLogout: resetAppState });
    renderAuthState();

    if (state.authToken) {
        await hydrateCurrentUser();
    }
});

function initSplash() {
    setTimeout(() => {
        const splash = document.querySelector('#splash-overlay');
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 700);
    }, 1800);
}

function resetAppState() {
    resetCaptureState();
    resetHistoryState();
    document.querySelector('#results-section').classList.add('hidden');
    document.querySelector('#predictions-list').innerHTML = '';
}

function initServerSettings() {
    const card = document.querySelector('.server-settings-card');
    const form = document.querySelector('#server-settings-form');
    const input = document.querySelector('#android-api-base-url-input');
    const timeoutInput = document.querySelector('#api-timeout-seconds-input');
    const currentValue = document.querySelector('#server-settings-current');
    const timeoutValue = document.querySelector('#server-settings-timeout');
    const resetButton = document.querySelector('#btn-reset-server-settings');
    const toggleButton = document.querySelector('#btn-toggle-server-settings');

    if (!card || !form || !input || !timeoutInput || !currentValue || !timeoutValue || !resetButton || !toggleButton) {
        return;
    }

    const syncLayout = () => {
        const isAuthenticated = Boolean(state.authToken && state.authUser);
        const isCompact = isAuthenticated && !card.dataset.expanded;

        card.classList.toggle('compact', isCompact);
        toggleButton.classList.toggle('hidden', !isAuthenticated);
        toggleButton.textContent = isCompact ? 'Edit' : 'Hide';
    };

    const render = () => {
        input.value = state.apiBaseUrlOverride || '';
        timeoutInput.value = String(Math.round(getPreferredApiTimeoutMs() / 1000));
        timeoutValue.textContent = `${Math.round(getPreferredApiTimeoutMs() / 1000)}s timeout`;

        if (state.apiBaseUrlOverride) {
            currentValue.textContent = `Saved URL: ${state.apiBaseUrlOverride} • Timeout: ${Math.round(getPreferredApiTimeoutMs() / 1000)}s`;
        } else {
            const fallbackUrl = getPreferredApiBaseUrl();
            currentValue.textContent = fallbackUrl
                ? `Default URL: ${fallbackUrl} • Timeout: ${Math.round(getPreferredApiTimeoutMs() / 1000)}s`
                : `No API base URL configured yet. Timeout: ${Math.round(getPreferredApiTimeoutMs() / 1000)}s`;
        }

        syncLayout();
    };

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const value = input.value.trim();
        const timeoutSeconds = Number(timeoutInput.value.trim());

        if (!value) {
            showToast('Enter a backend URL or use the reset button.', 'error');
            return;
        }

        if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 5 || timeoutSeconds > 300) {
            showToast('Timeout must be between 5 and 300 seconds.', 'error');
            return;
        }

        try {
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Only http and https URLs are supported.');
            }

            const savedUrl = setApiBaseUrlOverride(url.toString().replace(/\/+$/, ''));
            setApiTimeoutOverrideMs(timeoutSeconds * 1000);
            delete card.dataset.expanded;
            render();
            showToast(`Backend settings updated: ${savedUrl} (${timeoutSeconds}s)`, 'success');
        } catch (error) {
            showToast(error.message || 'Enter a valid backend URL.', 'error');
        }
    });

    resetButton.addEventListener('click', () => {
        setApiBaseUrlOverride('');
        setApiTimeoutOverrideMs(0);
        delete card.dataset.expanded;
        render();
        showToast(`Backend settings reset to default (${Math.round(CONFIG.DEFAULT_API_TIMEOUT_MS / 1000)}s).`, 'info');
    });

    toggleButton.addEventListener('click', () => {
        if (card.dataset.expanded) {
            delete card.dataset.expanded;
        } else {
            card.dataset.expanded = 'true';
        }
        syncLayout();
    });

    document.addEventListener('auth-state-changed', syncLayout);
    render();
}
