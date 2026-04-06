document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    if (!tabs.length || !contents.length) {
        return;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetSection = document.getElementById(`${tab.dataset.tab}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    setupUpload('image');
    setupUpload('audio');

    function setupUpload(type) {
        const dropArea = document.getElementById(`${type}-upload-area`);
        const input = document.getElementById(`${type}-input`);
        const preview = document.getElementById(`${type}-preview`);
        const btn = document.getElementById(`predict-${type}-btn`);

        if (!dropArea || !input || !preview || !btn) {
            return;
        }

        dropArea.addEventListener('click', () => input.click());

        input.addEventListener('change', event => {
            const file = event.target.files[0];
            handleFile(file, type, preview, btn);
        });

        dropArea.addEventListener('dragover', event => {
            event.preventDefault();
            dropArea.classList.add('dragover');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });

        dropArea.addEventListener('drop', event => {
            event.preventDefault();
            dropArea.classList.remove('dragover');
            const file = event.dataTransfer.files[0];
            input.files = event.dataTransfer.files;
            handleFile(file, type, preview, btn);
        });

        btn.addEventListener('click', async () => {
            const file = input.files[0];
            if (!file) {
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            showLoading(true);

            try {
                const response = await fetch('/api/predict', {
                    method: 'POST',
                    body: formData,
                    headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {}
                });

                if (response.status === 401) {
                    window.location.href = '/signin';
                    return;
                }

                const data = await response.json();
                displayResults(data);
            } catch (error) {
                console.error('Prediction failed:', error);
                displayResults({ error: 'Prediction failed. Please try again.' });
            } finally {
                showLoading(false);
            }
        });
    }

    function handleFile(file, type, preview, button) {
        if (!file) {
            return;
        }

        if (type === 'image' && !file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }

        if (type === 'audio' && !file.type.startsWith('audio/')) {
            alert('Please upload an audio file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = event => {
            const source = event.target.result;
            preview.innerHTML = type === 'image'
                ? `<img src="${source}" alt="Preview">`
                : `<audio controls src="${source}"></audio>`;
            button.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    function showLoading(isLoading) {
        const results = document.getElementById('results-area');
        const loader = document.getElementById('loading');
        const predictions = document.getElementById('predictions');

        results.classList.remove('hidden');
        if (isLoading) {
            results.scrollIntoView({ behavior: 'smooth' });
            loader.classList.remove('hidden');
            predictions.innerHTML = '';
        } else {
            loader.classList.add('hidden');
        }
    }

    function displayResults(data) {
        const predictionsDiv = document.getElementById('predictions');
        predictionsDiv.innerHTML = '';

        if (data.error) {
            predictionsDiv.innerHTML = `<div class="error">${data.error}</div>`;
            return;
        }

        data.predictions.forEach((prediction, index) => {
            const details = prediction.details || {};
            const card = document.createElement('div');
            card.className = 'prediction-item';
            card.style.animationDelay = `${index * 0.1}s`;

            const speciesName = details.common_name || prediction.species;
            const scientificName = details.scientific_name
                ? `<span class="scientific-name">(${details.scientific_name})</span>`
                : '';

            const infoHtml = details.common_name ? `
                <div class="bird-details">
                    <div class="detail-row"><span class="label">Habitat:</span> ${details.habitat}</div>
                    <div class="detail-row"><span class="label">Status:</span> <span class="status-badge ${details.conservation_status.toLowerCase().replace(/\s+/g, '-')}">${details.conservation_status}</span></div>
                    <p class="description">${details.description}</p>
                </div>
            ` : '';

            card.innerHTML = `
                <div class="prediction-header">
                    <div class="prediction-title">
                        <span class="species-name">${speciesName}</span>
                        ${scientificName}
                    </div>
                    <span class="confidence-text">${(prediction.confidence * 100).toFixed(1)}%</span>
                </div>
                <div class="confidence-bar-bg">
                    <div class="confidence-bar-fill" style="width: 0%"></div>
                </div>
                ${infoHtml}
            `;

            predictionsDiv.appendChild(card);
            setTimeout(() => {
                card.querySelector('.confidence-bar-fill').style.width = `${prediction.confidence * 100}%`;
            }, 50);
        });
    }
});
