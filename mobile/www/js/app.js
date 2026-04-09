import { state } from './core/state.js';
import { initAuth, hydrateCurrentUser, renderAuthState } from './auth/session.js';
import { initImageCapture, initAudioCapture, initWaveformBars, resetCaptureState } from './features/media.js';
import { initNetworkDetection } from './ui/network.js';
import { sendPrediction } from './features/predictions.js';
import { initResults, initTabs } from './features/results.js';
import { initHistory, resetHistoryState } from './features/history.js';

document.addEventListener('DOMContentLoaded', async () => {
    initSplash();
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
