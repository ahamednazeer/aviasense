import { $, $$, state } from '../core/state.js';

export function initTabs() {
    const tabs = $$('.mode-tab');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            if (mode === state.currentMode) return;

            state.currentMode = mode;
            tabs.forEach((item) => item.classList.remove('active'));
            tab.classList.add('active');
            $$('.mode-section').forEach((section) => section.classList.remove('active'));
            $(`#${mode}-mode`).classList.add('active');
            $('#results-section').classList.add('hidden');
        });
    });
}

export function initResults({ onReset }) {
    $('#btn-new-scan').addEventListener('click', () => {
        $('#results-section').classList.add('hidden');
        $('#predictions-list').innerHTML = '';
        onReset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

export function renderPredictions(predictions, container = $('#predictions-list')) {
    container.innerHTML = '';

    predictions.forEach((pred, index) => {
        const card = document.createElement('div');
        card.className = `prediction-card ${index === 0 ? 'top-match' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        const speciesName = pred.details ? pred.details.common_name : pred.species;
        const scientificName = pred.details ? pred.details.scientific_name : '';
        const confidencePct = (pred.confidence * 100).toFixed(1);

        let detailsHTML = '';
        if (pred.details) {
            const statusClass = pred.details.conservation_status
                .toLowerCase().replace(/\s+/g, '-');

            detailsHTML = `
                <div class="pred-details">
                    <div class="pred-detail-row">
                        <span class="pred-detail-label">Habitat</span>
                        <span>${pred.details.habitat}</span>
                    </div>
                    <div class="pred-detail-row">
                        <span class="pred-detail-label">Status</span>
                        <span class="status-badge ${statusClass}">${pred.details.conservation_status}</span>
                    </div>
                    <p class="pred-description">${pred.details.description}</p>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="pred-top-row">
                <span class="pred-species">${speciesName}</span>
                <span class="pred-confidence-val">${confidencePct}%</span>
            </div>
            ${scientificName ? `<div class="pred-scientific">${scientificName}</div>` : ''}
            <div class="conf-bar-track">
                <div class="conf-bar-fill" data-width="${confidencePct}"></div>
            </div>
            ${detailsHTML}
        `;

        container.appendChild(card);

        requestAnimationFrame(() => {
            setTimeout(() => {
                const fill = card.querySelector('.conf-bar-fill');
                if (fill) fill.style.width = `${fill.dataset.width}%`;
            }, 80 + index * 100);
        });
    });
}
