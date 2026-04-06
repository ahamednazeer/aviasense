import os
import json

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for Capacitor mobile app
CORS(app)

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

from models.image_classifier import ImageClassifier
from models.audio_classifier import AudioClassifier

# Initialize Models
# In a real deployment, paths would point to 'models/weights/...'
image_model = ImageClassifier(model_path='models/best_cub200_efficientnet_b5.pth')
audio_model = AudioClassifier(weights_dir='models/weights')

# Load bird info
BIRD_INFO = {}
try:
    with open('bird_info.json', 'r') as f:
        BIRD_INFO = json.load(f)
except Exception as e:
    print(f"Error loading bird_info.json: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    file_type = request.form.get('type')
    if not file_type:
        return jsonify({'error': 'No type specified'}), 400

    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            if file_type == 'image':
                predictions = image_model.predict(filepath)
            elif file_type == 'audio':
                predictions = audio_model.predict(filepath)
                # Clean up audio predictions species names (remove _sound suffix)
                for p in predictions:
                    p['species'] = p['species'].replace('_sound', '')
            else:
                return jsonify({'error': 'Invalid type'}), 400
            
            # Enrich predictions with bird info
            for pred in predictions:
                species_key = pred['species']
                if species_key in BIRD_INFO:
                    pred['details'] = BIRD_INFO[species_key]
                else:
                    pred['details'] = None

            # Clean up uploaded file
            os.remove(filepath)
            
            return jsonify({'predictions': predictions})
        except Exception as e:
            # os.remove(filepath) # Ensure cleanup on error too
            return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    )
