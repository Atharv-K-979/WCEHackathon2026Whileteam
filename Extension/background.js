import { MLEngine } from './lib/ml-engine.js';
import { sanitizeDOM, detectObfuscatedPayloads } from './lib/sanitizer.js';
import GeminiClient from './lib/gemini-client.js';

// Initialize model on install AND on every service worker startup
// (MV3 service workers can be terminated and restarted at any time)
MLEngine.initialize().catch(e => console.error('[VESSEL] Startup init error:', e));

chrome.runtime.onInstalled.addListener(async () => {
    await MLEngine.initialize();
    console.log('[VESSEL] Service worker installed. ML Engine initialized.');

    chrome.storage.local.get(['incidents', 'stats'], (result) => {
        if (!result.stats) {
            chrome.storage.local.set({
                stats: { blocks: 0, avgRisk: 0, totalScans: 0, redactions: 0 },
                incidents: []
            });
        }
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
        .then(sendResponse)
        .catch(error => {
            console.error('VESSEL: Worker error:', error);
            sendResponse({ success: false, error: error.message });
        });
    return true;
});

async function handleMessage(message) {
    switch (message.action) {
        case 'analyzePage':
        case 'analyzePrompt':
            return await analyzePageContent(message.text, message.threats || []);
        case 'analyzeSpec':
        case 'GENERATE_SPECS':
            return await analyzeSpecification(message.text);
        case 'summarize':
            return await summarizeContent(message.text);
        case 'logIncident':
            return await logIncident(message.data);
        case 'getModelStatus': {
            const { mlModelStatus } = await chrome.storage.local.get('mlModelStatus');
            return {
                backend:    mlModelStatus || (MLEngine.modelReady ? MLEngine.backend : 'loading'),
                modelReady: MLEngine.modelReady
            };
        }
        default:
            console.warn('[VESSEL] Unknown action:', message.action);
            return { error: 'Unknown action' };
    }
}

async function analyzePageContent(combinedContent, obfuscatedThreats = []) {

    // 3. Score with both keyword analysis and obfuscation threats
    const threatScore = await MLEngine.detectInjection(combinedContent, obfuscatedThreats);

    if (threatScore > 0.7) {
        await logIncident({
            type: 'prompt_injection',
            details: 'Suspicious AI prompt detected',
            score: threatScore,
            timestamp: Date.now()
        });
        updateStats(threatScore, true);
    } else {
        updateStats(threatScore, false);
    }

    return {
        score: threatScore,
        sanitized: combinedContent,
        threats: obfuscatedThreats   // Pass threats to content script for display
    };
}

async function analyzeSpecification(text) {
    const { geminiApiKey, specModelPreference } = await chrome.storage.local.get(['geminiApiKey', 'specModelPreference']);
    // specModelPreference: 'gemini' | 'local' | undefined (default = 'gemini' if key present, else 'local')
    const preferGemini = specModelPreference !== 'local';

    let requirements = [];
    let modelSource = 'heuristic';
    const startTime = Date.now();

    // ── Attempt 1: Gemini (if key present and preference allows) ───────────
    if (geminiApiKey && preferGemini) {
        try {
            console.log('[VESSEL] Sending spec to Gemini for analysis...');
            const geminiClient = new GeminiClient(geminiApiKey);
            requirements = await geminiClient.generateRequirements(text);
            modelSource = 'gemini';
        } catch (geminiError) {
            console.warn('[VESSEL] Gemini failed, falling back to local model:', geminiError.message);
            // Signal fallback to content script via a special flag
            modelSource = 'local_fallback';
        }
    }

    // ── Attempt 2: Local ML engine (if Gemini skipped or failed) ──────────
    if (requirements.length === 0) {
        try {
            console.log('[VESSEL] Using local ML engine for spec analysis...');
            requirements = await MLEngine.generateRequirements(text);
            if (modelSource !== 'local_fallback') modelSource = 'local';
        } catch (localError) {
            console.warn('[VESSEL] Local model also failed, using heuristic:', localError.message);
            modelSource = 'heuristic';
        }
    }

    // ── Attempt 3: Hard-coded heuristic defaults ─────────────────────────
    if (requirements.length === 0) {
        const geminiClient = new GeminiClient(null);
        requirements = geminiClient.getDefaultRequirements();
        modelSource = 'heuristic';
    }

    const inferenceMs = Date.now() - startTime;

    const missing = requirements.map(reqText => ({
        category: 'Generated Requirement',
        template: reqText,
        score: 0.9
    }));

    return { missing, inferenceMs, modelSource };
}

function getRequirementTemplate(category) {
    const templates = {
        "authentication": "The system must enforce multi-factor authentication (MFA) for all administrative access and sensitive actions.",
        "authorization": "Access control lists (ACLs) must be checked at the API gateway level to ensure users can only access their own data.",
        "encryption": "All sensitive data at rest must be encrypted using AES-256. Data in transit must use TLS 1.3.",
        "input validation": "All user inputs must be validated against a strict allowlist of expected formats and types.",
        "audit logging": "All security-critical events (login flags, sensitive data access) must be logged with timestamp, user ID, and source IP.",
        "rate limiting": "API endpoints must implement rate limiting (e.g., 100 req/min) to prevent abuse and DoS attacks."
    };
    return templates[category] || "Security requirement missing.";
}

async function summarizeContent(text) {
    return await MLEngine.summarize(text);
}

async function logIncident(data) {
    const { incidents = [] } = await chrome.storage.local.get('incidents');
    incidents.unshift(data);
    if (incidents.length > 50) incidents.pop();
    await chrome.storage.local.set({ incidents });

    // Maintain redaction count for paste events
    if (data.type === 'sensitive_paste') {
        const { stats } = await chrome.storage.local.get('stats');
        if (stats) {
            await chrome.storage.local.set({
                stats: { ...stats, redactions: (stats.redactions || 0) + 1 }
            });
        }
    }
    return { success: true };
}

async function updateStats(riskScore, isBlock) {
    const { stats } = await chrome.storage.local.get('stats');
    if (!stats) return;

    const newTotal = (stats.totalScans || 0) + 1;
    const currentAvg = stats.avgRisk || 0;
    const newAvg = ((currentAvg * (newTotal - 1)) + riskScore) / newTotal;

    const newStats = {
        blocks: (stats.blocks || 0) + (isBlock ? 1 : 0),
        avgRisk: parseFloat(newAvg.toFixed(2)),
        totalScans: newTotal
    };

    await chrome.storage.local.set({ stats: newStats });
}
