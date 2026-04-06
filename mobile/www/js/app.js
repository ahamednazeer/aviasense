/**
 * AviaSense Mobile — Main Application
 * Capacitor-powered bird recognition with camera & mic
 */

// ================================================
// CONFIGURATION
// ================================================
const CONFIG = {
    // Change this to your Flask backend URL
    // For local dev, use your computer's IP address (not localhost)
    // e.g. 'http://192.168.1.100:5000'
    API_BASE_URL: 'http://10.0.2.2:5000', // Android emulator -> host machine
    PREDICT_ENDPOINT: '/api/predict',
    MAX_RECORDING_SECONDS: 30,
};

// ================================================
// STATE
// ================================================
const state = {
    currentMode: 'image', // 'image' | 'audio'
    imageFile: null,       // File or Blob
    audioFile: null,       // File or Blob
    isRecording: false,
    mediaRecorder: null,
    recordingChunks: [],
    recordingStartTime: null,
    recordingTimerInterval: null,
    analyserNode: null,
    audioContext: null,
    waveformRAF: null,
    isOnline: navigator.onLine,
};

// ================================================
// DOM REFS
// ================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ================================================
// INIT
// ================================================
document.addEventListener('DOMContentLoaded', () => {
    initSplash();
    initTabs();
    initImageCapture();
    initAudioCapture();
    initResults();
    initNetworkDetection();
    initWaveformBars();
});

// ================================================
// SPLASH SCREEN
// ================================================
function initSplash() {
    setTimeout(() => {
        const splash = $('#splash-overlay');
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 700);
    }, 1800);
}

// ================================================
// TAB SWITCHING
// ================================================
function initTabs() {
    const tabs = $$('.mode-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            if (mode === state.currentMode) return;

            state.currentMode = mode;

            // Update tab UI
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update sections
            $$('.mode-section').forEach(s => s.classList.remove('active'));
            $(`#${mode}-mode`).classList.add('active');

            // Hide results when switching
            $('#results-section').classList.add('hidden');
        });
    });
}

// ================================================
// IMAGE CAPTURE (Camera + Gallery)
// ================================================
function initImageCapture() {
    // Camera button — use native camera via Capacitor
    $('#btn-camera').addEventListener('click', async () => {
        if (!checkOnline()) return;
        try {
            // Try Capacitor Camera plugin first
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
                const Camera = window.Capacitor.Plugins.Camera;
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: 'dataUrl', // CameraResultType.DataUrl
                    source: 'CAMERA', // CameraSource.Camera
                    width: 1024,
                    height: 1024,
                    correctOrientation: true
                });
                handleImageDataUrl(image.dataUrl);
            } else {
                // Web fallback: use file input with camera capture
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) handleImageFile(file);
                };
                input.click();
            }
        } catch (err) {
            if (err.message && err.message.includes('cancelled')) return;
            console.error('Camera error:', err);
            showToast('Camera access failed. Please check permissions.', 'error');
        }
    });

    // Gallery button
    $('#btn-gallery').addEventListener('click', async () => {
        if (!checkOnline()) return;
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
                const Camera = window.Capacitor.Plugins.Camera;
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: 'dataUrl',
                    source: 'PHOTOS', // CameraSource.Photos
                    width: 1024,
                    height: 1024
                });
                handleImageDataUrl(image.dataUrl);
            } else {
                // Web fallback
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) handleImageFile(file);
                };
                input.click();
            }
        } catch (err) {
            if (err.message && err.message.includes('cancelled')) return;
            console.error('Gallery error:', err);
            showToast('Could not access gallery.', 'error');
        }
    });

    // Clear image
    $('#btn-clear-image').addEventListener('click', () => {
        state.imageFile = null;
        $('#image-preview').src = '';
        $('#image-preview-container').classList.add('hidden');
        // Show capture grid again
        $('#image-mode .capture-grid').style.display = '';
    });

    // Identify image
    $('#btn-identify-image').addEventListener('click', () => {
        if (state.imageFile) {
            sendPrediction(state.imageFile, 'image');
        }
    });
}

