document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetSection = document.getElementById(`${tab.dataset.tab}-section`);
            targetSection.classList.add('active');
        });
    });

    // File Upload Handling
    setupUpload('image');
    setupUpload('audio');

    function setupUpload(type) {
        const dropArea = document.getElementById(`${type}-upload-area`);
        const input = document.getElementById(`${type}-input`);
        const preview = document.getElementById(`${type}-preview`);
        const btn = document.getElementById(`predict-${type}-btn`);

        // Click to Open File Dialog
        dropArea.addEventListener('click', (e) => {
            // Prevent triggering if clicking inside the dropped file preview/area if that ever becomes a thing
            input.click();
        });

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            handleFile(file, type, preview, btn);
        });

        // Drag & Drop Visuals
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.classList.remove('dragover');
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            input.files = e.dataTransfer.files; // Update the input's file list
            handleFile(file, type, preview, btn);
        });

        // Prediction Call
        btn.addEventListener('click', async () => {
            const file = input.files[0] || dropArea.file;
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            showLoading(true);

            // Artificial delay for better UX (optional, but feels nicer with the animation)
            // await new Promise(r => setTimeout(r, 800)); 

            try {
                const response = await fetch('/api/predict', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                displayResults(data);
            } catch (error) {
                console.error('Error:', error);
                alert('Prediction failed. See console for details.');
            } finally {
                showLoading(false);
            }
        });
    }

    function handleFile(file, type, preview, btn) {
        if (!file) return;

        // Validations
        if (type === 'image' && !file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }
        if (type === 'audio' && !file.type.startsWith('audio/')) {
            alert('Please upload an audio file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            let content = '';
            if (type === 'image') {
                content = `<img src="${e.target.result}" alt="Preview">`;
            } else {
                content = `<audio controls src="${e.target.result}"></audio>`;
            }
            preview.innerHTML = content;
            btn.disabled = false;
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
            predictionsDiv.innerHTML = `<div class="error" style="color: #ef4444; text-align: center;">${data.error}</div>`;
            return;
        }

        data.predictions.forEach((pred, index) => {
            const div = document.createElement('div');
            div.className = 'prediction-item';
            div.style.animationDelay = `${index * 0.1}s`; // Staggered animation

            // Use common name if available, else fallback to raw species string
            const speciesName = pred.details ? pred.details.common_name : pred.species;
            const scientificName = pred.details ? `<span class="scientific-name">(${pred.details.scientific_name})</span>` : '';

            let infoHtml = '';
            if (pred.details) {
                // Only show detailed info for the top prediction (first one)
                // or maybe for all? The user asked to display info. 
                // Let's show expandable details or just inline if it's the top one.
                // For simplicity and cleanliness, let's show full details for the top match
                // and just summary for others, OR just render the card.

                // Let's render a card for each implementation.
                infoHtml = `
                    <div class="bird-details">
                        <div class="detail-row"><span class="label">Habitat:</span> ${pred.details.habitat}</div>
                        <div class="detail-row"><span class="label">Status:</span> <span class="status-badge ${pred.details.conservation_status.toLowerCase().replace(/\s+/g, '-')}">${pred.details.conservation_status}</span></div>
                        <p class="description">${pred.details.description}</p>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="prediction-header">
                    <div class="prediction-title">
                        <span class="species-name">${speciesName}</span>
                        ${scientificName}
                    </div>
                    <span class="confidence-text">${(pred.confidence * 100).toFixed(1)}%</span>
                </div>
                
                <div class="confidence-bar-bg">
                    <div class="confidence-bar-fill" style="width: 0%"></div>
                </div>

                ${infoHtml}
            `;
            predictionsDiv.appendChild(div);

            // Trigger animation after a slight delay
            setTimeout(() => {
                div.querySelector('.confidence-bar-fill').style.width = `${pred.confidence * 100}%`;
            }, 50);
        });
    }
});
