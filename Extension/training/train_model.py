import os
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from feature_engineering import FeatureExtractor
from model_architecture import RequirementClassifier

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH_RAW = os.path.join(BASE_DIR, 'data', 'raw_samples.csv')
DATA_PATH_AUG = os.path.join(BASE_DIR, 'data', 'augmented_samples.csv')
MODEL_SAVE_PATH = os.path.join(BASE_DIR, 'best_model.pt')
LOGS_DIR = os.path.join(BASE_DIR, 'logs')
BATCH_SIZE = 32
EPOCHS = 100
LEARNING_RATE = 1e-4 # Lower LR for stability
PATIENCE = 10

def load_and_prepare_data(csv_path, feature_extractor):
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    texts = df['text'].tolist()
    label_cols = ['missing_auth', 'missing_authz', 'missing_encryption', 'missing_validation', 'missing_audit', 'missing_ratelimit']
    labels = df[label_cols].values
    
    print("Extracting features...")
    features = feature_extractor.extract_features(texts)
    
    print(f"Features shape: {features.shape}")
    print(f"Labels shape: {labels.shape}")
    
    # Split
    X_train, X_val, y_train, y_val = train_test_split(features, labels, test_size=0.2, random_state=42)
    
    train_dataset = TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train))
    val_dataset = TensorDataset(torch.FloatTensor(X_val), torch.FloatTensor(y_val))
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE)
    
    return train_loader, val_loader, features.shape[1]

def evaluate_model(model, val_loader, threshold=0.5):
    model.eval()
    all_preds = []
    all_labels = []
    total_loss = 0
    criterion = nn.BCELoss()
    
    with torch.no_grad():
        for inputs, targets in val_loader:
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            total_loss += loss.item()
            
            all_preds.append(outputs.numpy())
            all_labels.append(targets.numpy())
            
    all_preds = np.vstack(all_preds)
    all_labels = np.vstack(all_labels)
    
    binary_preds = (all_preds > threshold).astype(int)
    
    precision, recall, f1, _ = precision_recall_fscore_support(all_labels, binary_preds, average='macro', zero_division=0)
    accuracy = accuracy_score(all_labels, binary_preds) 
    
    _, _, f1_per_class, _ = precision_recall_fscore_support(all_labels, binary_preds, average=None, zero_division=0)
    
    metrics = {
        'loss': total_loss / len(val_loader),
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'f1_per_class': f1_per_class
    }
    
    return metrics, binary_preds, all_labels

def plot_confusion_matrices(preds, labels, class_names):
    os.makedirs(LOGS_DIR, exist_ok=True)
    pass

def train_model(model, train_loader, val_loader, epochs=EPOCHS, patience=PATIENCE):
    criterion = nn.BCELoss() 
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    best_val_loss = float('inf')
    patience_counter = 0
    history = {'train_loss': [], 'val_loss': [], 'val_f1': []}
    
    print("Starting training...")
    
    for epoch in range(epochs):
        model.train()
        train_loss = 0
        
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
            
        avg_train_loss = train_loss / len(train_loader)
        
        # Validation
        val_metrics, _, _ = evaluate_model(model, val_loader)
        val_loss = val_metrics['loss']
        val_f1 = val_metrics['f1']
        
        history['train_loss'].append(avg_train_loss)
        history['val_loss'].append(val_loss)
        history['val_f1'].append(val_f1)
        
        print(f"Epoch {epoch+1}/{epochs} | Train Loss: {avg_train_loss:.4f} | Val Loss: {val_loss:.4f} | Val F1: {val_f1:.4f}")
        
        # Early Stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), MODEL_SAVE_PATH)
            # print("  Saved best model.")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print("Early stopping triggered.")
                break
                
    return history

if __name__ == "__main__":
    # Check for data
    data_path = DATA_PATH_AUG if os.path.exists(DATA_PATH_AUG) else DATA_PATH_RAW
    if not os.path.exists(data_path):
        print("No data found. Please run task 2 (and 3) first.")
        exit(1)
        
    print(f"Using dataset: {data_path}")
    
    # Feature Extraction
    extractor = FeatureExtractor(use_transformer=False, use_tfidf=False)
    
    train_loader, val_loader, input_dim = load_and_prepare_data(data_path, extractor)
    
    # Model
    model = RequirementClassifier(input_dim=input_dim)
    
    # Train
    history = train_model(model, train_loader, val_loader)
    
    # Final Evaluation
    best_model = RequirementClassifier(input_dim=input_dim)
    best_model.load_state_dict(torch.load(MODEL_SAVE_PATH))
    
    final_metrics, preds, true_labels = evaluate_model(best_model, val_loader)
    
    print("\nFinal Evaluation on Validation Set:")
    print(f"Accuracy: {final_metrics['accuracy']:.4f}")
    print(f"Macro F1: {final_metrics['f1']:.4f}")
    print("Per Class F1 Scores:")
    class_names = ['Auth', 'Authz', 'Encrypt', 'Valid', 'Audit', 'RateLim']
    for name, f1 in zip(class_names, final_metrics['f1_per_class']):
        print(f"  {name}: {f1:.4f}")
        
    print(f"\nModel saved to {MODEL_SAVE_PATH}")
