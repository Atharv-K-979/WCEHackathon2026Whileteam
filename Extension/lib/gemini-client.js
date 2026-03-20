/**
 * gemini-client.js – VESSEL Gemini API Client
 *
 * Handles all communication with the Gemini 1.5 Flash REST API.
 * Used by background.js for spec analysis when the user provides an API key.
 */
class GeminiClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * generateRequirements – Sends the spec text to Gemini 1.5 Flash and returns
     * a parsed array of requirement strings.
     *
     * Throws on network/API errors so caller can implement fallback logic.
     *
     * @param {string} specText - The user's specification text
     * @returns {Promise<string[]>} - Array of requirement strings
     */
    async generateRequirements(specText) {
        if (!this.apiKey) {
            throw new Error('Gemini API key not set');
        }

        const prompt = this.buildPrompt(specText);

        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 500
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }

        if (!data.candidates?.[0]?.content) {
            throw new Error('Invalid Gemini API response format');
        }

        const outputText = data.candidates[0].content.parts[0].text;
        return this.parseBulletPoints(outputText);
    }

    /**
     * buildPrompt – Constructs the domain-specific security analysis prompt.
     * @param {string} context - Spec text from the user
     * @returns {string}
     */
    buildPrompt(context) {
        return `You are a Senior Cloud Security Architect. A developer is planning a new feature. Here is their exact architectural plan: '${context}'.
Analyze THIS SPECIFIC PLAN. Identify the specific vulnerabilities in their text, and provide 3 to 5 highly specific, actionable security requirements to fix them. Do not give generic advice. Focus ONLY on the technologies they mentioned.
CRITICAL OUTPUT INSTRUCTION: You MUST output YOUR response as a simple bulleted list where each line starts with a hyphen (-). Do not output any introductory or concluding text, numbered lists, or paragraphs.`;
    }

    /**
     * parseBulletPoints – Extracts individual requirement lines from the Gemini response.
     * Handles -, *, and numbered list formats.
     * @param {string} text
     * @returns {string[]}
     */
    parseBulletPoints(text) {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 5)
            .map(line => line.replace(/^([-\*]|\d+\.)\s*/, '').trim())
            .filter(line => !line.toLowerCase().includes('here are the'))
            .filter(line => !line.toLowerCase().includes('specific vulnerabilities:'));
    }

    /**
     * getDefaultRequirements – Hard-coded fallback when Gemini is unavailable.
     * @returns {string[]}
     */
    getDefaultRequirements() {
        return [
            'The system must enforce authentication for all sensitive operations.',
            'Access control lists must be checked to ensure users can only access their own data.',
            'All sensitive data must be encrypted at rest and in transit.',
            'All user inputs must be validated against strict allowlists.',
            'All security-critical events must be logged with user ID, timestamp, and source IP.',
            'API endpoints must implement rate limiting to prevent abuse.'
        ];
    }
}

export default GeminiClient;
