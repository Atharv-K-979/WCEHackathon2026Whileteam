import torch
import torch.nn as nn

class RequirementClassifier(nn.Module):
    def __init__(self, input_dim, hidden_dims=[512, 256, 128], num_classes=6, dropout=0.3):
        super().__init__()
        
        layers = []
        prev_dim = input_dim
        
        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.BatchNorm1d(hidden_dim),
                nn.ReLU(),
                nn.Dropout(dropout)
            ])
            prev_dim = hidden_dim
        
        layers.append(nn.Linear(prev_dim, num_classes))
        
        self.network = nn.Sequential(*layers)
        self.sigmoid = nn.Sigmoid()  
    
    def forward(self, x):
        return self.sigmoid(self.network(x))

if __name__ == "__main__":
    input_dim = 786 
    model = RequirementClassifier(input_dim=input_dim)
    print(model)
    
    dummy_input = torch.randn(2, input_dim) 
    output = model(dummy_input)
    print(f"Input shape: {dummy_input.shape}")
    print(f"Output shape: {output.shape}")
    assert output.shape == (2, 6)
    print("Model test passed.")
