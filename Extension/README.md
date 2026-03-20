# VESSEL - Browser Extension

Vulnerability Evaluation and Secure Software Engineering Layer (VESSEL) is a comprehensive security tool for developers using AI assistants. It operates entirely locally within the browser to protect against prompt injection, identify missing security requirements in specifications, and redact sensitive data from being pasted.

## 🧠 Why VESSEL?
The modern security perimeter is no longer the cloud; it is the developer's browser. Whether pasting a plaintext password into Jira or dropping an `AWS_ACCESS_KEY` into ChatGPT, human error bypasses traditional WAFs and CSPMs. 

VESSEL solves this by cramming a local Machine Learning model (`onnxruntime-web`) and a multi-stage heuristic engine directly into the browser. It analyzes text, calculates cryptographic checksums, and dynamically calls the Gemini 1.5 Flash API for generative remediation—all without freezing the main UI thread.

## ✨ Features

### 1. AI Prompt Injection Defense
*   **What it does:** Intercepts clicks on AI extension buttons (e.g., "Summarize", "Explain") to prevent malicious hidden instructions in the page content from manipulating the AI.
*   **How it works:** 
    *   Detects clicks on known AI triggers.
    *   Scans the page content for hidden text, comments, and suspicious attributes.
    *   Analyzes the content for prompt injection patterns.
    *   If a threat is detected, it blocks the action and shows a warning modal with a sanitized version of the content.

### 2. Secure Specification Assistant
*   **What it does:** Watches specification editors (Jira, Notion, Linear, etc.) to ensure security requirements are included.
*   **How it works:**
    *   Monitors typing in description fields.
    *   Analyzes the text for missing security categories (Authentication, Authorization, Encryption, Input Validation, etc.).
    *   Displays a non-intrusive badge if requirements are missing.
    *   Allows one-click injection of standard security requirement templates.

### 3. Paste Redactor
*   **What it does:** Prevents accidental pasting of sensitive data (API keys, PII, Credit Cards) into any input field.
*   **How it works:**
    *   Intercepts paste events globally.
    *   Scans clipboard text for sensitive patterns (Credit Cards, AWS Keys, Emails, IPs, etc.).
    *   If detected, blocks the paste and offers to **Redact** (replace with X's), **Cancel**, or **Proceed Anyway**.


## 🛠️ Tech Stack

* **Extension API:** Chrome Manifest V3 (Isolated Service Workers & Content Scripts)
* **DOM Manipulation:** Vanilla JavaScript (Zero-framework injection, Shadow DOM, MutationObservers)
* **Machine Learning (Local):** `onnxruntime-web` (WASM), custom INT8 quantized NLP classification model.
* **Generative AI (Cloud):** Google Gemini 1.5 Flash API.
* **Bundler:** Vite / Rollup (Custom configurations to handle Chrome CSP and `.wasm` binary imports).


## 🚀 Installation

### Prerequisites
* Node.js (v18+)
* npm or yarn
* Google Chrome (or any Chromium-based browser)
* A Google Gemini API Key (Get one at [Google AI Studio](https://aistudio.google.com/))
  
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/vessel-chrome-extension.git
    cd vessel-chrome-extension
    ```

2.  **Load into Chrome:**
    *   Open `chrome://extensions/`.
    *   Enable **Developer mode** (top right toggle).
    *   Click **Load unpacked**.
    *   Select the `vessel-chrome-extension` directory.

3.  **Usage:**
    *   The extension runs automatically in the background.
    *   Click the extension icon to view the dashboard with blockage stats and recent incidents.
    *   Right-click the icon and select **Options** (or click "Settings" in the popup) to configure features and sensitivity.

## Configuration

Go to the **Options** page to:
*   Enable/Disable specific features.
*   Adjust the **Threat Threshold** for AI prompt injection detection (0.1 - 1.0).
*   View the list of active sensitive data patterns.

## Development

*   **Manifest V3:** This extension uses the latest Chrome Extension Manifest V3.
*   **Local Processing:** All analysis happens locally using a lightweight mock ML engine (designed to be swapped with Transformers.js or Firefox ML API).
*   **Privacy:** No data is sent to external servers.

---
## 🏛️ Acknowledgments & Inspiration

The name **VESSEL** was inspired by research into software supply chain security, specifically a tool of the same name released by the [Carnegie Mellon University Software Engineering Institute (CMU SEI)](https://sei.cmu.edu/news/vessel-tool-enhances-container-reproducibility-and-security/). 

While their tool secures *Docker* containers from malware during the build process, this project operates on the philosophy that **the web browser is the modern enterprise's ultimate container**. Both tools share the same goal: mathematically verifying the cargo inside a vessel before it is deployed into a hostile environment.


## ✍️Blog

# 
A detailed explanation of the design and implementation decisions is available here:

Medium : https://medium.com/@atharvvk853/vessel-vulnerability-evaluation-and-secure-software-engineering-layer-78250e113b8a?postPublishedType=repub


## 🤝 Contributing

This project was originally built as a proof-of-concept DevSecOps tool for a hackathon. If you are a developer interested in Chrome MV3 architecture, local WebAssembly ML models, or browser-native security, contributions are welcome!


<p align="center">
  <br>
  <i>"The security perimeter isn't the cloud. The perimeter is the human."</i>
</p>
