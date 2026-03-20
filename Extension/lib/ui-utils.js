
export function createStatsBadge(blocksToday, avgRiskScore) {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .stats-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      padding: 20px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      min-width: 280px;
      z-index: 10000;
    }
    .stats-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .stats-title {
      font-size: 18px;
      font-weight: 600;
      opacity: 0.9;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .stat-item {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 12px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .incidents-section {
      margin-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 16px;
    }
    .incidents-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      opacity: 0.9;
    }
    .incident-item {
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .incident-site {
      font-weight: 600;
      margin-bottom: 4px;
    }
    .incident-details {
      display: flex;
      justify-content: space-between;
      opacity: 0.8;
    }
    .incident-risk {
      color: #ff6b6b;
      font-weight: 600;
    }
  `;

  const html = `
    <div class="stats-container">
      <div class="stats-header">
        <span class="stats-title">Human Error Firewall</span>
        <span>🛡️</span>
      </div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${blocksToday}</div>
          <div class="stat-label">Blocks Today</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${avgRiskScore}</div>
          <div class="stat-label">Avg Risk Score</div>
        </div>
      </div>
      <div class="incidents-section">
        <div class="incidents-title">RECENT INCIDENTS</div>
        <div id="incidents-list"></div>
      </div>
    </div>
  `;

  shadow.appendChild(style);

  const template = document.createElement('div');
  template.innerHTML = html;
  shadow.appendChild(template);

  return container;
}

export function prependText(field, text) {
  if (!field) return;
  field.focus();

  const textToPrepend = text + "\n\n";

  if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
    const val = field.value || "";
    field.value = textToPrepend + val;
    field.selectionStart = field.selectionEnd = textToPrepend.length;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (field.isContentEditable) {
    const selection = window.getSelection();
    let range;
    if (selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(field);
    }

    range.selectNodeContents(field);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    if (!document.execCommand('insertText', false, textToPrepend)) {
      const textNode = document.createTextNode(textToPrepend);
      field.insertBefore(textNode, field.firstChild);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

export function createRequirementsModal(requirements, onInject, onClose, isConfigured = true) {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      --req-bg:        #ffffff;
      --req-surface:   #f8f9fa;
      --req-text:      #1a1a2e;
      --req-text-dim:  #4a5568;
      --req-border:    #e2e8f0;
      --req-accent:    #0a5c36;
      --req-shadow:    0 24px 64px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1);
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --req-bg:       #1e1e2e;
        --req-surface:  #2a2a3e;
        --req-text:     #e2e8f0;
        --req-text-dim: #94a3b8;
        --req-border:   rgba(255,255,255,0.1);
        --req-shadow:   0 24px 64px rgba(0,0,0,0.6);
      }
    }
    @keyframes req-modal-in {
      from { opacity: 0; transform: scale(0.95) translateY(12px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes req-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.52);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex; justify-content: center; align-items: center;
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: req-overlay-in 0.2s ease;
    }
    .modal-content {
      background: var(--req-bg);
      color: var(--req-text);
      border-radius: 20px;
      width: 90%; max-width: 600px; max-height: 80vh;
      overflow-y: auto;
      padding: 28px;
      box-shadow: var(--req-shadow);
      border: 1px solid var(--req-border);
      animation: req-modal-in 0.27s cubic-bezier(0.34,1.4,0.64,1);
    }
    .modal-title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 20px;
      color: var(--req-text);
    }
    .requirement-card {
      background: var(--req-surface);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 14px;
      border-left: 4px solid;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .requirement-card:hover {
      transform: translateX(2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .requirement-card.missing-auth { border-left-color: #f56565; }
    .requirement-card.missing-authz { border-left-color: #ed8936; }
    .requirement-card.missing-encryption { border-left-color: #48bb78; }
    .requirement-card.missing-validation { border-left-color: #4299e1; }
    .requirement-card.missing-audit { border-left-color: #9f7aea; }
    .requirement-card.missing-ratelimit { border-left-color: #ed64a6; }
    
    .requirement-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .requirement-category {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.6px;
      color: var(--req-text-dim);
    }
    .requirement-confidence {
      font-size: 11px;
      background: rgba(10,92,54,0.1);
      color: var(--req-accent);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
    }
    .requirement-description {
      font-size: 14px;
      line-height: 1.55;
      color: var(--req-text);
      margin-bottom: 12px;
    }
    .inject-button {
      background: linear-gradient(135deg, #0a5c36 0%, #16803a 100%);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 2px 6px rgba(10,92,54,0.3);
    }
    .inject-button:hover {
      transform: translateY(-1px) scale(1.03);
      box-shadow: 0 4px 10px rgba(10,92,54,0.45);
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
    }
    .accept-all-button {
      background: linear-gradient(135deg, #0a5c36 0%, #1a9e5c 100%);
      color: white;
      border: none;
      border-radius: 9px;
      padding: 10px 22px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 2px 10px rgba(10,92,54,0.35);
    }
    .accept-all-button:hover {
      transform: translateY(-1px) scale(1.02);
      box-shadow: 0 4px 16px rgba(10,92,54,0.5);
    }
    .dismiss-button {
      background: transparent;
      border: 1px solid var(--req-border);
      color: var(--req-text-dim);
      border-radius: 9px;
      padding: 10px 22px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      transition: background 0.15s, border-color 0.15s;
    }
    .dismiss-button:hover {
      background: var(--req-surface);
      border-color: var(--req-accent);
      color: var(--req-text);
    }
  `;

  let parsedRequirements = [];
  requirements.forEach(req => {
    if (!req.description) return;
    const lines = req.description.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    lines.forEach(line => {
      const cleanedLine = line.replace(/^[-*•]\s*|^\d+\.\s*/, '').trim();
      if (cleanedLine) {
        parsedRequirements.push({
          ...req,
          description: cleanedLine
        });
      }
    });
  });

  let requirementsHtml = '';
  parsedRequirements.forEach((req, index) => {
    let categoryClass = 'missing-auth';
    if (req.category.toLowerCase().includes('authz')) categoryClass = 'missing-authz';
    else if (req.category.toLowerCase().includes('encrypt')) categoryClass = 'missing-encryption';
    else if (req.category.toLowerCase().includes('valid')) categoryClass = 'missing-validation';
    else if (req.category.toLowerCase().includes('audit')) categoryClass = 'missing-audit';
    else if (req.category.toLowerCase().includes('rate')) categoryClass = 'missing-ratelimit';

    requirementsHtml += `
      <div class="requirement-card ${categoryClass}">
        <div class="requirement-header">
          <span class="requirement-category">MISSING: ${req.category.toUpperCase()}</span>
          <span class="requirement-confidence">${Math.round(req.confidence * 100)}% match</span>
        </div>
        <div class="requirement-description">• ${req.description}</div>
        <button class="inject-button" data-index="${index}">+ Inject</button>
      </div>
    `;
  });

  let warningHtml = '';
  if (!isConfigured) {
    warningHtml = `
            <div style="background-color: #FFFBEB; border: 1px solid #FCD34D; color: #92400E; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px;">
                <strong>⚠️ AI Not Configured</strong><br>
                Please set your Gemini API Key in the extension settings to generate specific requirements. Using generic defaults.
                <br><a href="#" id="open-settings-link" style="color: #B45309; text-decoration: underline;">Open Settings</a>
            </div>
        `;
  }

  const html = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-title">Security Requirements Assistant</div>
        ${warningHtml}
        <div class="requirements-list">
          ${requirementsHtml}
        </div>
        <div class="modal-actions">
          <button class="dismiss-button">Dismiss</button>
          <button class="accept-all-button">Accept All</button>
        </div>
      </div>
    </div>
  `;

  shadow.appendChild(style);

  const template = document.createElement('div');
  template.innerHTML = html;
  shadow.appendChild(template);

  const settingsLink = shadow.getElementById('open-settings-link');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });
  }

  shadow.querySelectorAll('.inject-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (parsedRequirements[index].injected) return;

      parsedRequirements[index].injected = true;
      onInject([parsedRequirements[index].description]);

      const card = e.target.closest('.requirement-card');
      if (card) card.remove();

      const remaining = parsedRequirements.filter(r => !r.injected);
      if (remaining.length === 0) {
        if (onClose) onClose();
        container.remove();
      }
    });
  });

  shadow.querySelector('.dismiss-button').addEventListener('click', () => {
    if (onClose) onClose();
    container.remove();
  });

  shadow.querySelector('.accept-all-button').addEventListener('click', () => {
    const remaining = parsedRequirements.filter(r => !r.injected);
    if (remaining.length > 0) {
      onInject(remaining.map(r => r.description));
    }
    if (onClose) onClose();
    container.remove();
  });

  return container;
}

export function createBadge(count, onClick) {
  const badge = document.createElement('div');
  badge.className = 'vessel-badge'; // Added per instructions to prevent specific hide logic
  Object.assign(badge.style, {
    position: 'absolute',
    background: 'linear-gradient(135deg, #0a5c36, #16803a)',
    color: 'white',
    borderRadius: '20px',
    padding: '0 12px',
    height: '28px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '800',
    cursor: 'pointer',
    zIndex: '2147483647',
    boxShadow: '0 4px 12px rgba(10,92,54,0.45), 0 0 0 2.5px white',
    transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease',
    userSelect: 'none',
    animation: 'vessel-badge-in 0.35s cubic-bezier(0.34,1.56,0.64,1)'
  });

  // Inject badge animation keyframe if not present
  if (!document.getElementById('vessel-badge-anim')) {
    const s = document.createElement('style');
    s.id = 'vessel-badge-anim';
    s.textContent = `@keyframes vessel-badge-in { from { opacity:0; transform:scale(0.5); } to { opacity:1; transform:scale(1); } }`;
    document.head.appendChild(s);
  }

  badge.onmouseenter = () => {
    badge.style.transform = 'scale(1.15)';
    badge.style.boxShadow = '0 6px 20px rgba(10,92,54,0.55), 0 0 0 2.5px white';
  };
  badge.onmouseleave = () => {
    badge.style.transform = 'scale(1)';
    badge.style.boxShadow = '0 4px 12px rgba(10,92,54,0.45), 0 0 0 2.5px white';
  };

  badge.textContent = count;
  badge.title = `${count} missing security requirements / threats detected. Click to view.`;
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  badge.setAttribute('tabindex', '0');
  badge.setAttribute('aria-label', `${count} security requirement alerts detected. Press Enter to view.`);
  badge.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } });
  
  // Use mousedown to prevent text editors from stealing focus or swallowing click events
  badge.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
  });
  badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
  });
  return badge;
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function createShadowModal() {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    /* ── VESSEL Modal Base Styles ─────────────────────────────────────── */
    :host {
      --vessel-bg:          #ffffff;
      --vessel-surface:     #f9fafb;
      --vessel-text:        #111827;
      --vessel-text-muted:  #6B7280;
      --vessel-border:      #E5E7EB;
      --vessel-danger:      #DC2626;
      --vessel-danger-bg:   #FEF2F2;
      --vessel-danger-bdr:  #FCA5A5;
      --vessel-success:     #10B981;
      --vessel-primary:     #0a5c36;
      --vessel-radius:      14px;
      --vessel-shadow:      0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1);
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --vessel-bg:         #1e1e2e;
        --vessel-surface:    #2a2a3e;
        --vessel-text:       #e2e8f0;
        --vessel-text-muted: #94a3b8;
        --vessel-border:     rgba(255,255,255,0.1);
        --vessel-danger-bg:  rgba(220,38,38,0.15);
        --vessel-danger-bdr: rgba(252,165,165,0.3);
        --vessel-shadow:     0 24px 64px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4);
      }
    }

    @keyframes vessel-modal-in {
      from { opacity: 0; transform: scale(0.94) translateY(8px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes vessel-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.52);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex; justify-content: center; align-items: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: vessel-overlay-in 0.2s ease;
    }
    .modal-content {
      background: var(--vessel-bg);
      border-radius: var(--vessel-radius);
      width: 90%; max-width: 460px;
      padding: 28px;
      box-shadow: var(--vessel-shadow);
      color: var(--vessel-text);
      border: 1px solid var(--vessel-border);
      animation: vessel-modal-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
      position: relative;
    }
    h3 {
      margin-top: 0; font-size: 19px; font-weight: 700;
      color: var(--vessel-text); line-height: 1.3;
    }
    p  { margin-bottom: 12px; font-size: 14px; color: var(--vessel-text); line-height: 1.5; }
    ul {
      background: var(--vessel-danger-bg);
      border: 1px solid var(--vessel-danger-bdr);
      border-radius: 10px;
      padding: 12px 16px; margin: 0 0 16px 0;
      list-style: none;
    }
    li { color: var(--vessel-danger); font-size: 13px; margin-bottom: 4px; }
    .buttons { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
    button {
      padding: 9px 18px; border: none; border-radius: 9px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      font-family: inherit;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, opacity 0.15s ease;
    }
    button:hover  { transform: translateY(-1px) scale(1.02); }
    button:active { transform: translateY(0)    scale(0.99); }
    button:focus-visible {
      outline: 2px solid var(--vessel-primary);
      outline-offset: 2px;
    }
    #redact-btn {
      background: var(--vessel-danger); color: white;
      box-shadow: 0 2px 8px rgba(220,38,38,0.35);
    }
    #redact-btn:hover { box-shadow: 0 4px 14px rgba(220,38,38,0.5); }
    #original-btn { background: var(--vessel-surface); color: var(--vessel-text); border: 1px solid var(--vessel-border); }
    #cancel-btn   { background: transparent; color: var(--vessel-text-muted); border: 1px solid var(--vessel-border); }
    #send-sanitized-btn { background: var(--vessel-success); color: white; }
    #proceed-btn {
      background: transparent;
      color: var(--vessel-danger);
      border: 1px solid var(--vessel-danger-bdr);
    }
  `;

  shadow.appendChild(style);
  return { container, shadow };
}

export function insertText(field, text, savedRange) {
  if (!field) return;
  // Make sure we bring focus back to the field before inserting text
  // since the modal interaction might have caused blur
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
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    // If the standard execCommand fails, inject text via selection
    if (!document.execCommand('insertText', false, text)) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
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

export function showRedactionModal(field, originalText, matches, savedRange) {
  const { container, shadow } = createShadowModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  // Group matches by detected type, counting occurrences
  const typeCounts = {};
  matches.forEach(m => {
    const label = m.name || m.type || 'Sensitive Data';
    typeCounts[label] = (typeCounts[label] || 0) + 1;
  });

  // Emoji per known pattern type
  const patternEmoji = {
    'Credit Card Number':           '💳',
    'AWS Access Key':               '🔑',
    'Private Key Header':           '🗝️',
    'Email Address':                '📧',
    'Phone Number':                 '📞',
    'Aadhaar Number (India)':       '🇮🇳',
    'PAN Card (India)':             '🇮🇳',
    'Indian Passport':              '🛂',
    'UPI ID':                       '💸',
    'Bank Account Number (India)':  '🏦',
    'Voter ID / EPIC (India)':      '🗳️',
    'Driving Licence (India)':      '🚗',
    'Social Security Number (US)':  '🇺🇸',
    'Generic Credential / Password':'🔐',
    'IP Address (IPv4)':            '🌐'
  };

  const listItems = Object.entries(typeCounts).map(([name, count]) => {
    const emoji = patternEmoji[name] || '🔴';
    const countTag = count > 1 ? ` <em style="opacity:0.7;">(x${count})</em>` : '';
    return `<li style="margin-bottom:6px;">${emoji} ${escapeHtml(name)}${countTag}</li>`;
  }).join('');

  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'vessel-redact-title');
  overlay.innerHTML = `
        <div class="modal-content">
            <h3 id="vessel-redact-title">Sensitive Data Detected</h3>
            <p>VESSEL found <strong>${matches.length}</strong> sensitive item(s) in your clipboard:</p>
            <ul style="list-style:none; padding:12px; margin:0 0 12px 0; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:8px;">
                ${listItems}
            </ul>
            <p style="font-size:12px; color:#6B7280; margin-bottom:16px;">
                Redact &amp; Paste replaces sensitive characters with X while preserving format separators.
            </p>
            <div class="buttons">
                <button id="redact-btn">Redact &amp; Paste</button>
                <button id="original-btn">Paste Original</button>
                <button id="cancel-btn">Cancel</button>
            </div>
        </div>
    `;

  shadow.appendChild(overlay);

  overlay.querySelector('#redact-btn').addEventListener('click', async () => {
    try {
      const { redactText } = await import(chrome.runtime.getURL('lib/redactor.js'));
      const redacted = redactText(originalText, matches);
      insertText(field, redacted, savedRange);
    } catch (e) {
      console.error('[VESSEL] Redaction failed', e);
    }
    container.remove();
  });

  overlay.querySelector('#original-btn').addEventListener('click', () => {
    insertText(field, originalText, savedRange);
    container.remove();
  });

  overlay.querySelector('#cancel-btn').addEventListener('click', () => {
    container.remove();
  });

  document.body.appendChild(container);
}

export function createModal(title, content, buttons) {
  const { container, shadow } = createShadowModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const buttonsHtml = buttons.map((btn, i) => `
    <button id="modal-btn-${i}" style="
      background: ${btn.primary ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent'};
      color: ${btn.primary ? 'white' : '#6B7280'};
      border: ${btn.primary ? 'none' : '1px solid #D1D5DB'};
    ">${escapeHtml(btn.text)}</button>
  `).join('');

  overlay.innerHTML = `
    <div class="modal-content">
      <h3>${escapeHtml(title)}</h3>
      <div style="margin-bottom: 20px;">${content}</div>
      <div class="buttons">
        ${buttonsHtml}
      </div>
    </div>
  `;

  shadow.appendChild(overlay);

  buttons.forEach((btn, i) => {
    overlay.querySelector(`#modal-btn-${i}`).addEventListener('click', btn.onClick);
  });

  return {
    show: () => document.body.appendChild(container),
    hide: () => container.remove()
  };
}

export function showThreatModal(score, originalText, sanitizedText, threats, onProceed, onSendSanitized, onCancel) {
  // Support legacy 6-arg call (no threats) by shifting arguments
  if (typeof threats === 'function') {
    onCancel = onSendSanitized;
    onSendSanitized = onProceed;
    onProceed = threats;
    threats = [];
  }

  const { container, shadow } = createShadowModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const safeOriginal = escapeHtml(originalText);
  const safeSanitized = escapeHtml(sanitizedText);
  const confidencePct = Math.round(score * 100);

  // Color for confidence bar
  const barColor = confidencePct >= 80 ? '#DC2626' : confidencePct >= 50 ? '#F59E0B' : '#10B981';

  // Threat type labels for display
  const threatTypeLabels = {
    base64:        '🔐 Base64-encoded payload',
    html_entities: '🔡 HTML entity-encoded text',
    event_handler: '⚡ JavaScript event handler on hidden element',
    split_payload: '🔀 Split payload across hidden elements'
  };

  // Build threats list HTML
  let threatsHtml = '';
  if (threats && threats.length > 0) {
    const grouped = {};
    threats.forEach(t => { grouped[t.type] = (grouped[t.type] || 0) + 1; });
    const items = Object.entries(grouped).map(([type, count]) => {
      const label = threatTypeLabels[type] || `🚨 ${type}`;
      return `<li style="margin-bottom:6px;">${label}${count > 1 ? ` <em>(×${count})</em>` : ''}</li>`;
    }).join('');
    threatsHtml = `
      <div style="margin-bottom:16px;">
        <strong style="font-size:13px; color:#374151;">Detected Obfuscation Techniques:</strong>
        <ul style="margin:8px 0 0 0; padding-left:20px; font-size:13px; color:#991B1B;">
          ${items}
        </ul>
      </div>`;
  }

  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'vessel-threat-title');
  overlay.setAttribute('aria-describedby', 'vessel-threat-desc');
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 600px; width: 90%;">
      <h3 id="vessel-threat-title" style="color: #DC2626; display: flex; align-items: center; gap: 8px;">
        ⚠️ Security Risk Detected
      </h3>

      <!-- Confidence Meter -->
      <div style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:13px; color:#4B5563; font-weight:600;">Threat Confidence</span>
          <span style="font-size:18px; font-weight:800; color:${barColor};">${confidencePct}%</span>
        </div>
        <div style="background:#E5E7EB; border-radius:8px; height:10px; overflow:hidden;">
          <div style="background:${barColor}; width:${confidencePct}%; height:100%; border-radius:8px; transition:width 0.5s ease;"></div>
        </div>
      </div>

      ${threatsHtml}

      <p style="color: #4B5563; margin-bottom: 16px; font-size:13px;">This page contains hidden text or instructions that may manipulate the AI assistant.</p>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong id="view-title" style="color: #DC2626; font-size: 14px;">Raw Payload (Warning)</strong>
        <button id="toggle-view-btn" style="background: #F3F4F6; color: #374151; font-size: 12px; padding: 6px 12px; border: 1px solid #D1D5DB; border-radius: 4px; cursor: pointer;">View Sanitized Version</button>
      </div>

      <div id="text-container" style="
        border: 2px solid #DC2626;
        border-radius: 8px;
        padding: 12px;
        height: 160px;
        overflow-y: auto;
        white-space: pre-wrap;
        font-family: monospace;
        font-size: 12px;
        background: #FEF2F2;
        color: #991B1B;
        word-break: break-all;
      ">${safeOriginal}</div>

      <div class="buttons" style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
        <button id="send-sanitized-btn" style="background: #10B981; color: white; display: none;">Send Sanitized</button>
        <button id="proceed-btn" style="background: transparent; color: #DC2626; border: 1px solid #FCA5A5;">Proceed Anyway</button>
        <button id="cancel-btn">Cancel</button>
      </div>
    </div>
  `;

  shadow.appendChild(overlay);

  const textContainer = overlay.querySelector('#text-container');
  const viewTitle = overlay.querySelector('#view-title');
  const toggleBtn = overlay.querySelector('#toggle-view-btn');
  const sendSanitizedBtn = overlay.querySelector('#send-sanitized-btn');

  let viewingSanitized = false;

  toggleBtn.addEventListener('click', () => {
    viewingSanitized = !viewingSanitized;
    if (viewingSanitized) {
      viewTitle.textContent = "Sanitized Output (Clean)";
      viewTitle.style.color = "#10B981";
      textContainer.style.borderColor = "#10B981";
      textContainer.style.background = "#F0FDF4";
      textContainer.style.color = "#065F46";
      textContainer.innerHTML = safeSanitized;
      toggleBtn.textContent = "View Raw Payload";
      sendSanitizedBtn.style.display = 'block';
    } else {
      viewTitle.textContent = "Raw Payload (Warning)";
      viewTitle.style.color = "#DC2626";
      textContainer.style.borderColor = "#DC2626";
      textContainer.style.background = "#FEF2F2";
      textContainer.style.color = "#991B1B";
      textContainer.innerHTML = safeOriginal;
      toggleBtn.textContent = "View Sanitized Version";
      sendSanitizedBtn.style.display = 'none';
    }
  });

  sendSanitizedBtn.addEventListener('click', () => {
    onSendSanitized();
    container.remove();
  });

  overlay.querySelector('#proceed-btn').addEventListener('click', () => {
    onProceed();
    container.remove();
  });

  overlay.querySelector('#cancel-btn').addEventListener('click', () => {
    if (onCancel) onCancel();
    container.remove();
  });

  document.body.appendChild(container);

  return {
    hide: () => container.remove()
  };
}

