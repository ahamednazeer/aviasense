import { $, state } from '../core/state.js';
import { showToast } from './feedback.js';

export function initNetworkDetection() {
    const fallbackOnlineHandler = () => applyNetworkStatus(true, true);
    const fallbackOfflineHandler = () => applyNetworkStatus(false, true);

    window.addEventListener('online', fallbackOnlineHandler);
    window.addEventListener('offline', fallbackOfflineHandler);

    const networkPlugin = window.Capacitor?.Plugins?.Network;
    if (networkPlugin) {
        networkPlugin.getStatus()
            .then((status) => applyNetworkStatus(Boolean(status.connected)))
            .catch(() => updateNetworkUI());

        networkPlugin.addListener('networkStatusChange', (status) => {
            applyNetworkStatus(Boolean(status.connected), true);
        });
        return;
    }

    applyNetworkStatus(Boolean(navigator.onLine));
}

export function checkOnline() {
    if (!state.isOnline) {
        showToast('No internet connection. Please connect and try again.', 'error');
        return false;
    }
    return true;
}

function updateNetworkUI() {
    const indicator = $('#network-indicator');
    if (!indicator) {
        return;
    }

    if (state.isOnline) {
        indicator.classList.remove('offline');
        indicator.classList.add('online');
        indicator.querySelector('.network-label').textContent = 'Online';
    } else {
        indicator.classList.remove('online');
        indicator.classList.add('offline');
        indicator.querySelector('.network-label').textContent = 'Offline';
    }
}

function applyNetworkStatus(isOnline, notify = false) {
    const hasChanged = state.isOnline !== isOnline;
    state.isOnline = isOnline;
    updateNetworkUI();

    if (!notify || !hasChanged) {
        return;
    }

    if (isOnline) {
        showToast('Back online', 'success');
        return;
    }

    showToast('You are offline. Bird identification requires a network connection.', 'error');
}
