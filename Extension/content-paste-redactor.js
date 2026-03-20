(function () {
    document.addEventListener('paste', handlePaste, true);

    let patternsModule = null;
    let uiModule = null;
    let modulesLoading = null;

    function isContextValid() {
        try { return !!(chrome.runtime?.id); }
        catch (_) { return false; }
    }

    /**
     * loadModules – Starts loading the background libraries.
     * Returns a promise so we can await it if needed.
     */
    function loadModules() {
        if (patternsModule && uiModule) return Promise.resolve();
        if (modulesLoading) return modulesLoading;

        const patternsSrc = chrome.runtime.getURL('lib/patterns.js');
        const uiSrc       = chrome.runtime.getURL('lib/ui-utils.js');
        
        modulesLoading = Promise.all([
            import(patternsSrc),
            import(uiSrc)
        ]).then(([p, u]) => {
            patternsModule = p;
            uiModule = u;
            return true;
        }).catch(err => {
            console.error('[VESSEL] Failed to load redactor modules:', err);
            patternsModule = null;
            uiModule = null;
            throw err;
        });

        return modulesLoading;
    }

    // Pre-load the modules asynchronously immediately so paste is instant
    if (isContextValid()) {
        loadModules().catch(() => {});
    }

    async function handlePaste(event) {
        if (!isContextValid()) {
            document.removeEventListener('paste', handlePaste, true);
            return; 
        }

        const clipboardData = event.clipboardData || window.clipboardData;
        if (!clipboardData) return;
        const pastedText = clipboardData.getData('text/plain');
        if (!pastedText) return;

        const selection = window.getSelection();
        let savedRange = null;
        if (selection && selection.rangeCount > 0) {
            savedRange = selection.getRangeAt(0).cloneRange();
        }

        // Synchronously intercept the paste event immediately so the browser
        // doesn't insert the text native while we load/scan.
        event.preventDefault();
        event.stopImmediatePropagation();

        const field = event.target;

        try {
            // Ensure modules are ready (instantly resolves if pre-loaded)
            await loadModules();

            let matches = scanForSensitiveData(pastedText);

            // Filter overlaps BEFORE presenting counts to user
            if (patternsModule && typeof patternsModule.resolveOverlaps === 'function') {
                matches = patternsModule.resolveOverlaps(matches);
            }

            // If clean, manually insert the original text
            if (!matches || matches.length === 0) {
                insertTextSync(field, pastedText, savedRange);
                return;
            }

            // Sensitive data detected
            const detectedTypes = [...new Set(matches.map(m => m.name))];
            console.log(`[VESSEL] Sensitive data detected: ${detectedTypes.join(', ')}`);

            try {
                if (isContextValid()) {
                    chrome.runtime.sendMessage({
                        action: 'logIncident',
                        data: {
                            type: 'sensitive_paste',
                            details: `Blocked pasting: ${detectedTypes.join(', ')}`,
                            score: 0.8,
                            timestamp: Date.now()
                        }
                    }).catch(() => {});
                }
            } catch (_) { }

            try {
                uiModule.showRedactionModal(field, pastedText, matches, savedRange);
            } catch (modalErr) {
                console.error('[VESSEL] Modal display failed, fallback inserting original text:', modalErr);
                insertTextSync(field, pastedText, savedRange);
            }

        } catch (err) {
            // If module loading failed or scan crashed, fallback to just pasting it
            console.warn('[VESSEL] Redactor error, allowing native-like paste:', err);
            insertTextSync(field, pastedText, savedRange);
        }
    }

    function insertTextSync(field, text, savedRange) {
        if (!field) return;
        field.focus();
        if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
            const start = field.selectionStart || 0;
            const end = field.selectionEnd || 0;
            const val = field.value || "";
            field.value = val.substring(0, start) + text + val.substring(end);
            field.selectionStart = field.selectionEnd = start + text.length;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (field.isContentEditable) {
            if (savedRange) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedRange);
            }
            if (!document.execCommand('insertText', false, text)) {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(text));
                    range.collapse(false);
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    field.innerText += text;
                }
            }
        }
    }

    function scanForSensitiveData(text) {
        if (!patternsModule?.patterns) return [];

        const allMatches = [];
        patternsModule.patterns.forEach(pattern => {
            pattern.regex.lastIndex = 0;
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                if (pattern.validate && !pattern.validate(match[0])) continue;
                allMatches.push({
                    name:        pattern.name,
                    type:        pattern.name,
                    value:       match[0],
                    0:           match[0],
                    index:       match.index,
                    length:      match[0].length,
                    redactStyle: pattern.redactStyle || 'default',
                    priority:    pattern.priority    || 0,
                    patternObj:  pattern
                });
            }
        });
        return allMatches;
    }
})();
