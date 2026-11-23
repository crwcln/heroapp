(() => {
    const buildId = document.querySelector('meta[name="hero-build-id"]')?.content;
    const notice = document.getElementById('update-notice');
    if (!buildId || !notice) return;

    let updateFound = false;
    let checking = false;

    function reloadPage() {
        location.reload();
    }

    function showUpdate() {
        if (updateFound) return;
        updateFound = true;
        notice.classList.add('show');
    }

    notice.querySelector('[data-update-reload]')?.addEventListener('click', reloadPage);
    notice.querySelector('[data-update-later]')?.addEventListener('click', () => {
        notice.classList.remove('show');
    });

    async function checkForUpdate() {
        if (updateFound || checking || document.visibilityState === 'hidden') return;
        const session = window.__HERO_SESSION__;
        if ((session && session.adminToken) || sessionStorage.getItem('mq_adminUnlocking') === '1') return;
        checking = true;

        try {
            const url = new URL('/index.html', location.origin);
            url.searchParams.set('update-check', String(Date.now()));
            const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
            if (!response.ok) throw new Error(`Update check returned HTTP ${response.status}.`);

            const html = await response.text();
            const latest = new DOMParser().parseFromString(html, 'text/html')
                .querySelector('meta[name="hero-build-id"]')?.content;
            if (!latest) throw new Error('The current page has no build identifier.');
            if (latest.trim() !== buildId.trim()) showUpdate();
        } catch (error) {
            console.warn('Could not check for a site update:', error);
        } finally {
            checking = false;
        }
    }

    setTimeout(checkForUpdate, 15000);
    setInterval(checkForUpdate, 30000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
    });
})();
