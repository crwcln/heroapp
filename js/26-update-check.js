(() => {
    const buildId = document.querySelector('meta[name="hero-build-id"]')?.content;
    const notice = document.getElementById('update-notice');
    if (!buildId || !notice) return;

    const reloadDelay = 30000;
    let updateFound = false;
    let reloadTimer;
    let checking = false;

    function reloadPage() {
        location.reload();
    }

    function showUpdate() {
        if (updateFound) return;
        updateFound = true;
        notice.classList.add('show');
        reloadTimer = setTimeout(reloadPage, reloadDelay);
    }

    notice.querySelector('[data-update-reload]')?.addEventListener('click', reloadPage);
    notice.querySelector('[data-update-later]')?.addEventListener('click', () => {
        clearTimeout(reloadTimer);
        notice.classList.remove('show');
    });

    async function checkForUpdate() {
        if (updateFound || checking || document.visibilityState === 'hidden') return;
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
