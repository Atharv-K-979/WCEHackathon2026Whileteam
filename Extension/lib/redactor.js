/**
 * redactor.js – VESSEL Format-Preserving Redaction Engine
 *
 * Each sensitive match is replaced using a style-aware strategy that
 * preserves separators (dashes, dots, @, spaces) while masking
 * all alphanumeric characters with 'X'.
 *
 * Redact styles (set via pattern.redactStyle):
 *   'creditcard'  – keeps hyphens/spaces, replaces digits: 4111-1111-1111-1111 → XXXX-XXXX-XXXX-XXXX
 *   'aadhaar'     – keeps hyphens/spaces, replaces digits: 1234-5678-9012 → XXXX-XXXX-XXXX
 *   'email'       – keeps @ and last dot-group, masks local + domain: john.doe@example.com → XXXXXXXXX@XXXXXXX.XXX
 *   'phone'       – keeps leading + and separators, masks digits: +91-98765-43210 → +XX-XXXXX-XXXXX
 *   'upi'         – keeps @, masks both sides: user@okhdfcbank → XXXX@XXXXXXXXX
 *   'default'     – replaces all alphanumeric with X, preserves other chars
 */

// ─── Style-specific redaction functions ───────────────────────────────────────

/**
 * Masks all alphanumeric characters, preserving punctuation/separators.
 * Default strategy used for most patterns.
 */
function redactDefault(text) {
    return text.replace(/[a-zA-Z0-9]/g, 'X');
}

/**
 * Credit card: keeps dashes and spaces, replaces only digits.
 * "4111-1111-1111-1111" → "XXXX-XXXX-XXXX-XXXX"
 */
function redactCreditCard(text) {
    return text.replace(/\d/g, 'X');
}

/**
 * Aadhaar: same as credit card format (space/hyphen separated digit groups).
 * "1234 5678 9012" → "XXXX XXXX XXXX"
 */
function redactAadhaar(text) {
    return text.replace(/\d/g, 'X');
}

/**
 * Email: replaces local and domain parts with same-length X strings,
 * but preserves the '@' and dots within the domain.
 * "john.doe@example.com" → "XXXXXXXXX@XXXXXXX.XXX"
 */
function redactEmail(text) {
    const atIdx = text.lastIndexOf('@');
    if (atIdx === -1) return redactDefault(text);

    const local  = text.substring(0, atIdx);
    const domain = text.substring(atIdx + 1); // "example.com"

    const maskedLocal  = local.replace(/[a-zA-Z0-9]/g, 'X');

    // In domain, replace alnum chars but keep dots
    const maskedDomain = domain.replace(/[a-zA-Z0-9]/g, 'X');

    return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Phone: keeps the leading '+' and separators (-. ), replaces digits.
 * "+91-98765-43210" → "+XX-XXXXX-XXXXX"
 */
function redactPhone(text) {
    let result = '';
    for (const ch of text) {
        if (/\d/.test(ch)) result += 'X';
        else result += ch; // keep +, -, ., space
    }
    return result;
}

/**
 * UPI ID: masks both the handle (left of @) and the VPA (right of @).
 * "user@okhdfcbank" → "XXXX@XXXXXXXXX"
 */
function redactUPI(text) {
    const atIdx = text.indexOf('@');
    if (atIdx === -1) return redactDefault(text);
    const local  = text.substring(0, atIdx).replace(/[a-zA-Z0-9._-]/g, 'X');
    const handle = text.substring(atIdx + 1).replace(/[a-zA-Z0-9]/g, 'X');
    return `${local}@${handle}`;
}

import { resolveOverlaps } from './patterns.js';

/**
 * redactText – Applies format-preserving redaction to all sensitive matches
 * found in the given text string.
 *
 * @param {string} text    - Original pasted text
 * @param {Array}  matches - Match objects produced by content-paste-redactor.js
 *                           Each match must have: {index, length, value, redactStyle, priority}
 * @returns {string} - Redacted text
 */
export function redactText(text, matches) {
    if (!matches || matches.length === 0) return text;

    // Normalise match objects (handle both {index,length} and {index,[0]})
    const normalised = matches.map(m => ({
        ...m,
        length:      m.length  !== undefined ? m.length : (m[0] ? m[0].length : (m.value || '').length),
        redactStyle: m.patternObj?.redactStyle || m.redactStyle || 'default',
        priority:    m.patternObj?.priority    || m.priority    || 0
    }));

    const resolved = resolveOverlaps(normalised);

    // Rebuild the string piece-by-piece
    let result = '';
    let cursor = 0;

    for (const match of resolved) {
        // Copy unmodified text before this match
        result += text.substring(cursor, match.index);

        // Extract the exact matched substring
        const raw = text.substring(match.index, match.index + match.length);

        // Apply the correct redaction strategy
        switch (match.redactStyle) {
            case 'creditcard': result += redactCreditCard(raw); break;
            case 'aadhaar':    result += redactAadhaar(raw);    break;
            case 'email':      result += redactEmail(raw);      break;
            case 'phone':      result += redactPhone(raw);      break;
            case 'upi':        result += redactUPI(raw);        break;
            default:           result += redactDefault(raw);    break;
        }

        cursor = match.index + match.length;
    }

    // Append any remaining text after the last match
    result += text.substring(cursor);
    return result;
}
