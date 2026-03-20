
/**
 * patterns.js – VESSEL Sensitive Data Pattern Definitions
 *
 * Each pattern object contains:
 *   name     {string}   – Human-readable label shown in the redaction modal
 *   regex    {RegExp}   – Global regex to find all occurrences in pasted text
 *   validate {Function} – Optional extra check on the raw match string (e.g. Luhn)
 *   priority {number}   – Higher = wins over overlapping lower-priority patterns
 *   redactStyle {string} – How to redact: 'default' | 'creditcard' | 'aadhaar'
 *                          | 'email' | 'phone' | 'upi'
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function luhnCheck(value) {
    const digits = value.replace(/\D/g, '');
    if (!digits) return false;
    let sum = 0, shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits.charAt(i));
        if (shouldDouble) { digit *= 2; if (digit > 9) digit -= 9; }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
}

// ─── Pattern Definitions ──────────────────────────────────────────────────────

export const patterns = [

    // ── International / Generic ──────────────────────────────────────────────
    {
        name: 'Credit Card Number',
        priority: 100,
        redactStyle: 'creditcard',
        regex: /\b(?:\d[ -]*?){13,19}\b/g,
        validate: (match) => {
            const digits = match.replace(/\D/g, '');
            if (digits.length < 13 || digits.length > 19) return false;
            return luhnCheck(digits);
        }
    },
    {
        name: 'AWS Access Key',
        priority: 90,
        redactStyle: 'default',
        regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g
    },
    {
        name: 'Private Key Header',
        priority: 90,
        redactStyle: 'default',
        regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g
    },
    {
        name: 'Email Address',
        priority: 85,
        redactStyle: 'email',
        regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
    },
    {
        name: 'Phone Number',
        priority: 50,
        redactStyle: 'phone',
        regex: /\b(?:\+?[1-9]\d{0,2}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
    },
    {
        name: 'Social Security Number (US)',
        priority: 85,
        redactStyle: 'default',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g
    },
    {
        name: 'Generic Credential / Password',
        priority: 80,
        redactStyle: 'default',
        regex: /(password|passwd|pwd|api[-_]?key|secret|token|credentials)[\s]*[:=][\s]*["']?([^\s"']{8,})["']?/ig
    },
    {
        name: 'IP Address (IPv4)',
        priority: 40,
        redactStyle: 'default',
        regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
    },

    // ── Indian PII ───────────────────────────────────────────────────────────
    {
        name: 'Aadhaar Number (India)',
        priority: 85,
        redactStyle: 'aadhaar',
        regex: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
        validate: (match) => {
            const digits = match.replace(/\D/g, '');
            return digits.length === 12;
        }
    },
    {
        name: 'PAN Card (India)',
        priority: 85,
        redactStyle: 'default',
        regex: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g
    },
    {
        name: 'Indian Passport',
        priority: 80,
        redactStyle: 'default',
        // Format: one uppercase letter followed by exactly 7 digits
        regex: /\b[A-Z][0-9]{7}\b/g
    },
    {
        name: 'UPI ID',
        priority: 75,
        redactStyle: 'upi',
        // UPI IDs follow the pattern: identifier@handle (e.g. user@okhdfcbank)
        regex: /\b[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}\b/g,
        validate: (match) => {
            // Must have @, and handle part should be a known UPI suffix or generic word
            // This avoids collision with plain email addresses already caught above
            const parts = match.split('@');
            if (parts.length !== 2) return false;
            // Reject if TLD suggests it's a regular email (e.g. .com, .in, .org)
            const handle = parts[1];
            const emailTlds = ['com', 'in', 'org', 'net', 'io', 'co', 'edu', 'gov'];
            return !emailTlds.includes(handle.toLowerCase());
        }
    },
    {
        name: 'UPI Handle',
        priority: 65,
        redactStyle: 'default',
        // Matches known UPI bank handles when pasted without an identifier (e.g. "@okaxis")
        regex: /@(okaxis|okhdfcbank|oksbi|okicici|okbiz|ybl|ibl|axl|paytm|upi|apl|yapl|abfspay)\b/gi
    },
    {
        name: 'Bank Account Number (India)',
        priority: 45,
        redactStyle: 'default',
        // Indian bank accounts are 9–18 digits. Kept simple; context is king.
        regex: /\b[0-9]{9,18}\b/g
    },
    {
        name: 'Voter ID / EPIC (India)',
        priority: 80,
        redactStyle: 'default',
        // Format: 3 uppercase letters + 7 digits (e.g. ABC1234567)
        regex: /\b[A-Z]{3}[0-9]{7}\b/g
    },
    {
        name: 'Driving Licence (India)',
        priority: 78,
        redactStyle: 'default',
        // Format: state code (2 letters) + RTO code (2 digits) + year (4 digits) + serial (7 digits)
        // Simplified: 2 uppercase + 2 digits + 11 digits = 15 chars total
        regex: /\b[A-Z]{2}[0-9]{2}[0-9]{11}\b/g
    }

];

/**
 * redact – Legacy helper kept for backwards compatibility with patterns.js importers.
 * Replaces all alphanumeric chars with 'X', preserving separators.
 *
 * @param {string} text   - Original text
 * @param {Array}  matches - Array of match objects {index, 0: matchString}
 * @returns {string}
 */
export function redact(text, matches) {
    if (!matches || matches.length === 0) return text;
    let mask = new Array(text.length).fill(false);
    for (const match of matches) {
        const start = match.index;
        const end = start + match[0].length;
        for (let i = start; i < end; i++) mask[i] = true;
    }
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += mask[i] && /[\d\w]/.test(text[i]) ? 'X' : text[i];
    }
    return result;
}

/**
 * resolveOverlaps – When two matches cover overlapping character ranges,
 * keep only the one with the higher priority (larger priority number wins).
 *
 * @param {Array} matches - Raw matches with {index, length, priority, ...}
 * @returns {Array} - Non-overlapping subset, sorted by position
 */
export function resolveOverlaps(matches) {
    const sorted = [...matches].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const kept = [];

    for (const match of sorted) {
        const start = match.index;
        const end   = start + match.length;
        const overlaps = kept.some(k => start < k.index + k.length && end > k.index);
        if (!overlaps) kept.push(match);
    }

    return kept.sort((a, b) => a.index - b.index);
}
