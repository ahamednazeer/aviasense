import { $ } from '../core/state.js';

export function showToast(message, type = 'info') {
    const container = $('#toast-container');

    const icons = {
        error: 'alert-circle',
        success: 'checkmark-circle',
        info: 'information-circle',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <ion-icon name="${icons[type] || icons.info}"></ion-icon>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

export function triggerHaptic() {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
            window.Capacitor.Plugins.Haptics.impact({ style: 'MEDIUM' });
        } else if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    } catch {
        // noop
    }
}
