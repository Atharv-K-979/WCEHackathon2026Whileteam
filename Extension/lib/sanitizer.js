
/**
 * sanitizer.js – VESSEL DOM Sanitization & Obfuscated Payload Detection
 *
 * Provides:
 *  - sanitizeDOM(html)                  : strips hidden/dangerous elements, returns clean text
 *  - detectObfuscatedPayloads(html)     : scans for base64, HTML entities, event handlers,
 *                                         and split-payload attacks; returns array of threat objects
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Keywords that indicate prompt-injection intent */
const INJECTION_KEYWORDS = [
    'ignore', 'override', 'system', 'forget', 'bypass',
    'disregard', 'new instructions', 'you are now', 'do not follow',
    'pretend', 'act as', 'jailbreak', 'dan', 'prompt'
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decodes HTML entities in a string to their plain-text equivalents.
 * Example: "&#105;&#103;&#110;&#111;&#114;&#101;" → "ignore"
 * @param {string} encodedStr
 * @returns {string}
 */
function decodeHtmlEntities(encodedStr) {
    // Use a textarea trick when DOMParser is available
    if (typeof document !== 'undefined') {
        const txt = document.createElement('textarea');
        txt.innerHTML = encodedStr;
        return txt.value;
    }
    // Fallback: simple numeric entity regex
    return encodedStr
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Tries to decode a base64 string. Returns the decoded text or null on failure.
 * @param {string} b64
 * @returns {string|null}
 */
function tryDecodeBase64(b64) {
    try {
        return atob(b64);
    } catch {
        return null;
    }
}

/**
 * Checks whether decoded text contains any injection keywords.
 * @param {string} text - Decoded / plain text
 * @returns {boolean}
 */
function containsInjectionKeyword(text) {
    const lower = text.toLowerCase();
    return INJECTION_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Main Exports ─────────────────────────────────────────────────────────────

/**
 * sanitizeDOM – Strips hidden elements, comments, and suspicious attributes
 * from raw HTML and returns safe plain text for ML analysis.
 *
 * @param {string} html - Raw HTML string from the page
 * @returns {string} - Cleaned plain text
 */
export function sanitizeDOM(html) {
    if (!html) return '';

    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove HTML comments
        const iterator = document.createNodeIterator(doc.body, NodeFilter.SHOW_COMMENT);
        let currentNode;
        while (currentNode = iterator.nextNode()) {
            currentNode.parentNode.removeChild(currentNode);
        }

        // Remove hidden / suspicious elements
        const elements = doc.body.querySelectorAll('*');
        elements.forEach(el => {
            const style = el.getAttribute('style') || '';
            const isHidden =
                style.includes('display:none') ||
                style.includes('display: none') ||
                style.includes('visibility:hidden') ||
                style.includes('visibility: hidden') ||
                style.includes('opacity:0') ||
                style.includes('opacity: 0') ||
                el.hasAttribute('hidden') ||
                el.getAttribute('aria-hidden') === 'true';

            if (isHidden) {
                el.remove();
                return;
            }

            // Sanitize suspicious aria-label values
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel && (ariaLabel.length > 100 || /ignore previous|system prompt/i.test(ariaLabel))) {
                el.removeAttribute('aria-label');
            }
        });

        return doc.body.innerText || doc.body.textContent || '';
    } else {
        console.warn('DOMParser not available, using regex fallback.');
        let cleanText = html.replace(/<(script|style|hidden)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
        cleanText = cleanText.replace(/<[^>]*>/g, ' ');
        return cleanText.replace(/\s+/g, ' ').trim();
    }
}

/**
 * detectObfuscatedPayloads – Scans raw HTML for obfuscation techniques used
 * to hide prompt-injection payloads from the user but expose them to the AI.
 *
 * Detects:
 *  1. Base64-encoded strings containing injection keywords
 *  2. HTML entity-encoded strings containing injection keywords
 *  3. JavaScript event handlers on hidden DOM elements
 *  4. Split payloads spread across multiple hidden elements
 *
 * @param {string} html - Raw HTML string from the page
 * @returns {Array<{type: string, raw: string, decoded: string, confidence: number}>}
 *          Array of threat objects. Each contributes to the overall confidence score.
 */
export function detectObfuscatedPayloads(html) {
    if (!html) return [];

    const threats = [];

    // ── 1. Base64 Detection ──────────────────────────────────────────────────
    // Match strings ≥ 20 chars using only base64 alphabet (=padding allowed)
    const base64Regex = /\b([A-Za-z0-9+/]{20,}={0,2})\b/g;
    let b64Match;
    while ((b64Match = base64Regex.exec(html)) !== null) {
        const candidate = b64Match[1];
        const decoded = tryDecodeBase64(candidate);
        if (decoded && containsInjectionKeyword(decoded)) {
            threats.push({
                type: 'base64',
                raw: candidate,
                decoded: decoded.substring(0, 200), // truncate for display
                confidence: 0.25
            });
        }
    }

    // ── 2. HTML Entity Encoded Strings ───────────────────────────────────────
    // Match sequences of numeric HTML entities (e.g. &#105;&#103;...)
    const entityRegex = /((?:&#\d+;|&#x[0-9a-fA-F]+;|&[a-z]+;){3,})/g;
    let entityMatch;
    while ((entityMatch = entityRegex.exec(html)) !== null) {
        const raw = entityMatch[1];
        const decoded = decodeHtmlEntities(raw);
        if (decoded && containsInjectionKeyword(decoded)) {
            threats.push({
                type: 'html_entities',
                raw: raw.substring(0, 200),
                decoded: decoded.substring(0, 200),
                confidence: 0.2
            });
        }
    }

    // ── 3. JavaScript Event Handlers on Hidden Elements ───────────────────────
    // Parse DOM and look for hidden elements that carry event handler attributes
    if (typeof DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const allEls = doc.body ? doc.body.querySelectorAll('*') : [];

            const EVENT_ATTRS = [
                'onload', 'onerror', 'onmouseover', 'onclick',
                'onfocus', 'onblur', 'onchange', 'onsubmit'
            ];

            allEls.forEach(el => {
                const style = el.getAttribute('style') || '';
                const isHidden =
                    style.includes('display:none') || style.includes('display: none') ||
                    style.includes('visibility:hidden') || style.includes('visibility: hidden') ||
                    style.includes('opacity:0') || style.includes('opacity: 0') ||
                    el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true';

                if (!isHidden) return;

                for (const attr of EVENT_ATTRS) {
                    const val = el.getAttribute(attr);
                    if (val) {
                        threats.push({
                            type: 'event_handler',
                            raw: `<${el.tagName.toLowerCase()} ${attr}="${val.substring(0, 80)}">`,
                            decoded: `Event handler '${attr}' on hidden ${el.tagName.toLowerCase()} element`,
                            confidence: 0.3
                        });
                        break; // one threat per element
                    }
                }
            });
        } catch (e) {
            console.warn('[VESSEL] DOM parse in detectObfuscatedPayloads failed', e);
        }
    }

    // ── 4. Split Payload Detection ───────────────────────────────────────────
    // Collect all hidden-element text fragments and concatenate to see if they
    // form an injection keyword together.
    if (typeof DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const hiddenEls = doc.body ? doc.body.querySelectorAll('[style]') : [];
            const fragments = [];

            hiddenEls.forEach(el => {
                const style = el.getAttribute('style') || '';
                if (
                    style.includes('display:none') || style.includes('display: none') ||
                    style.includes('visibility:hidden') || style.includes('visibility: hidden') ||
                    style.includes('opacity:0') || style.includes('opacity: 0')
                ) {
                    const txt = (el.innerText || el.textContent || '').trim();
                    if (txt) fragments.push(txt);
                }
            });

            if (fragments.length >= 2) {
                const concatenated = fragments.join('');
                if (containsInjectionKeyword(concatenated)) {
                    threats.push({
                        type: 'split_payload',
                        raw: fragments.join(' | '),
                        decoded: concatenated.substring(0, 200),
                        confidence: 0.2
                    });
                }
            }
        } catch (e) {
            console.warn('[VESSEL] Split payload detection failed', e);
        }
    }

    return threats;
}
