document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadActivity();
    setupListeners();
});

function setupListeners() {
    document.getElementById('open-options').addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    document.getElementById('open-dashboard').addEventListener('click', () => {
        window.open(chrome.runtime.getURL('dashboard.html'));
    });

    document.getElementById('view-all')?.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('dashboard.html'));
    });
}

function loadStats() {
    chrome.storage.local.get(['stats', 'threatsBlocked', 'specsAnalyzed', 'redactionsCount'], (data) => {
        const blocks     = data.stats?.blocks      || data.threatsBlocked   || 0;
        const specs      = data.stats?.totalScans  || data.specsAnalyzed   || 0;
        const redactions = data.stats?.redactions  || data.redactionsCount  || 0;

        animateValue('threats-blocked',  0, blocks,     900);
        animateValue('specs-analyzed',   0, specs,      900);
        animateValue('redactions-count', 0, redactions, 900);

        // Drive the security score ring based on average risk
        const avgRisk = data.stats?.avgRisk || 0;
        updateScoreRing(avgRisk);
    });
}

/**
 * updateScoreRing – Animates the SVG ring to reflect the security posture.
 * avgRisk is 0–1 where 0 = safest. We invert it for the visual score.
 */
function updateScoreRing(avgRisk) {
    const safetyScore = Math.max(0, 1 - avgRisk); // 0=dangerous, 1=safe
    const circumference = 251.2; // 2 * Math.PI * 40
    const offset = circumference * (1 - safetyScore);

    const circle = document.getElementById('score-circle');
    if (circle) {
        // Use requestAnimationFrame to ensure the transition fires
        requestAnimationFrame(() => {
            circle.style.strokeDashoffset = offset;
        });
    }

    // Update grade label
    const gradeEl = document.getElementById('security-grade');
    const pctEl   = document.getElementById('score-pct');
    const pct = Math.round(safetyScore * 100);

    if (pctEl) pctEl.textContent = `${pct}%`;

    let grade = 'Excellent';
    if      (pct >= 90) grade = 'Excellent';
    else if (pct >= 75) grade = 'Good';
    else if (pct >= 55) grade = 'Fair';
    else                grade = 'At Risk';

    if (gradeEl) gradeEl.textContent = grade;
}

function loadActivity() {
    chrome.storage.local.get('incidents', (data) => {
        const activities = data.incidents || [];
        const list = document.getElementById('activity-list');
        list.innerHTML = '';

        if (activities.length === 0) {
            list.innerHTML = '<div class="empty-state">🛡️ No threats detected yet. Stay safe!</div>';
            return;
        }

        const typeConfig = {
            'prompt_injection': { icon: '🤖', label: 'Prompt Injection Blocked' },
            'sensitive_paste':  { icon: '🔒', label: 'Sensitive Paste Redacted' },
            'spec':             { icon: '', label: 'Spec Analyzed' },
            'default':          { icon: '🛡️', label: 'Security Event' }
        };

        activities.slice(0, 5).forEach(act => {
            const cfg = typeConfig[act.type] || typeConfig.default;
            const item = document.createElement('div');
            item.className = 'activity-item';

            const title = act.details || cfg.label;
            const time  = act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const riskPct = act.score ? ` · ${Math.round(act.score * 100)}% risk` : '';

            item.innerHTML = `
                <div class="activity-icon">${cfg.icon}</div>
                <div style="flex:1; min-width:0;">
                    <div class="activity-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</div>
                    <div class="activity-meta">${time}${riskPct}</div>
                </div>
            `;
            list.appendChild(item);
        });
    });
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    if (start === end || end - start > 200) { obj.textContent = end; return; }

    const range      = end - start;
    const increment  = end > start ? 1 : -1;
    const stepTime   = Math.max(16, Math.abs(Math.floor(duration / range)));
    let   current    = start;

    const timer = setInterval(() => {
        current += increment;
        obj.textContent = current;
        if (current === end) clearInterval(timer);
    }, stepTime);
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}
