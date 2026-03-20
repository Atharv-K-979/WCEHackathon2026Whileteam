/**
 * ml-engine.js – VESSEL ML Engine
 *
 * Features:
 *  - modelReady flag + async initialization queue (requests wait for init)
 *  - ONNX backend with auto-fallback to mock heuristics
 *  - detectInjection(text, threats) – weighted keyword + obfuscation score (0–1)
 *  - generateRequirements(specText) – local generator → fallback classification
 *  - classify(text, labels) – ONNX inference or heuristic fallback
 *  - Full try/catch around all inference calls with console error logging
 */

import './onnxruntime-web.min.js';
const ort = globalThis.ort;

class MLEngine {
    constructor() {
        this.session          = null;
        this.featureExtractor = null;
        this.backend          = null;
        this.generator        = null;

        // ── Model-ready state ────────────────────────────────────────────
        /** True once initialize() has completed (success or fallback). */
        this.modelReady = false;

        /**
         * Pending promise queue: callers that arrive before initialization
         * completes will await this promise before proceeding.
         * @type {Promise<void>|null}
         */
        this._initPromise = null;

        try {
            ort.env.wasm.wasmPaths = chrome.runtime.getURL('lib/');
            ort.env.wasm.numThreads = 1;
        } catch (e) {
            console.warn('[VESSEL] Could not set WASM paths', e);
        }

        this.technicalKeywords = {
            'api':      ['api', 'endpoint', 'rest', 'graphql', 'soap', 'route'],
            'database': ['db', 'database', 'sql', 'nosql', 'mongodb', 'postgres', 'mysql', 'store', 'query'],
            'auth':     ['login', 'user', 'password', 'auth', 'credential', 'token', 'jwt', 'session', 'sign in', 'signup'],
            'payment':  ['credit', 'card', 'payment', 'stripe', 'paypal', 'money', 'transaction', 'billing'],
            'file':     ['upload', 'file', 'image', 'picture', 'document', 'pdf', 'csv', 'download'],
            'admin':    ['admin', 'dashboard', 'settings', 'config', 'manage', 'delete', 'update', 'edit'],
            'data':     ['data', 'analytics', 'report', 'stats', 'profile', 'email', 'phone', 'address']
        };
    }

    // ── Initialization ───────────────────────────────────────────────────────

    /**
     * initialize – Loads the ONNX model (or sets mock backend on failure).
     * Safe to call multiple times – subsequent calls return the same promise.
     *
     * @returns {Promise<boolean>}
     */
    async initialize() {
        // Return cached promise if already initializing/initialized
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInitialize();
        return this._initPromise;
    }

    async _doInitialize() {
        try {
            const modelUrl = chrome.runtime.getURL('models/requirement-model.onnx');
            const response = await fetch(modelUrl, { method: 'HEAD' });
            if (!response.ok) throw new Error('ONNX model file not found.');

            this.session = await ort.InferenceSession.create(modelUrl);
            this.backend = 'onnx';
            console.log('[VESSEL] ML Engine ONNX classifier initialized');
        } catch (error) {
            console.warn('[VESSEL] Falling back to Mock Engine for classification:', error.message);
            this.backend = 'mock';
        }

        // Transformers.js local generator is disabled in MV3 ServiceWorkers
        // (dynamic import causes TypeError in ServiceWorkerGlobalScope)
        this.generator = null;

        this.modelReady = true;
        console.log(`[VESSEL] modelReady=true (backend: ${this.backend})`);

        // Persist model status for options page display
        try {
            await chrome.storage.local.set({ mlModelStatus: this.backend });
        } catch (_) { /* storage unavailable outside extension context */ }

        return true;
    }

    /**
     * _waitReady – Ensures initialization is complete before running inference.
     * Any method that requires the model should call this first.
     */
    async _waitReady() {
        if (!this._initPromise) await this.initialize();
        await this._initPromise;
    }

    // ── Requirement Generation ───────────────────────────────────────────────

    /**
     * generateRequirements – Produces an array of security requirement strings
     * for the given spec text. Uses local generator if available, else falls
     * back to classification-template mapping.
     *
     * @param {string} specText
     * @returns {Promise<string[]>}
     */
    async generateRequirements(specText) {
        await this._waitReady();

        if (this.generator) {
            try {
                console.log('[VESSEL] Using local generator for specs...');
                const prompt = `Given this software specification, list missing security requirements:\n${specText}\nRequirements:\n- `;
                const result = await this.generator(prompt, {
                    max_new_tokens: 150,
                    temperature: 0.3,
                    do_sample: true
                });

                if (result?.length > 0) {
                    const parsed = this.parseBulletPoints(result[0].generated_text);
                    if (parsed.length > 0) return parsed;
                }
            } catch (error) {
                console.error('[VESSEL] Local generator failed:', error);
            }
        }

        // Fallback: classification-template hybrid
        return this.fallbackClassifyToRequirements(specText);
    }

    /**
     * parseBulletPoints – Extracts bullet-point lines from generated text.
     * @param {string} text
     * @returns {string[]}
     */
    parseBulletPoints(text) {
        return text
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
            .map(line => line.replace(/^[-*]\s*/, '').trim())
            .filter(line => line.length > 0);
    }

