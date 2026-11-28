const SC_GROUPS = ['Access', 'Firebase', 'Clio', 'Browser', 'Operations'];

const scEl = (id) => document.getElementById(id);
const scGate = scEl('sc-gate');
const scPanel = scEl('sc-console');
const scForm = scEl('sc-form');
const scPassword = scEl('sc-password');
const scUnlock = scEl('sc-unlock');
const scLock = scEl('sc-lock');
const scRefresh = scEl('sc-refresh');
const scJump = scEl('sc-jump');
const scMobileActions = scEl('sc-mobile-actions');
const scTop = scEl('sc-top');
const scMobileRefresh = scEl('sc-mobile-refresh');
const scMobileLock = scEl('sc-mobile-lock');
const scAuthError = scEl('sc-auth-error');
const scSummary = scEl('sc-summary');
const scGroups = scEl('sc-groups');
const scStatus = scEl('sc-status');

const scEscape = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const scSlug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const scScrollBehavior = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

function scBrowserChecks() {
    return [
        { id: 'connection', label: 'Network connection', group: 'Browser', ok: navigator.onLine, detail: 'Browser reports an active connection', optional: true },
        { id: 'secureContext', label: 'Secure context', group: 'Browser', ok: !!window.isSecureContext, detail: 'Secure context required for credentials', optional: true },
        { id: 'webCrypto', label: 'Web Crypto', group: 'Browser', ok: !!(window.crypto && window.crypto.subtle), detail: 'Client crypto primitives available', optional: true }
    ];
}

function scRender(checks) {
    const required = checks.filter((check) => !check.optional);
    const ready = required.filter((check) => check.ok).length;
    scSummary.dataset.state = ready === required.length ? 'ok' : 'missing';
    scSummary.textContent = `${ready} of ${required.length} required services ready · ${checks.length} checks total`;
    scJump.innerHTML = SC_GROUPS.filter((group) => checks.some((check) => check.group === group))
        .map((group) => `<button type="button" data-group="${scEscape(scSlug(group))}" aria-label="Jump to ${scEscape(group)}">${scEscape(group)}</button>`)
        .join('');
    scGroups.innerHTML = SC_GROUPS.map((group) => {
        const items = checks.filter((check) => check.group === group);
        if (!items.length) return '';
        const rows = items.map((check) => {
            const state = check.ok ? 'ok' : check.optional ? 'optional' : 'missing';
            const label = check.ok ? 'Ready' : check.optional ? 'Optional' : 'Missing';
            return `<li class="sc-row" data-state="${scEscape(state)}"><span class="sc-dot" aria-hidden="true"></span><span><strong>${scEscape(check.label)}</strong><small>${scEscape(check.detail)}</small></span><span class="sc-state">${label}</span></li>`;
        }).join('');
        return `<section id="sc-group-${scEscape(scSlug(group))}" class="sc-group"><h3>${scEscape(group)}</h3><ul class="sc-list">${rows}</ul></section>`;
    }).join('');
}

function scError(message) {
    scAuthError.textContent = message;
    scAuthError.hidden = !message;
}

function scShowGate(message = '') {
    scGate.hidden = false;
    scPanel.hidden = true;
    scLock.hidden = true;
    scJump.hidden = true;
    scMobileActions.hidden = true;
    document.body.classList.remove('sc-console-open');
    scError(message);
}

function scShowConsole() {
    scGate.hidden = true;
    scPanel.hidden = false;
    scLock.hidden = false;
    scJump.hidden = false;
    scMobileActions.hidden = false;
    document.body.classList.add('sc-console-open');
    scError('');
}

function scSetLoading(loading) {
    scRefresh.disabled = loading;
    scMobileRefresh.disabled = loading;
}

async function scLoad() {
    scSetLoading(true);
    scStatus.textContent = 'Checking configuration…';
    try {
        const response = await fetch('/api/system-status', { credentials: 'same-origin', cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            scShowGate();
            return;
        }
        if (!response.ok) {
            scShowGate(data.error || 'System status is unavailable.');
            return;
        }
        scShowConsole();
        scRender([...(data.checks || []), ...scBrowserChecks()]);
        scStatus.textContent = `Checked ${new Date(data.checkedAt || Date.now()).toLocaleString()}. Presence only: no key values are shown or transmitted.`;
    } catch {
        scShowGate('Could not reach the system status service.');
    } finally {
        scSetLoading(false);
    }
}

async function scDoLock() {
    scLock.disabled = true;
    scMobileLock.disabled = true;
    try {
        await fetch('/api/system-auth', { method: 'DELETE', credentials: 'same-origin', cache: 'no-store' });
    } finally {
        scLock.disabled = false;
        scMobileLock.disabled = false;
        scShowGate();
    }
}

scForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    scUnlock.disabled = true;
    scError('');
    try {
        const response = await fetch('/api/system-auth', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: scPassword.value })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            scError(data.error || 'Unlock failed.');
            scPassword.focus();
            return;
        }
        scPassword.value = '';
        await scLoad();
    } catch {
        scError('Could not reach the system status service.');
    } finally {
        scUnlock.disabled = false;
    }
});

scRefresh.addEventListener('click', scLoad);
scMobileRefresh.addEventListener('click', scLoad);
scLock.addEventListener('click', scDoLock);
scMobileLock.addEventListener('click', scDoLock);
scTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: scScrollBehavior() }));

scJump.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-group]');
    if (!button) return;
    document.getElementById(`sc-group-${button.dataset.group}`)?.scrollIntoView({ behavior: scScrollBehavior(), block: 'start' });
});

scLoad();