function handleImageDataUrl(dataUrl) {
    // Convert data URL to Blob
    fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            state.imageFile = file;
            showImagePreview(dataUrl);
        });
}

function handleImageFile(file) {
    state.imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => showImagePreview(e.target.result);
    reader.readAsDataURL(file);
}

function showImagePreview(src) {
    $('#image-preview').src = src;
    $('#image-preview-container').classList.remove('hidden');
    // Hide capture grid
    $('#image-mode .capture-grid').style.display = 'none';
    // Haptic feedback
    triggerHaptic();
}

// ================================================
// AUDIO CAPTURE (Mic Recording + File Upload)
// ================================================
function initAudioCapture() {
    // Record button
    $('#btn-record').addEventListener('click', async () => {
        if (!checkOnline()) return;
        if (state.isRecording) return;
        await startRecording();
    });

    // Stop recording
    $('#btn-stop-record').addEventListener('click', () => {
        stopRecording();
    });

    // Audio file picker
    $('#btn-audio-file').addEventListener('click', () => {
        if (!checkOnline()) return;
        $('#audio-file-input').click();
    });

    $('#audio-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleAudioFile(file);
        }
    });

    // Clear audio
    $('#btn-clear-audio').addEventListener('click', () => {
        state.audioFile = null;
        $('#audio-player').src = '';
        $('#audio-preview-container').classList.add('hidden');
        $('#audio-mode .capture-grid').style.display = '';
    });

    // Identify audio
    $('#btn-identify-audio').addEventListener('click', () => {
        if (state.audioFile) {
            sendPrediction(state.audioFile, 'audio');
        }
    });
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });

        state.isRecording = true;
        state.recordingChunks = [];

        // Pick best available audio format
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // let browser choose
        }

        const options = mimeType ? { mimeType } : {};
        state.mediaRecorder = new MediaRecorder(stream, options);

        state.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                state.recordingChunks.push(e.data);
            }
        };

        state.mediaRecorder.onstop = () => {
            const blob = new Blob(state.recordingChunks, {
                type: state.mediaRecorder.mimeType || 'audio/webm'
            });
            const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
            const file = new File([blob], `recording.${ext}`, { type: blob.type });
            handleAudioFile(file);

            // Cleanup
            stream.getTracks().forEach(t => t.stop());
            cleanupRecordingVisualizer();
        };

        state.mediaRecorder.start(250); // Collect data every 250ms

        // Setup visualizer
        setupRecordingVisualizer(stream);

        // UI
        $('#audio-mode .capture-grid').style.display = 'none';
        $('#recording-ui').classList.remove('hidden');
        state.recordingStartTime = Date.now();
        updateRecordingTimer();
        state.recordingTimerInterval = setInterval(updateRecordingTimer, 1000);

        // Auto-stop after max time
        setTimeout(() => {
            if (state.isRecording) stopRecording();
        }, CONFIG.MAX_RECORDING_SECONDS * 1000);

        triggerHaptic();

    } catch (err) {
        console.error('Mic error:', err);
        showToast('Microphone access denied. Check permissions.', 'error');
    }
}

function stopRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.stop();
    }

    clearInterval(state.recordingTimerInterval);
    $('#recording-ui').classList.add('hidden');
    triggerHaptic();
}

function updateRecordingTimer() {
    const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    $('#recording-timer').textContent = `${mins}:${secs}`;
}

function setupRecordingVisualizer(stream) {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = state.audioContext.createMediaStreamSource(stream);
        state.analyserNode = state.audioContext.createAnalyser();
        state.analyserNode.fftSize = 64;
        source.connect(state.analyserNode);

        const bars = $$('#recording-waveform .bar');
        const dataArray = new Uint8Array(state.analyserNode.frequencyBinCount);

        function animate() {
            if (!state.isRecording) return;
            state.analyserNode.getByteFrequencyData(dataArray);

            bars.forEach((bar, i) => {
                const idx = Math.floor(i * dataArray.length / bars.length);
                const val = dataArray[idx] || 0;
                const height = Math.max(4, (val / 255) * 36);
                bar.style.height = `${height}px`;
            });

            state.waveformRAF = requestAnimationFrame(animate);
        }
        animate();
    } catch (err) {
        console.warn('Visualizer setup failed:', err);
    }
}

