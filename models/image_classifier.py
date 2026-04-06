import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import models, transforms
from PIL import Image
import os


class ImageClassifier:
    def __init__(self, model_path=None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.classes = self._load_classes(os.path.join(os.path.dirname(__file__), 'classes.txt'))
        self.model = self._load_model(model_path)
        self.transform = transforms.Compose([
            transforms.Resize((456, 456)),
            transforms.CenterCrop(456),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def _load_classes(self, path):
        try:
            with open(path, 'r') as f:
                # classes.txt format usually: "1 001.Black_footed_Albatross"
                # We want just "001.Black_footed_Albatross"
                classes = [line.strip().split(' ', 1)[1] for line in f.readlines()]
            return classes
        except Exception as e:
            print(f"Error loading classes from {path}: {e}")
            return [f"Bird Species {i}" for i in range(200)]

    def _load_model(self, model_path):
        try:
            # Initialize EfficientNet-B5 model
            print("Initializing EfficientNet-B5...")
            model = models.efficientnet_b5(weights=None)
            
            # EfficientNet-B5 classifier has 2048 in_features
            # The training notebook shows: model.classifier[1] = nn.Linear(..., 200)
            model.classifier[1] = nn.Linear(2048, 200)
            
            if model_path and os.path.exists(model_path):
                print(f"Loading image model from {model_path}")
                # Load weights map_location to ensure it loads on CPU if CUDA not available
                try:
                    state_dict = torch.load(model_path, map_location=self.device)
                    model.load_state_dict(state_dict)
                except Exception as e:
                    print(f"Failed to load state dict directly: {e}")
                    print("Attempting to load as full model extraction might be needed if saved differently...")
                    # Fallback or detailed error logging could go here
            else:
                print(f"Warning: Model weights not found at {model_path}. Using random weights.")
            
            model.to(self.device)
            model.eval()
            return model
        except Exception as e:
            print(f"Error loading image model: {e}")
            return None

    def predict(self, image_path, top_k=5):
        if self.model is None:
            return [{"species": "Error: Model not found.", "confidence": 0.0}]

        try:
            image = Image.open(image_path).convert('RGB')
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
            
            top_prob, top_class_idx = torch.topk(probabilities, k=min(top_k, len(self.classes)))
            
            results = []
            for i in range(len(top_prob)):
                idx = top_class_idx[i].item()
                if idx < len(self.classes):
                    species_name = self.classes[idx]
                else:
                    species_name = f"Unknown Class {idx}"
                    
                results.append({
                    "species": species_name,
                    "confidence": float(top_prob[i].item())
                })
            return results
        except Exception as e:
            print(f"Error during image prediction: {e}")
            return [{"species": f"Prediction Error: {str(e)}", "confidence": 0.0}]
