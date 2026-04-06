import librosa
import numpy as np
import os
import json
import tensorflow as tf

class AudioClassifier:
    def __init__(self, model_path=None, weights_dir=None):
        self.model = None
        self.classes = {}
        
        # Determine paths
        if model_path is None and weights_dir:
            model_path = os.path.join(weights_dir, 'model.h5')
        
        json_path = os.path.join(weights_dir, 'prediction.json') if weights_dir else None

        # Load Model
        if model_path and os.path.exists(model_path):
            try:
                print(f"Loading audio model from {model_path}")
                self.model = tf.keras.models.load_model(model_path)
            except Exception as e:
                print(f"Error loading audio model: {e}")
        else:
            print(f"Warning: Audio model weights not found at {model_path}")

        # Load Classes
        if json_path and os.path.exists(json_path):
            try:
                with open(json_path, 'r') as f:
                    self.classes = json.load(f)
            except Exception as e:
                print(f"Error loading prediction.json: {e}")
        else:
            print(f"Warning: prediction.json not found at {json_path}")


    def predict(self, audio_path, top_k=5):
        if self.model is None:
            return [{"species": "Error: Audio model not found.", "confidence": 0.0}]

        try:
            # Preprocessing matched to original app.py
            audio, sample_rate = librosa.load(audio_path)
            
            # Extract MFCCs
            mfccs_features = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=40)
            mfccs_features = np.mean(mfccs_features, axis=1)
            
            # Reshape for Conv1D
            mfccs_features = np.expand_dims(mfccs_features, axis=0) # Batch dim
            mfccs_features = np.expand_dims(mfccs_features, axis=2) # Channel dim
            
            # Convert to Tensor
            mfccs_tensors = tf.convert_to_tensor(mfccs_features, dtype=tf.float32)
            
            # Predict
            prediction = self.model.predict(mfccs_tensors)
            
            # Get Top-K
            # prediction is shape (1, num_classes)
            probs = prediction[0]
            top_indices = probs.argsort()[-top_k:][::-1]
            
            results = []
            for idx in top_indices:
                idx_str = str(idx)
                species_name = self.classes.get(idx_str, f"Unknown ID {idx}")
                confidence = float(probs[idx])
                results.append({
                    "species": species_name,
                    "confidence": confidence
                })
                
            return results
            
        except Exception as e:
            print(f"Error during audio prediction: {e}")
            return [{"species": f"Error: {str(e)}", "confidence": 0.0}]
