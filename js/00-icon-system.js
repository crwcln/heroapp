// A small, locally drawn symbol set with a single optical weight and quiet geometry.
(() => {
    const glyphs = {
        'alert-triangle': '<path d="M10.3 4.7 3.8 16a2 2 0 0 0 1.7 3h13a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/>',
        'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/>',
        'arrow-down': '<path d="M12 4v15m-6-6 6 6 6-6"/>',
        'arrow-up': '<path d="M12 20V5m-6 6 6-6 6 6"/>',
        'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
        award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13-1 7 4.5-2.5 4.5 2.5-1-7"/><path d="m10 9 1.3 1.3L14 7.7"/>',
        bot: '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 4v3m-4 6h.01M16 13h.01M9 17h6"/><circle cx="12" cy="3.5" r=".8" fill="currentColor" stroke="none"/>',
        'calendar-days': '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17M8 12.5h.01M12 12.5h.01M16 12.5h.01M8 16h.01M12 16h.01"/>',
        calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17M8 13h3v3H8z"/>',
        'chevron-down': '<path d="m7 10 5 5 5-5"/>',
        'circle-check': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
        'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
        check: '<path d="m5 12 4.5 4.5L19 7"/>',
        'circle-help': '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.8 1.7c-1 .8-1.6 1.1-1.6 2.5m0 3h.01"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
        'cloud-upload': '<path d="M7.2 18.5H6a4 4 0 1 1 .7-7.9A5.5 5.5 0 0 1 17 9.8a4.4 4.4 0 1 1 1 8.7h-1.2M12 19V11m-3 3 3-3 3 3"/>',
        compass: '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.4 5.2-5.2 2.4 2.4-5.2 5.2-2.4Z"/>',
        database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
        ellipsis: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
        'external-link': '<path d="M13 5h6v6m0-6-9 9"/><path d="M18 13v5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 18V7.5A1.5 1.5 0 0 1 6.5 6H12"/>',
        eye: '<path d="M2.8 12s3.1-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.1 5.2-9.2 5.2S2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.4"/>',
        feather: '<path d="M20 4c-6.8-.8-12.4 2.2-14 7.2-1 3.1.5 5.8 3.7 6.2C15 18 20 11 20 4Z"/><path d="M4 21c2.5-5.2 6.5-8.8 12-12"/>',
        flag: '<path d="M5 21V4m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0"/>',
        'grip-vertical': '<circle cx="9" cy="5" r=".8" fill="currentColor"/><circle cx="15" cy="5" r=".8" fill="currentColor"/><circle cx="9" cy="12" r=".8" fill="currentColor"/><circle cx="15" cy="12" r=".8" fill="currentColor"/><circle cx="9" cy="19" r=".8" fill="currentColor"/><circle cx="15" cy="19" r=".8" fill="currentColor"/>',
        hammer: '<path d="m14 6 4 4M5 19l8.5-8.5M4 7l4-4 6 6-4 4-6-6Zm9 8 3-3 5 5-3 3-5-5Z"/>',
        'image-plus': '<rect x="3.5" y="4.5" width="14" height="15" rx="2"/><circle cx="8" cy="9" r="1.2"/><path d="m5 17 4.3-4 2.5 2 2.7-2.5 3 2.8M20 7v6m-3-3h6"/>',
        inbox: '<path d="M4 5h16l1 10v4H3v-4L4 5Z"/><path d="M3.5 14h5l1.5 2h4l1.5-2h5"/>',
        'key-round': '<circle cx="8" cy="10" r="4"/><path d="m11 13 8 8m-3-3 2-2m-5-1 2-2"/>',
        landmark: '<path d="m3 9 9-5 9 5M4 10h16M5 19h14M3 21h18M7 10v9m5-9v9m5-9v9"/>',
        layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
        'lock-keyhole': '<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/><circle cx="12" cy="14" r=".8" fill="currentColor"/>',
        'log-out': '<path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10m4-3 4-4-4-4m4 4H9"/>',
        map: '<path d="m3.5 6 5.5-2 7 2 4.5-2v14l-4.5 2-7-2-5.5 2V6Z"/><path d="M9 4v14m7-12v14"/>',
        'map-pin': '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
        'map-pinned': '<path d="m3.5 6 5.5-2 7 2 4.5-2v12M9 4v14m7-12v5"/><path d="M17 16c0 2.8-3.5 5.5-3.5 5.5S10 18.8 10 16a3.5 3.5 0 1 1 7 0Z"/><circle cx="13.5" cy="16" r=".8"/>',
        'maximize-2': '<path d="M8 4H4v4m0-4 6 6m6 10h4v-4m0 4-6-6M20 8V4h-4m4 0-6 6M4 16v4h4m-4 0 6-6"/>',
        medal: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13-1.5 8 5-2.5 5 2.5-1.5-8"/><path d="m10 9 1.3 1.3L14 7.7"/>',
        megaphone: '<path d="m4 12 13-5v10L4 13v-1Zm0 1 2 6h4l-2-5m9-6 3-2v14l-3-2"/>',
        moon: '<path d="M19.5 15.5A8.5 8.5 0 0 1 8.5 4.5a8.5 8.5 0 1 0 11 11Z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2m0 15v2m9.5-9.5h-2m-15 0h-2m16.2-6.7-1.4 1.4M6.7 17.3l-1.4 1.4m13.4 0-1.4-1.4M6.7 6.7 5.3 5.3"/>',
        'mouse-pointer-2': '<path d="m5 3 13 10-6 .8-3.5 5.2L5 3Z"/><path d="m12 14 3 5"/>',
        'panels-top-left': '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M10 4v16M3.5 10h6.5"/>',
        paperclip: '<path d="m8 12.5 6.8-6.8a3 3 0 0 1 4.2 4.2l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.2-8.2"/>',
        'party-popper': '<path d="m5 14 13-9-4 15-3.5-4L5 14Z"/><path d="m11 16 3 3M18 3l.7-1.5M21 8l1.7-.3M17 2l-.2-1.5M20 4l1.4-1"/>',
        pencil: '<path d="m15 5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        'refresh-cw': '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 2m-16 8 2 2a7 7 0 0 0 12.5-3"/>',
        'repeat-2': '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
        rocket: '<path d="M12 15 9 12c.5-4 3.5-7 10-8-.5 6.5-4 9.5-7 11Z"/><path d="m9 12-4 1-2 4 5-1m4-1-1 5 4-2 1-4M8 18a2 2 0 0 1-2 2"/><circle cx="15" cy="9" r="1"/>',
        'rotate-ccw': '<path d="M4 9V4m0 5h5M5 8a8 8 0 1 1-1 7"/>',
        save: '<path d="M5 4h12l3 3v13H4V4h1Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
        scroll: '<path d="M7 4h12v16H7a3 3 0 1 1 0-6h12M7 4a3 3 0 1 0 0 6h12"/><path d="M10 7h5m-5 10h5"/>',
        'scroll-text': '<path d="M7 4h12v16H7a3 3 0 1 1 0-6h12M7 4a3 3 0 1 0 0 6h12"/><path d="M10 7h5m-5 4h5m-5 6h5"/>',
        search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
        send: '<path d="m3 11 18-8-6.5 18-3.2-7.3L3 11Z"/><path d="m11.3 13.7 4.2-4.2"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="m19 13.5 1.2 1-.9 1.6-1.5-.4a7 7 0 0 1-1.7 1l-.3 1.6h-1.9l-.4-1.5a7 7 0 0 1-1.8 0l-.9 1.3-1.7-.8.4-1.6a7 7 0 0 1-1.2-1.3l-1.6.2-.6-1.8 1.4-.8a7 7 0 0 1 0-1.8l-1.2-1 .9-1.6 1.5.4a7 7 0 0 1 1.7-1l.3-1.6h1.9l.4 1.5a7 7 0 0 1 1.8 0l.9-1.3 1.7.8-.4 1.6a7 7 0 0 1 1.2 1.3l1.6-.2.6 1.8-1.4.8a7 7 0 0 1 0 1.8Z"/>',
        'shield-alert': '<path d="M12 21s7-3.4 7-9V5l-7-2-7 2v7c0 5.6 7 9 7 9Z"/><path d="M12 8v4m0 3h.01"/>',
        'sliders-horizontal': '<path d="M4 6h8m4 0h4M4 12h3m4 0h9M4 18h9m4 0h3"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
        sparkles: '<path d="m12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2L12 3Zm7 12 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z"/>',
        timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6m-3 0v3m5 1 2-2"/>',
        'trash-2': '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
        trophy: '<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
        type: '<path d="M4 6V4h16v2M12 4v16m-4 0h8M8 9h8"/>',
        upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
        x: '<path d="m6 6 12 12M18 6 6 18"/>',
        'bar-chart-3': '<path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/>',
        bug: '<path d="M9 9h6a3 3 0 0 1 3 3v4a5 5 0 0 1-10 0v-4a3 3 0 0 1 1-3Z"/><path d="M10 9 8 6m6 3 2-3M5 12H3m18 0h-2M5 17H3m18 0h-2M9 4l3 2 3-2"/>',
        headphones: '<path d="M4 13v-2a8 8 0 0 1 16 0v2m-16 0v5h4v-7H5a1 1 0 0 0-1 1Zm16 0v5h-4v-7h3a1 1 0 0 1 1 1Z"/>',
        'book-open': '<path d="M12 6c-2.5-2-5.5-2-9-1v14c3.5-1 6.5-1 9 1 2.5-2 5.5-2 9-1V5c-3.5-1-6.5-1-9 1Z"/><path d="M12 6v14"/>',
        flame: '<path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-4-7-.2 2-1.2 3-2 3-1-3-3-5-5-7 0 4-3 7-3 11a7 7 0 0 0 7 7Z"/><path d="M12 22a3 3 0 0 0 3-3c0-1.5-1-2.5-2-3.5-.2 1-1 1.5-1.5 1.5-.5-1.2-1.3-2-2-2.5 0 1.7-1 2.7-1 4.5a3 3 0 0 0 3.5 3Z"/>',
        heart: '<path d="M20.5 8.8c0 4.3-8.5 10-8.5 10s-8.5-5.7-8.5-10a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2Z"/>',
        star: '<path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9L12 3Z"/>',
        lightbulb: '<path d="M9 18h6m-5 3h4m-6-6a7 7 0 1 1 8 0c-.8.6-1 1.2-1 2H9c0-.8-.2-1.4-1-2Z"/>',
        users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1h-11Zm12-13a3 3 0 0 1 0 6m1 2a5 5 0 0 1 4 5"/>',
        bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4"/>',
        music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>'
    };
    const ns = 'http://www.w3.org/2000/svg';
    function createIcons({ root = document } = {}) {
        root.querySelectorAll('[data-lucide]').forEach(node => {
            const name = node.getAttribute('data-lucide') || 'map-pin';
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '24'); svg.setAttribute('height', '24');
            svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '1.7'); svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', node.getAttribute('aria-hidden') || 'true');
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('class', `hero-symbol hero-symbol-${name} ${node.getAttribute('class') || ''}`.trim());
            if (node.id) svg.id = node.id;
            if (node.title) svg.setAttribute('aria-label', node.title);
            if (node.hasAttribute('style')) svg.setAttribute('style', node.getAttribute('style'));
            svg.innerHTML = glyphs[name] || glyphs['map-pin'];
            node.replaceWith(svg);
        });
    }
    window.lucide = { createIcons };
})();
