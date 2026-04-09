import { $, state } from '../core/state.js';
import { showToast } from './feedback.js';

export function initNetworkDetection() {
    updateNetworkUI();

    window.addEventListener('online', () => {
        state.isOnline = true;
        updateNetworkUI();
        showToast('Back online', 'success');
    });

    window.addEventListener('offline', () => {
        state.isOnline = false;
        updateNetworkUI();
        showToast('You are offline. Bird identification requires a network connection.', 'error');
    });
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
