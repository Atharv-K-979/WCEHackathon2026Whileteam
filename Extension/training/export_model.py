import torch
import torch.onnx
import onnx
import onnxruntime
import numpy as np
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from model_architecture import RequirementClassifier

def convert_to_onnx(pytorch_model_path, onnx_model_path, input_dim):
    print(f"Loading PyTorch model from {pytorch_model_path}...")
    
    if not os.path.exists(pytorch_model_path):
        print(f"Error: Model file {pytorch_model_path} not found. Please train the model first.")
        return False

    # Initialize model
    model = RequirementClassifier(input_dim=input_dim)
    try:
        model.load_state_dict(torch.load(pytorch_model_path))
    except Exception as e:
        print(f"Error loading state dict: {e}")
        return False
        
    model.eval()
    
    dummy_input = torch.randn(1, input_dim)
    
    print(f"Exporting to {onnx_model_path}...")
    os.makedirs(os.path.dirname(onnx_model_path), exist_ok=True)
    
    # Export to ONNX
    torch.onnx.export(
        model,
        dummy_input,
        onnx_model_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    # Verify ONNX model
    try:
        onnx_model = onnx.load(onnx_model_path)
        onnx.checker.check_model(onnx_model)
        print("ONNX model structure verification passed.")
    except Exception as e:
        print(f"ONNX verification failed: {e}")
        return False
    
    # Test with ONNX Runtime
    try:
        session = onnxruntime.InferenceSession(onnx_model_path)
        test_input = np.random.randn(1, input_dim).astype(np.float32)
        outputs = session.run(['output'], {'input': test_input})
        print(f"ONNX Runtime inference successful.")
        print(f"Output shape: {outputs[0].shape}")
        print("Export complete!")
        return True
    except Exception as e:
        print(f"ONNX Runtime test failed: {e}")
        return False

if __name__ == "__main__":
    
    base_dir = os.path.dirname(os.path.abspath(__file__)) # training/
    project_root = os.path.dirname(base_dir)
    
    pytorch_path = os.path.join(base_dir, 'best_model.pt')
    
    onnx_path = os.path.join(project_root, 'models', 'requirement-model.onnx')
    
    # 7 categories * 2 (count + bool) = 14
    # + 2 text stats (len, words)
    # + 2 specific indicators (http, digit)
    # Total = 18
    INPUT_DIM = 18 
    
    convert_to_onnx(pytorch_path, onnx_path, input_dim=INPUT_DIM)
