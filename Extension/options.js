import { patterns } from './lib/patterns.js';

const DEFAULTS = {
    features: {
        aiDefense: true,
        specAssist: true,
        pasteRedact: true
    },
    thresholds: {
        aiInjection: 0.7
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await restoreOptions();
    renderPatterns();
    setupListeners();
    updateModelStatus();
});

async function restoreOptions() {
    chrome.storage.local.get(['settings', 'geminiApiKey', 'specModelPreference'], (result) => {
        const settings = result.settings || DEFAULTS;

        // Feature toggles
        document.getElementById('feature-ai-defense').checked = settings.features.aiDefense;
        document.getElementById('feature-spec-assist').checked = settings.features.specAssist;
        document.getElementById('feature-paste-redact').checked = settings.features.pasteRedact;

        // Thresholds
        const aiThreshold = settings.thresholds.aiInjection;
        document.getElementById('threshold-ai').value = aiThreshold;
        document.getElementById('threshold-ai-val').textContent = aiThreshold;

        // API Key
        if (result.geminiApiKey) {
            document.getElementById('gemini-api-key').value = result.geminiApiKey;
        }

        // Model preference radio – default to 'gemini'
        const pref = result.specModelPreference || 'gemini';
        const radio = document.getElementById(`model-pref-${pref}`);
        if (radio) radio.checked = true;
    });
}

function setupListeners() {
    // Auto-save on any input change
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('change', () => saveOptions());
    });

    document.getElementById('threshold-ai').addEventListener('input', (e) => {
        document.getElementById('threshold-ai-val').textContent = e.target.value;
    });

    // Update status indicator when preference changes
    const radios = document.querySelectorAll('input[name="specModelPreference"]');
    radios.forEach(r => r.addEventListener('change', updateModelStatus));
}

function saveOptions() {
    const settings = {
        features: {
            aiDefense:   document.getElementById('feature-ai-defense').checked,
            specAssist:  document.getElementById('feature-spec-assist').checked,
            pasteRedact: document.getElementById('feature-paste-redact').checked
        },
        thresholds: {
            aiInjection: parseFloat(document.getElementById('threshold-ai').value)
        }
    };

    const geminiApiKey = document.getElementById('gemini-api-key').value.trim();

    // Read selected model preference
    const selectedPref = document.querySelector('input[name="specModelPreference"]:checked');
    const specModelPreference = selectedPref ? selectedPref.value : 'gemini';

    chrome.storage.local.set({ settings, geminiApiKey, specModelPreference }, () => {
        showStatus('Settings Saved ✓');
        updateModelStatus();
    });
}

/**
 * updateModelStatus – Populates the #model-status indicator with the current
 * engine configuration, availability, and live backend state from background.js.
 */
function updateModelStatus() {
    const statusEl = document.getElementById('model-status');
    if (!statusEl) return;

    // Show loading spinner while we query the background
    statusEl.innerHTML = '🔄 Checking model status…';

    chrome.storage.local.get(['geminiApiKey', 'specModelPreference'], async (result) => {
        const pref   = result.specModelPreference || 'gemini';
        const hasKey = !!(result.geminiApiKey?.length);

        // Query the background worker for live ML engine state
        let backend    = 'unknown';
        let modelReady = false;
        try {
            const status = await chrome.runtime.sendMessage({ action: 'getModelStatus' });
            if (status) { backend = status.backend || backend; modelReady = status.modelReady; }
        } catch (_) { /* background may be asleep – use cached storage value */ }

        // If runtime query fails, fall back to cached value
        if (backend === 'unknown') {
            const cached = await chrome.storage.local.get('mlModelStatus');
            backend = cached.mlModelStatus || 'unknown';
        }

        const backendLabel = {
            onnx:    '⚙️ ONNX model loaded',
            mock:    ' Heuristic fallback (no ONNX model)',
            loading: '⏳ Local model loading…',
            unknown: '❓ Status unknown'
        }[backend] ?? ` ${backend}`;

        let html = '';
        if (pref === 'gemini') {
            if (hasKey) {
                html  = `<span style="color:#34D399;"> Gemini 1.5 Flash</span> – API key configured. `;
                html += `Fallback: ${backendLabel}.`;
            } else {
                html  = `<span style="color:#F59E0B;">⚠️ Gemini selected</span> – No API key set. `;
                html += `All requests will use local model. ${backendLabel}.`;
            }
        } else {
            html  = `<span style="color:#60A5FA;"> Local model only</span> – Privacy-first mode. `;
            html += `${backendLabel}. No data sent externally.`;
        }

        statusEl.innerHTML = html;
    });
}

function renderPatterns() {
    const container = document.getElementById('patterns-container');
    container.innerHTML = '';
    patterns.forEach(p => {
        const tag = document.createElement('span');
        tag.className = 'pattern-tag';
        tag.textContent = p.name;
        container.appendChild(tag);
    });
}

function showStatus(msg) {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2000);
}
