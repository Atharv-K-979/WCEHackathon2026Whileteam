import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from transformers import AutoTokenizer, AutoModel
import torch

class FeatureExtractor:
    def __init__(self, use_transformer=True, use_tfidf=True):
        self.use_transformer = use_transformer
        self.use_tfidf = use_tfidf
        
        if use_transformer:
            print("Loading CodeBERT model...")
            self.tokenizer = AutoTokenizer.from_pretrained('microsoft/codebert-base')
            self.model = AutoModel.from_pretrained('microsoft/codebert-base')
        elif use_tfidf:
            self.tfidf = TfidfVectorizer(max_features=500, stop_words='english')
            
        self.technical_keywords = {
            'api': ['api', 'endpoint', 'rest', 'graphql', 'soap', 'route'],
            'database': ['db', 'database', 'sql', 'nosql', 'mongodb', 'postgres', 'mysql', 'store', 'query'],
            'auth': ['login', 'user', 'password', 'auth', 'credential', 'token', 'jwt', 'session', 'sign in', 'signup'],
            'payment': ['credit', 'card', 'payment', 'stripe', 'paypal', 'money', 'transaction', 'billing'],
            'file': ['upload', 'file', 'image', 'picture', 'document', 'pdf', 'csv', 'download'],
            'admin': ['admin', 'dashboard', 'settings', 'config', 'manage', 'delete', 'update', 'edit'],
            'data': ['data', 'analytics', 'report', 'stats', 'profile', 'email', 'phone', 'address']
        }

    def extract_features(self, texts):
        """Main method to get all features concatenated"""
        technical_features = self.extract_technical_indicators(texts)
        
        if self.use_transformer:
            embedding_features = self.extract_codebert_features(texts)
            return np.hstack([embedding_features, technical_features])
        elif self.use_tfidf:
            embedding_features = self.extract_tfidf_features(texts)
            return np.hstack([embedding_features, technical_features])
        else:
            return technical_features

    def extract_tfidf_features(self, texts):
        return self.tfidf.fit_transform(texts).toarray()
    
    def extract_codebert_features(self, texts):
        print("Extracting CodeBERT embeddings...")
        features = []
        batch_size = 16
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            inputs = self.tokenizer(batch_texts, return_tensors='pt', padding=True, truncation=True, max_length=512)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            embeddings = outputs.last_hidden_state[:, 0, :].numpy()
            features.append(embeddings)
            
        return np.vstack(features)
    
    def extract_technical_indicators(self, texts):
        """Extract hand-crafted features: presence of technical keywords, length, etc."""
        features = []
        for text in texts:
            row_feats = []
            lower_text = text.lower()
            
            for category, keywords in self.technical_keywords.items():
                count = sum(1 for kw in keywords if kw in lower_text)
                row_feats.append(float(count)) 
                row_feats.append(1.0 if count > 0 else 0.0)
                
            row_feats.append(len(text) / 1000) # Normalized length
            row_feats.append(len(text.split()) / 100) # Word count
            
            row_feats.append(1 if 'http' in lower_text else 0) # Contains URL
            row_feats.append(1 if any(c.isdigit() for c in text) else 0) # Contains numbers
            
            features.append(row_feats)
            
        return np.array(features, dtype=np.float32)

if __name__ == "__main__":
    extractor = FeatureExtractor(use_transformer=False) 
    sample_texts = [
        "Create an API to transfer funds.", 
        "Update the logo color."
    ]
    feats = extractor.extract_features(sample_texts)
    print(f"Features shape: {feats.shape}")
    print("Test passed.")