function cleanupRecordingVisualizer() {
    if (state.waveformRAF) cancelAnimationFrame(state.waveformRAF);
    if (state.audioContext) {
        state.audioContext.close().catch(() => {});
        state.audioContext = null;
    }
    state.analyserNode = null;
}

function initWaveformBars() {
    const waveform = $('#recording-waveform');
    for (let i = 0; i < 24; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = '4px';
        waveform.appendChild(bar);
    }
}

function handleAudioFile(file) {
    state.audioFile = file;

    const url = URL.createObjectURL(file);
    $('#audio-player').src = url;
    $('#audio-filename').textContent = file.name || 'Recording';

    // Get duration
    const tempAudio = new Audio(url);
    tempAudio.addEventListener('loadedmetadata', () => {
        if (isFinite(tempAudio.duration)) {
            const d = Math.round(tempAudio.duration);
            const m = Math.floor(d / 60);
            const s = d % 60;
            $('#audio-duration').textContent = `${m}:${String(s).padStart(2, '0')}`;
        } else {
            $('#audio-duration').textContent = '--:--';
        }
    });

    $('#audio-mode .capture-grid').style.display = 'none';
    $('#audio-preview-container').classList.remove('hidden');
    triggerHaptic();
}

// ================================================
// API PREDICTION
// ================================================
async function sendPrediction(file, type) {
    if (!checkOnline()) return;

    const resultsSection = $('#results-section');
    const loadingState = $('#loading-state');
    const predictionsList = $('#predictions-list');

    // Show results section with loading
    resultsSection.classList.remove('hidden');
    loadingState.classList.remove('hidden');
    predictionsList.innerHTML = '';

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('type', type);

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.PREDICT_ENDPOINT}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error (${response.status})`);
        }

        const data = await response.json();
        loadingState.classList.add('hidden');

        if (data.error) {
            showToast(data.error, 'error');
            return;
        }

        renderPredictions(data.predictions);
        triggerHaptic();
        showToast('Bird identified successfully!', 'success');

    } catch (error) {
        loadingState.classList.add('hidden');
        console.error('Prediction error:', error);

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            showToast('Cannot reach server. Check your connection and server URL.', 'error');
        } else {
            showToast(error.message || 'Prediction failed.', 'error');
        }
    }
}

// ================================================
// RENDER PREDICTIONS
// ================================================
function renderPredictions(predictions) {
    const container = $('#predictions-list');
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

        // Animate confidence bar after a slight delay
        requestAnimationFrame(() => {
            setTimeout(() => {
                const fill = card.querySelector('.conf-bar-fill');
                if (fill) fill.style.width = fill.dataset.width + '%';
            }, 80 + index * 100);
        });
    });
}

// ================================================
// RESULTS ACTIONS
// ================================================
function initResults() {
    $('#btn-new-scan').addEventListener('click', () => {
        // Hide results
        $('#results-section').classList.add('hidden');
        $('#predictions-list').innerHTML = '';

        // Reset previews
        state.imageFile = null;
        state.audioFile = null;

        $('#image-preview').src = '';
        $('#image-preview-container').classList.add('hidden');
        $('#audio-player').src = '';
        $('#audio-preview-container').classList.add('hidden');

        // Show capture grids
        $$('.capture-grid').forEach(g => g.style.display = '');

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ================================================
// NETWORK DETECTION
// ================================================
function initNetworkDetection() {
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

function checkOnline() {
    if (!state.isOnline) {
        showToast('No internet connection. Please connect and try again.', 'error');
        return false;
    }
    return true;
}

// ================================================
// TOAST MESSAGES
// ================================================
function showToast(message, type = 'info') {
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

    // Auto-remove
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ================================================
// HAPTIC FEEDBACK
// ================================================
function triggerHaptic() {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
            window.Capacitor.Plugins.Haptics.impact({ style: 'MEDIUM' });
        } else if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    } catch (e) {
        // Silently fail
    }
}
