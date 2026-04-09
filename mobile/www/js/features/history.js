import { $, $$, CONFIG, state } from '../core/state.js';
import { apiFetch, authHeaders } from '../core/api.js';
import { clearAuth, renderAuthState, requireAuth } from '../auth/session.js';
import { showToast } from '../ui/feedback.js';
import { checkOnline } from '../ui/network.js';
import { renderPredictions } from './results.js';

export function initHistory() {
    $$('.app-view-tab').forEach((tab) => {
        tab.addEventListener('click', async () => {
            await setAppView(tab.dataset.appView);
        });
    });

    $('#btn-history-refresh').addEventListener('click', async () => {
        await loadHistory(true);
    });

    $('#btn-history-back').addEventListener('click', () => {
        showHistoryList();
    });
}

export async function setAppView(view) {
    if (view === state.currentAppView && view !== 'history') {
        return;
    }

    state.currentAppView = view;
    $$('.app-view-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.appView === view);
    });

    $('#scan-view').classList.toggle('hidden', view !== 'scan');
    $('#history-view').classList.toggle('hidden', view !== 'history');

    if (view === 'history' && state.authToken && state.authUser) {
        showHistoryList();
        await loadHistory();
    }
}

export async function loadHistory(forceReload = false) {
    if (!requireAuth() || !checkOnline()) {
        return;
    }

    if (!forceReload && state.historyItems.length > 0) {
        renderHistoryList(state.historyItems);
        return;
    }

    toggleHistoryLoading(true);

    try {
        const response = await apiFetch(`${CONFIG.HISTORY_ENDPOINT}?limit=50`, {
            headers: authHeaders(),
        });
        const data = await readJson(response);
        ensureAuthorized(response, data);

        if (!response.ok) {
            throw new Error(data.error || `Unable to load history (${response.status})`);
        }

        state.historyItems = data.history || [];
        renderHistoryList(state.historyItems);
        showHistoryList();
    } catch (error) {
        console.error('History load failed:', error);
        showToast(error.message || 'Unable to load history.', 'error');
    } finally {
        toggleHistoryLoading(false);
    }
}

export function prependHistoryEntry(entry) {
    if (!entry || !entry.id) {
        return;
    }

    state.historyItems = [
        entry,
        ...state.historyItems.filter((item) => item.id !== entry.id),
    ];

    if (state.currentAppView === 'history') {
        renderHistoryList(state.historyItems);
    }
}

export function resetHistoryState() {
    state.currentAppView = 'scan';
    state.historyItems = [];
    state.selectedHistoryId = null;

    $$('.app-view-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.appView === 'scan');
    });

    $('#scan-view').classList.remove('hidden');
    $('#history-view').classList.add('hidden');
    $('#history-list').innerHTML = '';
    $('#history-detail-predictions').innerHTML = '';
    $('#history-empty-state').classList.add('hidden');
    $('#history-loading').classList.add('hidden');
    showHistoryList();
}

async function openHistoryDetail(historyId) {
    if (!requireAuth() || !checkOnline()) {
        return;
    }

    toggleHistoryLoading(true);

    try {
        const cachedEntry = state.historyItems.find(
            (item) => item.id === historyId && Array.isArray(item.predictions)
        );
        let entry = cachedEntry;

        if (!entry) {
            const response = await apiFetch(`${CONFIG.HISTORY_ENDPOINT}/${historyId}`, {
                headers: authHeaders(),
            });
            const data = await readJson(response);
            ensureAuthorized(response, data);

            if (!response.ok) {
                throw new Error(data.error || `Unable to load history item (${response.status})`);
            }

            entry = data.history_entry;
            state.historyItems = state.historyItems.map((item) => (
                item.id === historyId ? { ...item, ...entry } : item
            ));
        }

        state.selectedHistoryId = historyId;
        renderHistoryDetail(entry);
    } catch (error) {
        console.error('History detail failed:', error);
        showToast(error.message || 'Unable to load history detail.', 'error');
    } finally {
        toggleHistoryLoading(false);
    }
}

function renderHistoryList(items) {
    const container = $('#history-list');
    const emptyState = $('#history-empty-state');
    container.innerHTML = '';

    if (!items.length) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    items.forEach((item) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'history-card';
        card.innerHTML = `
            <div class="history-card-top">
                <span class="history-type-badge">${formatInputType(item.input_type)}</span>
                <span class="history-card-time">${formatTimestamp(item.created_at)}</span>
            </div>
            <div class="history-card-title">${item.top_species || 'Unknown species'}</div>
            <div class="history-card-bottom">
                <span class="history-card-confidence">${formatConfidence(item.top_confidence)}</span>
                <span class="history-card-source">${item.source_filename || 'Captured in app'}</span>
            </div>
        `;
        card.addEventListener('click', async () => {
            await openHistoryDetail(item.id);
        });
        container.appendChild(card);
    });
}

function renderHistoryDetail(entry) {
    $('#history-detail-title').textContent = entry.top_species || 'Unknown species';
    $('#history-detail-meta').textContent = `${formatInputType(entry.input_type)} scan • ${formatTimestamp(entry.created_at)}`;
    $('#history-detail-confidence').textContent = formatConfidence(entry.top_confidence);
    $('#history-detail-source').textContent = entry.source_filename || 'Captured in app';
    renderPredictions(entry.predictions || [], $('#history-detail-predictions'));

    $('#history-list-screen').classList.add('hidden');
    $('#history-detail-screen').classList.remove('hidden');
}

function showHistoryList() {
    state.selectedHistoryId = null;
    $('#history-list-screen').classList.remove('hidden');
    $('#history-detail-screen').classList.add('hidden');
}

function toggleHistoryLoading(isLoading) {
    $('#history-loading').classList.toggle('hidden', !isLoading);
}

function ensureAuthorized(response, data) {
    if (response.status !== 401) {
        return;
    }

    clearAuth();
    renderAuthState();
    throw new Error(data.error || 'Session expired. Please sign in again.');
}

async function readJson(response) {
    return response.json().catch(() => ({}));
}

function formatInputType(inputType) {
    return inputType === 'audio' ? 'Audio' : 'Photo';
}

function formatConfidence(value) {
    return `${((value || 0) * 100).toFixed(1)}% confidence`;
}

function formatTimestamp(value) {
    if (!value) {
        return 'Unknown time';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown time';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
