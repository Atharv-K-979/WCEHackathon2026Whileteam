const DEFAULT_POLICY = {
    riskThreshold: 0.8,
    blockedSelectors: [
        'button[aria-label="Send message"]',
        'button[data-testid="send-button"]'
    ],
    customRequirements: [],
    forceBlock: false
};

class PolicyManager {
    constructor() {
        this.currentPolicy = { ...DEFAULT_POLICY };
    }
    async loadPolicy() {
        try {
            const managed = await new Promise(resolve =>
                chrome.storage.managed ? chrome.storage.managed.get(null, resolve) : resolve({})
            ).catch(() => ({})); 
            const local = await new Promise(resolve =>
                chrome.storage.local.get(null, resolve)
            );

            this.currentPolicy = {
                ...DEFAULT_POLICY,
                ...local,
                ...managed
            };

            if (managed.blockedSelectors) this.currentPolicy.blockedSelectors = managed.blockedSelectors;
            else if (local.blockedSelectors) this.currentPolicy.blockedSelectors = local.blockedSelectors;

            console.log('[VESSEL] Policy Loaded:', this.currentPolicy);

            await chrome.storage.local.set({ effectivePolicy: this.currentPolicy });

        } catch (err) {
            console.error('[VESSEL] Failed to load policy:', err);
        }

        return this.currentPolicy;
    }

    get() {
        return this.currentPolicy;
    }
}

export const policyManager = new PolicyManager();
