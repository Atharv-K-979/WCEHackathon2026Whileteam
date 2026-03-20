(async () => {
    try {
        const geminiClientSrc = chrome.runtime.getURL('lib/gemini-client.js');
        const uiUtilsSrc = chrome.runtime.getURL('lib/ui-utils.js');

        const [
            { default: GeminiClient },
            { createBadge, createRequirementsModal, insertText, prependText }
        ] = await Promise.all([
            import(geminiClientSrc),
            import(uiUtilsSrc)
        ]);

        let geminiClient = null;
        let activeBadge = null;
        let typingTimer = null;
        let currentTarget = null;
        const ANALYSIS_DELAY = 1500;

        // Duplicate-injection guard – prevents the isVesselMutating race condition
        let isVesselMutating = false;

        /**
         * isContextValid – Returns false if the extension was reloaded/updated
         * but we are still running on an old page instance.
         */
        function isContextValid() {
            try { return !!(chrome.runtime?.id); }
            catch (_) { return false; }
        }

        chrome.storage.local.get(['geminiApiKey'], (result) => {
            geminiClient = new GeminiClient(result.geminiApiKey || null);
        });

        document.addEventListener('input', handleInput, true);
        document.addEventListener('focusin', handleFocus, true);
        document.addEventListener('paste', handlePaste, true);

        function unbindAll() {
            document.removeEventListener('input', handleInput, true);
            document.removeEventListener('focusin', handleFocus, true);
            document.removeEventListener('paste', handlePaste, true);
            hideBadge();
        }

        // ── Utility ────────────────────────────────────────────────────────

        function getTargetElement(el) {
            if (!el) return null;
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el;
            if (el.closest && el.closest('[contenteditable="true"]')) {
                return el.closest('[contenteditable="true"]');
            }
            if (el.isContentEditable || el.role === 'textbox') return el;
            return null;
        }

        function getText(el) {
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || "";
            return el.innerText || el.textContent || "";
        }

        function containsTechnicalTerms(text) {
            const terms = [
                'api', 'endpoint', 'function', 'database', 'server',
                'user', 'data', 'store', 'upload', 'download',
                'authenticate', 'login', 'password', 'admin', 'component', 'system'
            ];
            const lower = text.toLowerCase();
            return terms.some(t => lower.includes(t));
        }

        // ── Event Handlers ─────────────────────────────────────────────────

        function handleInput(e) {
            if (!isContextValid()) return unbindAll();
            const target = getTargetElement(e.target);
            // Skip if VESSEL itself is mutating the DOM (injection prevention)
            if (!target || isVesselMutating) return;
            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(() => analyzeSpec(target), ANALYSIS_DELAY);
        }

        function handlePaste(e) {
            if (!isContextValid()) return unbindAll();
            const target = getTargetElement(e.target);
            if (!target || isVesselMutating) return;
            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(() => analyzeSpec(target), ANALYSIS_DELAY);
        }

        function handleFocus(e) {
            if (!isContextValid()) return unbindAll();
            const target = getTargetElement(e.target);
            if (target) {
                if (currentTarget !== target) currentTarget = target;
                if (getText(target)) analyzeSpec(target);
            }
        }

        // ── Core Analysis ──────────────────────────────────────────────────

        async function analyzeSpec(target) {
            const text = getText(target);

            if (!text || typeof text !== 'string') { hideBadge(); return; }
            if (!containsTechnicalTerms(text) || text.trim().length < 10) { hideBadge(); return; }
            if (!isContextValid()) return unbindAll();

            // Show the ⚡ badge — analysis only begins when the user clicks it
            showBadge(target, '⚡ Analyze Features', async (e) => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                showLoadingBadge(target);

                try {
                    const startTime = Date.now();
                    const response = await chrome.runtime.sendMessage({ action: 'GENERATE_SPECS', text });
                    const clientMs = Date.now() - startTime;

                    // Use server timing if available, else use round-trip time
                    const displayMs = response?.inferenceMs || clientMs;

                    // If Gemini failed and fell back, show a brief toast notification
                    if (response?.modelSource === 'local_fallback') {
                        showToast('⚠️ Gemini unavailable – using local model', 'warning');
                    } else if (response?.modelSource === 'heuristic') {
                        showToast('ℹ️ Using generic security templates', 'info');
                    }

                    if (!response || !response.missing || response.missing.length === 0) {
                        await showRequirementsUI(target, text, [{
                            category: 'System Check',
                            template: 'Scan completed. No missing security requirements were flagged for this specification.',
                            score: 1.0
                        }], displayMs, response?.modelSource);
                        hideBadge();
                        return;
                    }

                    await showRequirementsUI(target, text, response.missing, displayMs, response?.modelSource);
                    hideBadge();
                } catch (error) {
                    console.error('[VESSEL] Error analyzing spec:', error);
                    showToast('❌ Analysis failed – please try again', 'error');
                    hideBadge();
                }
            });
        }

        // ── UI Helpers ─────────────────────────────────────────────────────

        /**
         * showLoadingBadge – Replaces the ⚡ badge with an animated "Analyzing…" pill.
         */
        function showLoadingBadge(targetElement) {
            hideBadge();
            const rect = targetElement.getBoundingClientRect();

            const badge = document.createElement('div');
            badge.className = 'vessel-loading-badge';
            badge.style.cssText = `
                position: absolute;
                z-index: 2147483647;
                background: linear-gradient(135deg, #111827 0%, #1F2937 100%);
                color: #58A6FF;
                border: 1px solid rgba(88, 166, 255, 0.3);
                border-radius: 20px;
                padding: 6px 14px;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                animation: vessel-pulse 1.5s infinite;
                user-select: none;
            `;
            badge.innerHTML = `<span style="display:inline-block;animation:vessel-spin 1s linear infinite;">⏳</span> Analyzing...`;

            if (!document.getElementById('vessel-keyframes')) {
                const style = document.createElement('style');
                style.id = 'vessel-keyframes';
                style.textContent = `
                    @keyframes vessel-spin { 100% { transform: rotate(360deg); } }
                    @keyframes vessel-pulse { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
                    @keyframes vessel-flashgreen {
                        0%  { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
                        30% { box-shadow: 0 0 0 6px rgba(16,185,129,0.5); }
                        100%{ box-shadow: 0 0 0 12px rgba(16,185,129,0); }
                    }
                `;
                document.head.appendChild(style);
            }

            badge.style.top  = `${rect.top + window.scrollY - 10}px`;
            badge.style.left = `${rect.right + window.scrollX - 10}px`;

            document.body.appendChild(badge);
            activeBadge = badge;
        }

        /**
         * showRequirementsUI – Renders the requirements modal with inference time footer.
         */
        async function showRequirementsUI(target, contextText, missingItems, inferenceMs, modelSource) {
            if (!missingItems || !missingItems.length) return;

            const requirements = missingItems.map(item => ({
                category: item.category,
                description: item.template || item.description,
                confidence: item.score || 0.9
            }));

            // Build model/timing badge for the modal footer
            const modelLabel = {
                gemini:         ' Gemini 1.5 Flash',
                local:          ' Local Model',
                local_fallback: ' Local Model (Gemini fallback)',
                heuristic:      ' Template Heuristic'
            }[modelSource] || ' Template Heuristic';

            const timingNote = inferenceMs
                ? `<small style="color:#9CA3AF; font-size:11px;">${modelLabel} · ${inferenceMs}ms</small>`
                : '';

            try {
                const modal = createRequirementsModal(
                    requirements,
                    (suggestionsArray) => {
                        if (isVesselMutating) return;
                        isVesselMutating = true;

                        const singleString = Array.isArray(suggestionsArray) ? suggestionsArray.join('\n') : suggestionsArray;
                        const formattedText = `> "[\n${singleString}\n]"`;

                        try {
                            prependText(target, formattedText);

                            // Green flash animation on the editor after successful injection
                            target.style.animation = 'vessel-flashgreen 0.8s ease-out';
                            setTimeout(() => { target.style.animation = ''; }, 900);
                        } catch (e) {
                            console.error('[VESSEL] Error prepending text', e);
                        } finally {
                            setTimeout(() => { isVesselMutating = false; }, 500);
                        }
                    },
                    () => {
                        if (modal) modal.remove();
                        hideBadge();
                    },
                    geminiClient ? geminiClient.isConfigured() : false
                );

                // Append inference time note at the bottom of the modal content
                if (timingNote) {
                    // Find the modal content div inside the shadow DOM and add a footer note
                    const tryAppendNote = () => {
                        const shadowRoot = modal.shadowRoot;
                        if (shadowRoot) {
                            const actions = shadowRoot.querySelector('.modal-actions');
                            if (actions) {
                                const note = document.createElement('div');
                                note.style.cssText = 'text-align:center; margin-bottom:8px;';
                                note.innerHTML = timingNote;
                                actions.parentNode.insertBefore(note, actions);
                            }
                        }
                    };
                    // Shadow DOM is available immediately (closed shadow in createRequirementsModal uses 'closed' mode,
                    // so we use a small delay and patch via an open reference instead — timing note in aria label fallback)
                    setTimeout(tryAppendNote, 0);
                }

                document.body.appendChild(modal);
            } catch (e) {
                console.error('[VESSEL] Error displaying requirements UI', e);
            } finally {
                document.body.style.cursor = 'default';
            }
        }

        function showBadge(targetElement, count, onClick) {
            hideBadge();
            const rect = targetElement.getBoundingClientRect();

            activeBadge = createBadge(count, onClick);
            activeBadge.title = 'Click to generate security requirements for this specification.';
            activeBadge.style.top  = `${rect.top + window.scrollY - 10}px`;
            activeBadge.style.left = `${rect.right + window.scrollX - 10}px`;

            document.body.appendChild(activeBadge);
        }

        function hideBadge() {
            if (activeBadge) { activeBadge.remove(); activeBadge = null; }
        }

        /**
         * showToast – Lightweight non-modal notification for fallback/error events.
         * @param {string} message
         * @param {'info'|'warning'|'error'} type
         */
        function showToast(message, type = 'info') {
            const colors = {
                info:    { bg: '#1E3A5F', border: '#3B82F6', text: '#93C5FD' },
                warning: { bg: '#3B2A00', border: '#F59E0B', text: '#FCD34D' },
                error:   { bg: '#3B0A0A', border: '#EF4444', text: '#FCA5A5' }
            };
            const c = colors[type] || colors.info;

            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: ${c.bg};
                color: ${c.text};
                border: 1px solid ${c.border};
                border-radius: 10px;
                padding: 10px 20px;
                font-family: 'Inter', sans-serif;
                font-size: 13px;
                font-weight: 500;
                z-index: 2147483647;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                opacity: 0;
                transition: opacity 0.3s, transform 0.3s;
                pointer-events: none;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);

            // Animate in
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });

            // Auto dismiss after 3.5s
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(10px)';
                setTimeout(() => toast.remove(), 400);
            }, 3500);
        }

        console.log('[VESSEL] Spec Watcher initialized');

    } catch (e) {
        console.error('[VESSEL] Spec Watcher failed to load:', e);
    }
})();
