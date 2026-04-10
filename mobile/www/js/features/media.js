import { $, $$, CONFIG, state } from '../core/state.js';
import { apiFetch, authHeaders } from '../core/api.js';
import { requireAuth } from '../auth/session.js';
import { showToast, triggerHaptic } from '../ui/feedback.js';
import { checkOnline } from '../ui/network.js';

export function initImageCapture({ onPredict }) {
    $('#btn-camera').addEventListener('click', async () => {
        if (!checkOnline() || !requireAuth()) return;
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
                const Camera = window.Capacitor.Plugins.Camera;
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: 'dataUrl',
                    source: 'CAMERA',
                    width: 1024,
                    height: 1024,
                    correctOrientation: true,
                });
                await handleImageDataUrl(image.dataUrl);
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';
                input.onchange = async (event) => {
                    const file = event.target.files[0];
                    if (file) await handleImageFile(file);
                };
                input.click();
            }
        } catch (err) {
            if (err.message && err.message.includes('cancelled')) return;
            console.error('Camera error:', err);
            showToast('Camera access failed. Please check permissions.', 'error');
        }
    });

    $('#btn-gallery').addEventListener('click', async () => {
        if (!checkOnline() || !requireAuth()) return;
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
                const Camera = window.Capacitor.Plugins.Camera;
                const image = await Camera.getPhoto({
                    quality: 90,
                    allowEditing: false,
                    resultType: 'dataUrl',
                    source: 'PHOTOS',
                    width: 1024,
                    height: 1024,
                });
                await handleImageDataUrl(image.dataUrl);
            } else {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (event) => {
                    const file = event.target.files[0];
                    if (file) await handleImageFile(file);
                };
                input.click();
            }
        } catch (err) {
            if (err.message && err.message.includes('cancelled')) return;
            console.error('Gallery error:', err);
            showToast('Could not access gallery.', 'error');
        }
    });

    $('#btn-clear-image').addEventListener('click', () => {
        state.imageFile = null;
        resetImageValidation();
        $('#image-preview').src = '';
        $('#image-preview-container').classList.add('hidden');
        $('#image-mode .capture-grid').style.display = '';
    });

    $('#btn-identify-image').addEventListener('click', () => {
        if (state.imageFile) {
            onPredict(state.imageFile, 'image');
        }
    });
}

export function initAudioCapture({ onPredict }) {
    $('#btn-record').addEventListener('click', async () => {
        if (!checkOnline() || !requireAuth()) return;
        if (state.isRecording) return;
        await startRecording();
    });

    $('#btn-stop-record').addEventListener('click', () => {
        stopRecording();
    });

    $('#btn-audio-file').addEventListener('click', () => {
        if (!checkOnline() || !requireAuth()) return;
        $('#audio-file-input').click();
    });

    $('#audio-file-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) handleAudioFile(file);
    });

    $('#btn-clear-audio').addEventListener('click', () => {
        state.audioFile = null;
        $('#audio-player').src = '';
        $('#audio-preview-container').classList.add('hidden');
        $('#audio-mode .capture-grid').style.display = '';
    });

    $('#btn-identify-audio').addEventListener('click', () => {
        if (state.audioFile) {
            onPredict(state.audioFile, 'audio');
        }
    });
}

export function initWaveformBars() {
    const waveform = $('#recording-waveform');
    for (let i = 0; i < 24; i += 1) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = '4px';
        waveform.appendChild(bar);
    }
}

export function resetCaptureState() {
    state.imageFile = null;
    resetImageValidation();
    state.audioFile = null;
    $('#image-preview').src = '';
    $('#image-preview-container').classList.add('hidden');
    $('#audio-player').src = '';
    $('#audio-preview-container').classList.add('hidden');
    $$('.capture-grid').forEach((grid) => {
        grid.style.display = '';
    });
}

async function handleImageDataUrl(dataUrl) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    await handleImageFile(file, dataUrl);
}

async function handleImageFile(file, previewSrc = null) {
    state.imageFile = file;
    showImagePreview(previewSrc || await readFileAsDataUrl(file));
    await validateSelectedImage(file);
}

function showImagePreview(src) {
    $('#image-preview').src = src;
    $('#image-preview-container').classList.remove('hidden');
    $('#image-mode .capture-grid').style.display = 'none';
    updateImageValidationUI();
    triggerHaptic();
}

