import os
import csv
import time
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
    print("Warning: GEMINI_API_KEY not found in environment variables or .env file.")
    print("Please set GEMINI_API_KEY to run the augmentation.")
    exit(1)

if api_key:
    genai.configure(api_key=api_key)

def get_model():
    if not api_key:
        return None
    return genai.GenerativeModel('gemini-1.5-flash')

def generate_variations(text, count=3):
    model = get_model()
    if not model:
        return [f"Variation {i+1}: {text}" for i in range(count)]
        
    prompt = f"""Generate {count} semantically similar variations of this software requirement specification.
    Keep the technical meaning and implied security needs EXACTLY the same, but vary the wording, sentence structure, and vocabulary.
    Do not add new security requirements or remove existing ones.
    
    Original: "{text}"
    
    Return ONLY the variations, one per line, starting with '- '. Do not include any other text."""
    
    try:
        response = model.generate_content(prompt)
        lines = response.text.strip().split('\n')
        variations = []
        for line in lines:
            clean_line = line.strip()
            if clean_line.startswith('- '):
                variations.append(clean_line[2:])
            elif clean_line.startswith('* '):
                 variations.append(clean_line[2:])
            elif clean_line:
                variations.append(clean_line)
        return variations[:count]
    except Exception as e:
        print(f"Error generating variations for '{text}': {e}")
        return []

def augment_dataset(input_file, output_file, variations_per_sample=3):
    print(f"Augmenting dataset from {input_file}...")
    
    samples = []
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            samples.append(row)
            
    print(f"Loaded {len(samples)} samples.")
    
    augmented_samples = []
    total_generated = 0
    
    # Headers
    fieldnames = ['id', 'text', 'missing_auth', 'missing_authz', 'missing_encryption', 
                  'missing_validation', 'missing_audit', 'missing_ratelimit', 'category']
                  
    for i, sample in enumerate(samples):
        augmented_samples.append(sample)
        
        
        print(f"Processing {i+1}/{len(samples)}: {sample['text'][:50]}...")
        
        variations = generate_variations(sample['text'], variations_per_sample)
        
        for var_text in variations:
            new_sample = sample.copy()
            new_sample['id'] = len(samples) + total_generated + 1
            new_sample['text'] = var_text
            augmented_samples.append(new_sample)
            total_generated += 1
            
        if api_key:
            time.sleep(1) 
            
    print(f"Generation complete. Total samples: {len(augmented_samples)}")
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(augmented_samples)
        
    print(f"Saved to {output_file}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, 'data', 'raw_samples.csv')
    output_path = os.path.join(base_dir, 'data', 'augmented_samples.csv')
    
    # Ensure directories exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    if os.path.exists(input_path):
        augment_dataset(input_path, output_path, variations_per_sample=4) # 200 * 5 = 1000
    else:
        print(f"Error: {input_path} not found.")