    /**
     * fallbackClassifyToRequirements – Uses ONNX/mock classify to pick which
     * standard security templates are relevant for the given spec text.
     * @param {string} text
     * @returns {Promise<string[]>}
     */
    async fallbackClassifyToRequirements(text) {
        console.log('[VESSEL] Using classification-template fallback');
        const labels = [
            'authentication', 'authorization', 'encryption',
            'input validation', 'audit logging', 'rate limiting'
        ];

        const defaults = {
            'authentication':  'The system must enforce multi-factor authentication (MFA) for all administrative access and sensitive actions.',
            'authorization':   'Access control lists (ACLs) must be checked at the API gateway level to ensure users can only access their own data.',
            'encryption':      'All sensitive data at rest must be encrypted using AES-256. Data in transit must use TLS 1.3.',
            'input validation':'All user inputs must be validated against a strict allowlist of expected formats and types.',
            'audit logging':   'All security-critical events (login, sensitive data access) must be logged with timestamp, user ID, and source IP.',
            'rate limiting':   'API endpoints must implement rate limiting (e.g., 100 req/min) to prevent abuse and DoS attacks.'
        };

        try {
            const classifyResult = await this.classify(text, labels);
            const results = classifyResult
                .filter(r => r.score < 0.5)
                .map(r => defaults[r.label] || `Missing security requirement for ${r.label}.`);

            // Always return at least something meaningful
            return results.length > 0 ? results : Object.values(defaults);
        } catch (e) {
            console.error('[VESSEL] fallbackClassifyToRequirements error:', e);
            return Object.values(defaults);
        }
    }

    // ── Injection Detection ──────────────────────────────────────────────────

    /**
     * detectInjection – Computes a threat confidence score (0–1).
     *
     * Components:
     *   A) Keyword match strength – weighted sum of matched phrases (capped 0.8)
     *   B) Obfuscation bonus     – 0.2 per unique obfuscation type in threats[]
     *
     * @param {string} text     - Plain/sanitized content to scan
     * @param {Array}  [threats=[]] - Output of detectObfuscatedPayloads()
     * @returns {Promise<number>} Score in [0, 1]
     */
    async detectInjection(text, threats = []) {
        try {
            const lower = text.toLowerCase();

            const weightedPatterns = [
                { phrase: 'ignore previous',     weight: 0.35 },
                { phrase: 'ignore all previous', weight: 0.40 },
                { phrase: 'system prompt',       weight: 0.30 },
                { phrase: 'forget everything',   weight: 0.35 },
                { phrase: 'new instructions',    weight: 0.25 },
                { phrase: 'you are now',         weight: 0.25 },
                { phrase: 'bypass',              weight: 0.20 },
                { phrase: 'do not follow',       weight: 0.30 },
                { phrase: 'disregard',           weight: 0.20 },
                { phrase: 'act as',              weight: 0.15 },
                { phrase: 'jailbreak',           weight: 0.35 },
                { phrase: 'pretend you are',     weight: 0.25 },
                { phrase: 'override',            weight: 0.20 }
            ];

            let keywordScore = 0;
            for (const { phrase, weight } of weightedPatterns) {
                if (lower.includes(phrase)) keywordScore += weight;
            }
            keywordScore = Math.min(keywordScore, 0.8);

            const uniqueTypes     = new Set(threats.map(t => t.type));
            const obfuscationBonus = uniqueTypes.size * 0.2;

            const score = Math.min(keywordScore + obfuscationBonus, 1.0);
            console.log(`[VESSEL] detectInjection score=${score.toFixed(2)} (keyword=${keywordScore.toFixed(2)}, obfusc=${obfuscationBonus.toFixed(2)})`);
            return score;
        } catch (e) {
            console.error('[VESSEL] detectInjection error:', e);
            return 0; // Safe default – don't block on error
        }
    }

    // ── Classification ─────────────────────────────────────────────────────

    /**
     * classify – Runs ONNX inference or heuristic fallback.
     * Waits for model initialization before attempting inference.
     *
     * @param {string}   text
     * @param {string[]} labels
     * @returns {Promise<Array<{label:string, score:number}>>}
     */
    async classify(text, labels) {
        await this._waitReady();

        if (this.backend === 'mock' || !this.session) {
            return this.fallbackClassify(text, labels);
        }

        try {
            const features     = await this.extractFeatures(text);
            const inputTensor  = new ort.Tensor('float32', Float32Array.from(features), [1, features.length]);
            const outputs      = await this.session.run({ input: inputTensor });
            const scores       = outputs.output.data;

            return labels.map((label, i) => ({ label, score: scores[i] }));
        } catch (e) {
            console.error('[VESSEL] ONNX inference error:', e);
            return this.fallbackClassify(text, labels);
        }
    }

    async extractFeatures(text) {
        return this.extractTechnicalIndicators(text);
    }

    async summarize(text) {
        return 'Content summary generated by VESSEL (Placeholder).';
    }

    // ── Feature Extraction ─────────────────────────────────────────────────

    extractTechnicalIndicators(text) {
        const lower    = text.toLowerCase();
        const features = [];

        for (const [, keywords] of Object.entries(this.technicalKeywords)) {
            let count = 0;
            for (const kw of keywords) {
                if (lower.includes(kw)) count++;
            }
            features.push(count);
            features.push(count > 0 ? 1 : 0);
        }

        features.push(text.length / 1000);
        features.push(text.split(/\s+/).length / 100);
        features.push(lower.includes('http') ? 1 : 0);
        features.push(/\d/.test(text) ? 1 : 0);

        return features;
    }

    fallbackClassify(text, labels) {
        return labels.map(label => ({
            label,
            score: text.toLowerCase().includes(label) ? 0.8 : 0.1
        }));
    }
}

export const mlEngineInstance = new MLEngine();
export { mlEngineInstance as MLEngine };
