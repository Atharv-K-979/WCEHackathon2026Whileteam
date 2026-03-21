# VESSEL: DevSecOps at the Human-AI Interface

<p align="center">
  <img src="Extension/icons/icon128.png" alt="VESSEL Logo" width="128">
</p>

**VESSEL** (Vulnerability Evaluation and Secure Software Engineering Layer) is a comprehensive security suite designed to protect developers in the age of AI. It operates as a first line of defense, ensuring that sensitive data, malicious prompts, and insecure specifications never compromise the development lifecycle.

---

## 🚀 The Problem
The modern security perimeter has shifted from the network to the developer's browser. As developers increasingly rely on AI assistants, human errors—like pasting sensitive API keys into ChatGPT or falling victim to hidden prompt injections in web content—bypass traditional WAFs and CSPMs.

## 🛡️ The Solution
VESSEL provides three distinct defensive layers, operating entirely locally to preserve privacy and performance:

### 1. AI Prompt Injection Defense
Prevents malicious web pages from manipulating AI assistants. It scans page content for hidden instructions and blocks suspicious triggers, ensuring your AI summary or explanation isn't hijacked.

### 2. Paste Redactor
Intercepts global paste events to detect sensitive patterns (AWS keys, credit cards, PII). Users are given the option to **Redact**, **Cancel**, or **Proceed**, preventing accidental exposure of secrets to AI tools or Jira tickets.

### 3. Secure Specification Assistant
Analyzes requirements in real-time within editors like Jira and Notion. It identifies missing security categories (Authentication, Encryption, Input Validation) and allows one-click injection of industry-standard security templates.

---

## 📂 Project Structure
- **/Extension**: The core Chrome extension (Manifest V3) containing the redactor, interceptor, and local ML models.
- **/VESSEL_WEB**: The professional landing page and dashboard for the project.

---

## 🛠️ Tech Stack
- **Browser Extension**: Chrome MV3, Vanilla JS, Shadow DOM.
- **Local ML Engine**: `onnxruntime-web` (WASM) for high-performance, local classification.
- **Generative AI**: Integration with Google Gemini 1.5 Flash for intelligent remediation.
- **Frontend**: React + Vite (Landing Page).

---

## 🏁 Getting Started

### Extension Setup
1. Clone the repository.
2. Open `chrome://extensions/` in your browser.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `/Extension` directory.

### Web Setup
1. Navigate to `/VESSEL_WEB`.
2. Run `npm install` and `npm run dev`.

---

## 🏛️ Acknowledgments
The name **VESSEL** was inspired by research into container security at Carnegie Mellon University (CMU SEI). We believe the web browser is the modern enterprise's ultimate container, and we mathematically verify the "cargo" before it is deployed.

## ✍️ Learn More
Read our detailed design philosophy on [Medium](https://medium.com/@atharvvk853/vessel-vulnerability-evaluation-and-secure-software-engineering-layer-78250e113b8a).

---
<p align="center">
  <i>"The security perimeter isn't the cloud. The perimeter is the human."</i>
</p>