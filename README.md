# AviaSense: Multimodal Bird Species Recognition

AviaSense is a web-based, AI-powered system designed to identify bird species using both visual data (images) and acoustic data (audio). It leverages state-of-the-art deep learning techniques to provide accurate and user-friendly bird species identification.

## Features

- **multimodal Inference**: Independent pipelines for Image and Audio classification.
- **Image Recognition**: Uses a ResNet50 model fine-tuned on the CUB-200-2011 dataset.
- **Audio Recognition**: Integrated deep learning model for classifying bird calls (114 species).
- **Web Interface**: Clean, responsive UI for easy file uploads and result visualization.
- **Real-time Results**: Instant predictions with confidence scores.

## Project Structure

```text
AviaSense/
├── app.py                  # Main Flask application
├── config.py               # App configuration
├── requirements.txt        # Python dependencies
├── models/
│   ├── image_classifier.py # Image inference logic
│   ├── audio_classifier.py # Audio inference logic
│   └── weights/            # Model weights directory
├── static/                 # CSS, JS, and uploads
├── templates/              # HTML templates
└── training/               # Training scripts (Colab)
```

## Models Setup

### Audio Model
The audio model (`model.h5`) should already be present in `models/weights/` if integrated from the provided repository. If not, follow the integration steps or ensure `models/weights/prediction.json` and `models/weights/model.h5` exist.

### Image Model
The image model requires training.
1.  Open `training/train_image_model.ipynb` in [Google Colab](https://colab.research.google.com/).
2.  Run the notebook to download the CUB-200-2011 dataset and train the ResNet50 model.
3.  Download the saved weights file `resnet50_cub200.pth`.
4.  Place the file in: `models/weights/resnet50_cub200.pth`.

## Requirements
- Python 3.8+
- Flask
- TensorFlow
- PyTorch / Torchvision
- Librosa
- Pillow
- NumPy / Pandas

## Installation

1.  **Clone/Open the Repository**
    Navigate to the project directory.

2.  **Create a Virtual Environment**
    ```bash
    python -m venv venv
    ```

3.  **Activate the Environment**
    - Windows: `.\venv\Scripts\activate`
    - Mac/Linux: `source venv/bin/activate`

4.  **Install Dependencies**
    Note: If you do not have a GPU, PyTorch will install the CPU version by default with these requirements, or you can specify the CPU version explicitly.
    ```bash
    pip install -r requirements.txt
    ```

## Usage

1.  **Start the Server**
    ```bash
    python app.py
    ```

2.  **Access the Application**
    Open your web browser and go to: `http://localhost:5000`

3.  **Identify Birds**
    - **Image**: Upload a `.jpg` or `.png` image of a bird.
    - **Audio**: Upload a `.wav` or `.mp3` recording of a bird call.
    - The system will display the top 5 predicted species with confidence scores.

## Docker

The backend can be run in Docker with the bundled `Dockerfile` and Compose service.

1.  **Build and start the backend**
    ```bash
    docker compose up --build backend
    ```

2.  **Open the backend**
    Visit `http://localhost:5000`

3.  **Stop the container**
    ```bash
    docker compose down
    ```

Notes:
- The container runs the Flask app behind Gunicorn on port `5000`.
- The image includes the model files already stored in this repository.
- If you are building on Apple Silicon and TensorFlow wheel resolution fails, retry with:
  ```bash
  DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose up --build backend
  ```

## Mobile Android

The Capacitor Android app reads `ANDROID_API_BASE_URL` from the root `.env` file and writes it into `mobile/www/js/core/runtime-config.js` before each Capacitor command.

1. Set the backend URL in `.env`
   ```bash
   ANDROID_API_BASE_URL=https://your-backend-host
   ```

2. Sync or run the Android app from `mobile/`
   ```bash
   npm run cap:sync
   npm run cap:run
   ```

If the backend is hosted separately, make sure that backend allows `http://localhost` or `capacitor://localhost` in `CORS_ALLOWED_ORIGINS`.