async function validateSelectedImage(file) {
    state.imageValidation = {
        isValidating: true,
        isBirdCandidate: false,
        message: 'Checking whether this looks like a bird photo...',
        confidence: null,
    };
    updateImageValidationUI();

    const formData = new FormData();
    formData.append('file', file, file.name || 'capture.jpg');

    try {
        const response = await apiFetch(CONFIG.VALIDATE_IMAGE_ENDPOINT, {
            method: 'POST',
            headers: authHeaders(),
            body: formData,
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            throw new Error(data.error || 'Session expired. Please sign in again.');
        }

        if (!response.ok) {
            throw new Error(data.error || `Image validation failed (${response.status})`);
        }

        const confidencePercent = `${((data.confidence || 0) * 100).toFixed(1)}%`;
        state.imageValidation = {
            isValidating: false,
            isBirdCandidate: Boolean(data.is_bird_candidate),
            message: data.is_bird_candidate
                ? `Bird candidate detected (${confidencePercent} confidence).`
                : `This image does not look like a bird photo (${confidencePercent} confidence).`,
            confidence: data.confidence || 0,
        };

        if (!data.is_bird_candidate) {
            showToast('Please choose an image that clearly contains a bird.', 'error');
        }
    } catch (error) {
        state.imageValidation = {
            isValidating: false,
            isBirdCandidate: false,
            message: error.message || 'Unable to validate image.',
            confidence: null,
        };
        showToast(state.imageValidation.message, 'error');
    }

    updateImageValidationUI();
}

function updateImageValidationUI() {
    const button = $('#btn-identify-image');
    const message = $('#image-validation-message');
    const validation = state.imageValidation;
    const text = validation.message || '';

    button.disabled = validation.isValidating || !state.imageFile || !validation.isBirdCandidate;
    message.textContent = text;
    message.classList.toggle('hidden', !text);
    message.classList.toggle('is-error', Boolean(text) && !validation.isValidating && !validation.isBirdCandidate);
    message.classList.toggle('is-success', Boolean(text) && validation.isBirdCandidate);
}

function resetImageValidation() {
    state.imageValidation = {
        isValidating: false,
        isBirdCandidate: false,
        message: '',
        confidence: null,
    };
    updateImageValidationUI();
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error('Unable to preview image.'));
        reader.readAsDataURL(file);
    });
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100,
            },
        });

        state.isRecording = true;
        state.recordingChunks = [];

        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';

        const options = mimeType ? { mimeType } : {};
        state.mediaRecorder = new MediaRecorder(stream, options);

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) state.recordingChunks.push(event.data);
        };

        state.mediaRecorder.onstop = () => {
            const blob = new Blob(state.recordingChunks, {
                type: state.mediaRecorder.mimeType || 'audio/webm',
            });
            const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
            const file = new File([blob], `recording.${ext}`, { type: blob.type });
            handleAudioFile(file);
            stream.getTracks().forEach((track) => track.stop());
            cleanupRecordingVisualizer();
        };

        state.mediaRecorder.start(250);
        setupRecordingVisualizer(stream);
        $('#audio-mode .capture-grid').style.display = 'none';
        $('#recording-ui').classList.remove('hidden');
        state.recordingStartTime = Date.now();
        updateRecordingTimer();
        state.recordingTimerInterval = setInterval(updateRecordingTimer, 1000);

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

            bars.forEach((bar, index) => {
                const idx = Math.floor(index * dataArray.length / bars.length);
                const value = dataArray[idx] || 0;
                const height = Math.max(4, (value / 255) * 36);
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

function handleAudioFile(file) {
    state.audioFile = file;

    const url = URL.createObjectURL(file);
    $('#audio-player').src = url;
    $('#audio-filename').textContent = file.name || 'Recording';

    const tempAudio = new Audio(url);
    tempAudio.addEventListener('loadedmetadata', () => {
        if (isFinite(tempAudio.duration)) {
            const duration = Math.round(tempAudio.duration);
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            $('#audio-duration').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
        } else {
            $('#audio-duration').textContent = '--:--';
        }
    });

    $('#audio-mode .capture-grid').style.display = 'none';
    $('#audio-preview-container').classList.remove('hidden');
    triggerHaptic();
}
