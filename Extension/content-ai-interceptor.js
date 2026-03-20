
(async () => {
    try {
        const uiSrc = chrome.runtime.getURL('lib/ui-utils.js');
        const sanitizerSrc = chrome.runtime.getURL('lib/sanitizer.js');
        
        const [
            { createModal, escapeHtml, showThreatModal, insertText },
            { detectObfuscatedPayloads, sanitizeDOM }
        ] = await Promise.all([
            import(uiSrc),
            import(sanitizerSrc)
        ]);

        const AI_BUTTON_SELECTORS = [
            '[data-testid="comet-summarize"]',
            '.perplexity-comet-trigger',
            '.ai-summarize-btn',
            '[aria-label*="Summarize"]',
            '[title*="Summarize"]',
            '#ai-assistant',
            '[data-test-id="send-button"]', // Gemini submit
            'button[aria-label="Send message"]', // ChatGPT submit
            '.notion-ai-button' // Notion AI
        ];

        let modalInstance = null;
        let isBypassing = false;

        /**
         * isContextValid – Returns false if the extension was reloaded/updated
         * but we are still running on an old page instance.
         */
        function isContextValid() {
            try { return !!(chrome.runtime?.id); }
            catch (_) { return false; }
        }

        document.addEventListener('click', handleUserAction, true);
        document.addEventListener('keydown', handleUserAction, true);

        function handleUserAction(event) {
            // Guard: If extension context is gone, unbind and let events pass natively
            if (!isContextValid()) {
                document.removeEventListener('click', handleUserAction, true);
                document.removeEventListener('keydown', handleUserAction, true);
                return;
            }

            if (isBypassing) return;

            const target = event.target;

            let isAIAction = false;
            let inputElement = null;

            if (event.type === 'click') {
                isAIAction = AI_BUTTON_SELECTORS.some(sel => {
                    try { return target.matches(sel) || target.closest(sel); }
                    catch (e) { return false; } // in case of :has() unsupported
                });
                
                // Fallback: If it's a generic button with AI/Summarize text, treat as AI action
                if (!isAIAction && (target.tagName === 'BUTTON' || target.closest('button'))) {
                    const btnText = (target.textContent || '').toLowerCase();
                    if (btnText.includes('test ai') || btnText.includes('summarize')) {
                        isAIAction = true;
                    }
                }
                
                if (isAIAction) inputElement = document.querySelector('textarea, [contenteditable="true"]');
            } else if (event.type === 'keydown' && event.key === 'Enter' && !event.shiftKey) {
                if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    isAIAction = true;
                    inputElement = target;
                }
            }

            if (isAIAction) {
                // Must stop events immediately to block the AI site's native submission
                event.stopImmediatePropagation();
                event.preventDefault();

                console.log('[VESSEL] Intercepted AI action.');

                const isChatAction = event.type === 'keydown';
                const pageContext = capturePageContext(inputElement, !isChatAction);

                // Extract threats directly in the content script where DOMParser is available
                const threats = detectObfuscatedPayloads(pageContext.html);
                // Also sanitize HTML here to cleanly send plain text to the background worker
                const sanitizedHtmlText = sanitizeDOM(pageContext.html);
                const combinedText = `${pageContext.text}\n${sanitizedHtmlText}`;

                try {
                    chrome.runtime.sendMessage({
                        action: 'analyzePrompt',
                        text: combinedText,
                        threats: threats
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('[VESSEL] Analysis failed or connection lost', chrome.runtime.lastError);
                            bypassAndExecute(event, target);
                            return;
                        }

                        if (response && response.score > 0.7) {
                            try {
                                showRiskModal(response, event, target, pageContext.text);
                            } catch (e) {
                                console.error('[VESSEL] UI Modal failed to render.', e);
                                bypassAndExecute(event, target);
                            }
                        } else {
                            bypassAndExecute(event, target);
                        }
                    });
                } catch (sendErr) {
                    console.error('[VESSEL] sendMessage failed. Context invalid?', sendErr);
                    bypassAndExecute(event, target);
                }
            }
        }

        function capturePageContext(inputElement, includeHtml = true) {
            let contextText = "";

            // Extract text from the active input
            if (inputElement) {
                contextText += (inputElement.value || inputElement.innerText || "") + "\n\n";
            }

            if (includeHtml) {
                // aggressive scan for hidden elements
                const hiddenElements = document.querySelectorAll('[style*="display: none"], [style*="display:none"], [style*="opacity: 0"], [style*="opacity:0"], [aria-hidden="true"]');
                hiddenElements.forEach(el => {
                    if (el.innerText && el.innerText.trim().length > 0) {
                        contextText += `[Hidden Payload]: ${el.innerText}\n`;
                    }
                });
            }

            return {
                text: contextText.trim(),
                html: includeHtml ? document.body.innerHTML : "" // Send full HTML only if requested
            };
        }

        function showRiskModal(analysis, originalEvent, originalTarget, originalText) {
            if (modalInstance) modalInstance.hide();

            modalInstance = showThreatModal(
                analysis.score,
                originalText,
                analysis.sanitized,
                analysis.threats || [],       // ← new: pass obfuscated threat details
                () => { // Proceed
                    modalInstance = null;
                    bypassAndExecute(originalEvent, originalTarget);
                },
                () => { // Send Sanitized
                    modalInstance = null;
                    let inputField = originalTarget.closest('form')?.querySelector('textarea, [contenteditable="true"], input[type="text"]');
                    if (!inputField) {
                        inputField = document.querySelector('textarea, [contenteditable="true"], input[type="text"]');
                    }

                    if (inputField) {
                        if (inputField.tagName === 'INPUT' || inputField.tagName === 'TEXTAREA') {
                            inputField.value = '';
                        } else if (inputField.isContentEditable) {
                            inputField.innerHTML = '';
                        }
                        insertText(inputField, analysis.sanitized);
                    } else {
                        console.warn("[VESSEL] No input field found to inject sanitized text.");
                    }
                    bypassAndExecute(originalEvent, originalTarget);
                },
                () => { // Cancel
                    modalInstance = null;
                }
            );
        }

        function bypassAndExecute(event, target) {
            isBypassing = true;

            if (event.type === 'click') {
                target.click();
            } else if (event.type === 'keydown') {
                // Simulate enter key again
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                target.dispatchEvent(enterEvent);
            }

            setTimeout(() => {
                isBypassing = false;
            }, 100);
        }

    } catch (e) {
        console.error('[VESSEL] content-ai-interceptor error:', e);
    }
})();
