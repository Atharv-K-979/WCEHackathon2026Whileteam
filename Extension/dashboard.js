document.addEventListener('DOMContentLoaded', () => {
    loadLogs();
});

function loadLogs() {
    chrome.storage.local.get('incidents', (data) => {
        const activities = data.incidents || [];
        const list = document.getElementById('log-list');
        list.innerHTML = '';

        if (activities.length === 0) {
            list.innerHTML = '<div class="empty-state">No incident logs found. System is secure.</div>';
            return;
        }

        activities.forEach((act, index) => {
            const item = document.createElement('div');
            item.className = 'log-card';

            let icon = '🛡️';
            let typeClass = 'accent';
            let formattedType = 'Security Event';

            if (act.type === 'redaction') {
                icon = '📝';
                typeClass = 'success';
                formattedType = 'Data Redaction';
            } else if (act.type === 'prompt_injection') {
                icon = '🚨';
                typeClass = 'danger';
                formattedType = 'Prompt Injection Blocked';
            } else if (act.type === 'spec') {
                icon = '';
                typeClass = 'accent';
                formattedType = 'Spec Analysis';
            }

            const isHighRisk = act.score && act.score > 0.7;
            const riskBadge = act.score !== undefined
                ? `<span class="log-badge ${isHighRisk ? 'high-risk' : ''}">Score: ${parseFloat(act.score).toFixed(2)}</span>`
                : '';

            const date = new Date(act.timestamp);
            const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

            let moreInfoContent = '';
            if (act.details || act.redactedText || act.missing) {
                const detailsObj = { ...act };
                delete detailsObj.timestamp;
                delete detailsObj.type;
                moreInfoContent = JSON.stringify(detailsObj, null, 2);
            } else {
                moreInfoContent = 'No additional structured details available for this event.';
            }

            item.innerHTML = `
                <div class="log-header">
                    <div class="log-type ${typeClass}">
                        <span>${icon}</span>
                        <span>${formattedType}</span>
                    </div>
                    <div class="log-meta">
                        ${riskBadge}
                        <span style="display: flex; align-items: center;">${dateString}</span>
                    </div>
                </div>
                <div style="font-size: 14px; margin-bottom: 12px; color: var(--text-primary);">
                    ${act.title || act.details || 'Event logged successfully.'}
                </div>
                <button class="more-info-toggle" data-index="${index}">
                    <span>More Info</span>
                    <span class="icon" style="font-size: 10px;">▼</span>
                </button>
                <div class="more-info-content" id="more-info-${index}">
                    <pre>${moreInfoContent}</pre>
                </div>
            `;
            list.appendChild(item);
        });

        document.querySelectorAll('.more-info-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                const content = document.getElementById(`more-info-${index}`);
                const icon = e.currentTarget.querySelector('.icon');

                if (content.style.display === 'block') {
                    content.style.display = 'none';
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'block';
                    icon.textContent = '▲';
                }
            });
        });
    });
}
