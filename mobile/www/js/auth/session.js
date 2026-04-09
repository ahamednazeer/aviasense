import { $, $$, CONFIG, state, STORAGE_KEYS } from '../core/state.js';
import { apiFetch, authHeaders } from '../core/api.js';
import { triggerHaptic, showToast } from '../ui/feedback.js';
import { checkOnline } from '../ui/network.js';

export function initAuth({ onLogout }) {
    $$('.auth-tab').forEach((tab) => {
        tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab));
    });

    $('#signin-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        await submitSignin();
    });

    $('#signup-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        await submitSignup();
    });

    $('#btn-logout').addEventListener('click', async () => {
        await logout(onLogout);
    });
}

export function renderAuthState() {
    const isAuthenticated = Boolean(state.authToken && state.authUser);
    $('#auth-screen').classList.toggle('hidden', isAuthenticated);
    $('#app-content').classList.toggle('hidden', !isAuthenticated);
    $('#auth-summary').classList.toggle('hidden', !isAuthenticated);
    $('#btn-logout').classList.toggle('hidden', !isAuthenticated);

    $('#auth-user-name').textContent = isAuthenticated
        ? state.authUser.full_name || state.authUser.email || 'User'
        : '';
}

export async function hydrateCurrentUser() {
    try {
        const response = await apiFetch(CONFIG.ME_ENDPOINT, {
            headers: authHeaders(),
        });

        if (!response.ok) {
            clearAuth();
            renderAuthState();
            return;
        }

        const data = await response.json();
        state.authUser = data.user;
        localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(data.user));
        renderAuthState();
    } catch (error) {
        console.error('Auth hydrate failed:', error);
        clearAuth();
        renderAuthState();
    }
}

export function requireAuth() {
    if (state.authToken && state.authUser) {
        return true;
    }
    showToast('Please sign in first.', 'error');
    renderAuthState();
    return false;
}

export function clearAuth() {
    state.authToken = null;
    state.authUser = null;
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.authUser);
}

async function submitSignin() {
    const email = $('#signin-email').value.trim();
    const password = $('#signin-password').value;

    if (!email || !password) {
        showToast('Email and password are required.', 'error');
        return;
    }

    await submitAuth(CONFIG.SIGNIN_ENDPOINT, { email, password }, 'Signed in successfully.');
}

async function submitSignup() {
    const fullName = $('#signup-name').value.trim();
    const email = $('#signup-email').value.trim();
    const password = $('#signup-password').value;
    const confirmPassword = $('#signup-confirm-password').value;

    if (!fullName || !email || !password || !confirmPassword) {
        showToast('All signup fields are required.', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    await submitAuth(
        CONFIG.SIGNUP_ENDPOINT,
        { full_name: fullName, email, password },
        'Account created successfully.'
    );
}

async function submitAuth(endpoint, payload, successMessage) {
    if (!checkOnline()) return;

    try {
        const response = await apiFetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Auth failed (${response.status})`);
        }

        persistAuth(data.access_token, data.user);
        renderAuthState();
        resetAuthForms();
        showToast(successMessage, 'success');
        triggerHaptic();
    } catch (error) {
        console.error('Auth error:', error);
        showToast(error.message || 'Authentication failed.', 'error');
    }
}

function persistAuth(token, user) {
    state.authToken = token;
    state.authUser = user;
    localStorage.setItem(STORAGE_KEYS.authToken, token);
    localStorage.setItem(STORAGE_KEYS.authUser, JSON.stringify(user));
}

async function logout(onLogout) {
    try {
        if (state.authToken) {
            await apiFetch(CONFIG.LOGOUT_ENDPOINT, {
                method: 'POST',
                headers: authHeaders(),
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    }

    clearAuth();
    renderAuthState();
    onLogout();
    showToast('Signed out.', 'info');
}

function setAuthMode(mode) {
    state.authMode = mode;
    $$('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.authTab === mode));
    $('#signin-form').classList.toggle('hidden', mode !== 'signin');
    $('#signup-form').classList.toggle('hidden', mode !== 'signup');
}

function resetAuthForms() {
    $('#signin-form').reset();
    $('#signup-form').reset();
    setAuthMode('signin');
}
