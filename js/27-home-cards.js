// ================= STEWARD-EDITABLE HOME CARDS =================
(() => {
    const hcTones = ['amber', 'indigo', 'emerald', 'rose', 'sky', 'violet', 'slate'];
    const hcFonts = ['Spectral', 'Georgia', 'serif', 'system-ui', 'Arial'];
    const hcDefault = [{
        id: 'agastya-archive', kicker: 'Sponsored · Agastya Archive',
        titleHtml: "Listen in to today's rant", bodyHtml: '',
        buttonLabel: 'Listen', url: 'https://agastyaarchive.edgeone.dev',
        icon: 'headphones', tone: 'amber', layout: 'compact'
    }];
    let hcCards = hcDefault.map(card => ({ ...card }));
    let hcDirty = false, hcLoaded = false, hcLoading = false, hcSaveBusy = false;
    let hcEditorBuilt = false, hcDragId = '', hcSelection = null, hcActiveEditor = null;

    const hcRef = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc('homeCards');
    const hcEsc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const hcCleanUrl = value => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try { const url = new URL(raw, location.href); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
        catch (_) { return ''; }
    };
    const hcPlain = value => String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 300);
    function hcSafeHtml(input, inlineOnly = false) {
        const source = new DOMParser().parseFromString(`<body>${String(input || '').slice(0, 12000)}</body>`, 'text/html').body;
        const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'A', 'SPAN', 'FONT']);
        const blocks = new Set(['P', 'DIV', 'UL', 'OL', 'LI']);
        const colorOk = value => /^(#[\da-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i.test(value || '');
        const clone = node => {
            if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
            if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
            const originalTag = node.tagName;
            const tag = originalTag === 'FONT' ? 'SPAN' : originalTag;
            const out = document.createDocumentFragment();
            if (!allowed.has(originalTag) || (inlineOnly && blocks.has(originalTag))) {
                if (inlineOnly && blocks.has(originalTag)) out.appendChild(document.createElement('br'));
                node.childNodes.forEach(child => out.appendChild(clone(child)));
                return out;
            }
            const el = document.createElement(tag.toLowerCase());
            if (tag === 'A') {
                const href = hcCleanUrl(node.getAttribute('href'));
                if (href) { el.setAttribute('href', href); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
            }
            if (tag === 'SPAN') {
                const rawColor = originalTag === 'FONT' ? node.getAttribute('color') : (node.style.color || '');
                if (colorOk(rawColor)) el.style.color = rawColor;
                const rawFont = originalTag === 'FONT' ? node.getAttribute('face') : (node.style.fontFamily || '');
                const font = hcFonts.find(candidate => String(rawFont || '').toLowerCase().includes(candidate.toLowerCase()));
                if (font) el.style.fontFamily = font;
            }
            node.childNodes.forEach(child => el.appendChild(clone(child)));
            return el;
        };
        const result = document.createElement('div');
        source.childNodes.forEach(child => result.appendChild(clone(child)));
        return result.innerHTML;
    }
    function hcNormalizeCard(card, index) {
        card = card && typeof card === 'object' ? card : {};
        const layout = card.layout === 'spotlight' ? 'spotlight' : 'compact';
        const tone = hcTones.includes(card.tone) ? card.tone : 'indigo';
        const icon = /^[a-z0-9-]{1,32}$/i.test(card.icon || '') ? card.icon : 'sparkles';
        return {
            id: String(card.id || `home-${Date.now()}-${index}`).replace(/[^a-z0-9_-]/gi, '').slice(0, 48) || `home-${index}`,
            kicker: hcPlain(card.kicker).slice(0, 80),
            titleHtml: hcSafeHtml(card.titleHtml || hcEsc(card.title || 'New home card'), true),
            bodyHtml: hcSafeHtml(card.bodyHtml || '', false),
            buttonLabel: hcPlain(card.buttonLabel).slice(0, 48),
            url: hcCleanUrl(card.url), icon, tone, layout
        };
    }
    function hcNormalizeCards(cards) {
        return (Array.isArray(cards) ? cards : []).slice(0, 12).map(hcNormalizeCard);
    }
    function hcCardElement(card, preview = false) {
        const item = hcNormalizeCard(card, 0);
        const article = document.createElement('article');
        article.className = 'hc-card'; article.dataset.tone = item.tone; article.dataset.layout = item.layout;
        const icon = document.createElement('span'); icon.className = 'hc-card-icon'; icon.dataset.iconName = item.icon;
        icon.innerHTML = `<i data-lucide="${item.icon}" aria-hidden="true"></i>`;
        const copy = document.createElement('div'); copy.className = 'hc-card-copy';
        if (item.kicker) { const kicker = document.createElement('span'); kicker.className = 'hc-card-kicker'; kicker.textContent = item.kicker; copy.appendChild(kicker); }
        const title = document.createElement('h3'); title.className = 'hc-card-title'; title.innerHTML = item.titleHtml; copy.appendChild(title);
        const body = document.createElement('div'); body.className = 'hc-card-body'; body.innerHTML = item.bodyHtml; copy.appendChild(body);
        article.append(icon, copy);
        if (item.url && item.buttonLabel) {
            const action = preview ? document.createElement('span') : document.createElement('a');
            action.className = 'hc-card-cta'; action.textContent = item.buttonLabel;
            if (!preview) { action.href = item.url; action.target = '_blank'; action.rel = 'noopener noreferrer'; }
            const arrow = document.createElement('i'); arrow.dataset.lucide = 'arrow-up-right'; arrow.setAttribute('aria-hidden', 'true'); action.appendChild(arrow);
            article.appendChild(action);
        }
        return article;
    }
    function hcRenderHome() {
        const target = document.getElementById('home-custom-cards');
        if (!target) return;
        target.replaceChildren(...hcCards.map(card => hcCardElement(card)));
        if (window.lucide) lucide.createIcons({ root: target });
        hcRenderPreview();
    }
    function hcRenderPreview() {
        const target = document.getElementById('hc-live-preview');
        if (!target) return;
        target.replaceChildren(...hcCards.map(card => hcCardElement(card, true)));
        if (window.lucide) lucide.createIcons({ root: target });
    }
    function hcSnapshotCards(snapshot) {
        if (hcDirty) return;
        const data = snapshot.exists ? snapshot.data() : null;
        hcCards = hcNormalizeCards(data && Array.isArray(data.cards) ? data.cards : hcDefault);
        hcLoaded = true;
        hcRenderHome();
        if (hcEditorBuilt && !hcDirty) hcRenderEditorList();
        hcUpdateSaveButton();
    }
    function hcStartListener() {
        if (!db || !window.__heroCanAccessApp || hcUnsubscribed) return;
        try {
            hcUnsubscribed = hcRef().onSnapshot(hcSnapshotCards, error => {
                console.warn('Home cards could not be loaded:', error);
                if (!hcLoaded) hcRenderHome();
            });
        } catch (error) { console.warn('Home cards listener unavailable:', error); }
    }
    let hcUnsubscribed = null;
    window.addEventListener('hero-auth-state', hcStartListener);
    if (window.__heroAuthResolved && window.__heroCanAccessApp) hcStartListener();
    hcRenderHome();

    function hcBuildAdmin() {
        const panel = document.getElementById('admin-panel'), nav = document.getElementById('admin-tabs');
        if (!panel || !nav || document.getElementById('hc-admin')) return;
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.t = 'home'; button.setAttribute('aria-label', 'Edit home page cards');
        button.innerHTML = '<i data-lucide="panels-top-left"></i><span>Home Cards</span><b id="atb-home" class="hidden"></b>';
        button.addEventListener('click', () => { window.setAdminTab('home'); hcOpenEditor(); });
        nav.appendChild(button);

        const section = document.createElement('section');
        section.id = 'hc-admin'; section.dataset.atab = 'home';
        section.className = 'hc-admin bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4 atab-off';
        section.innerHTML = `<header class="hc-admin-head"><div><h3>Home page cards</h3><p>Write and style the featured cards visitors see on Hero. Drag a card to reorder it; on touch screens, use the arrow controls.</p></div><div class="hc-admin-actions"><button type="button" class="hc-admin-btn" id="hc-reload"><i data-lucide="rotate-ccw"></i>Discard edits</button><button type="button" class="hc-admin-btn" id="hc-add"><i data-lucide="plus"></i>Add card</button><button type="button" class="hc-admin-btn primary" id="hc-save"><i data-lucide="cloud-upload"></i><span>Save cards</span></button></div></header>
            <div class="hc-admin-note">Text formatting applies to the selected title or description. Links and safe colors are preserved; scripts and unsafe link schemes are removed.</div>
            <div id="hc-editor-list" class="hc-editor-list"></div>
            <section class="hc-editor-preview-wrap"><div class="hc-editor-preview-label">Live preview</div><div id="hc-live-preview" class="hc-editor-preview hc-preview"></div></section>`;
        panel.appendChild(section);
        section.querySelector('#hc-add').addEventListener('click', hcAddCard);
        section.querySelector('#hc-save').addEventListener('click', hcSaveCards);
        section.querySelector('#hc-reload').addEventListener('click', hcDiscardEdits);
        section.querySelector('#hc-editor-list').addEventListener('input', hcEditorInput);
        section.querySelector('#hc-editor-list').addEventListener('change', hcEditorChange);
        hcEditorBuilt = true;
        if (window.lucide) lucide.createIcons({ root: section });
        if (panel.dataset.active === 'home') {
            button.classList.add('on'); section.classList.remove('atab-off'); hcOpenEditor();
        }
    }
    function hcOpenEditor() {
        if (!hcEditorBuilt) hcBuildAdmin();
        if (!hcEditorBuilt || hcLoading) return;
        if (hcLoaded) { hcRenderEditorList(); return; }
        if (!db) { hcRenderEditorList(); return; }
        hcLoading = true;
        hcRef().get().then(hcSnapshotCards).catch(error => {
            console.error('Home card settings read failed:', error);
            if (window.showToast) showToast('Could not load home cards. Check the steward sign-in and Firestore access.', 'error');
            hcRenderHome(); hcRenderEditorList();
        }).finally(() => { hcLoading = false; });
    }
    function hcRenderEditorList() {
        const list = document.getElementById('hc-editor-list');
        if (!list) return;
        list.replaceChildren();
        if (!hcCards.length) {
            const empty = document.createElement('div'); empty.className = 'hc-empty';
            empty.textContent = 'There are no featured cards. Add one to place a new card on the home page.'; list.appendChild(empty); return;
        }
        hcCards.forEach((card, index) => {
            const row = document.createElement('article'); row.className = 'hc-editor-card'; row.draggable = true; row.dataset.cardId = card.id;
            row.innerHTML = `<div class="hc-editor-card-top"><span class="hc-drag-grip" aria-label="Drag to reorder" title="Drag to reorder"><i data-lucide="grip-vertical"></i></span><strong>Card ${index + 1}</strong><button type="button" class="hc-move-btn" data-action="up" aria-label="Move card up" title="Move up" ${index === 0 ? 'disabled' : ''}><i data-lucide="arrow-up"></i></button><button type="button" class="hc-move-btn" data-action="down" aria-label="Move card down" title="Move down" ${index === hcCards.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down"></i></button><button type="button" class="hc-move-btn hc-editor-remove" data-action="remove" aria-label="Remove card" title="Remove card"><i data-lucide="trash-2"></i></button></div>
                <div class="hc-form-grid"><label class="hc-field">Small label<input data-field="kicker" maxlength="80" placeholder="Optional · e.g. Sponsored" value="${hcEsc(card.kicker)}"></label><label class="hc-field">Icon<select data-field="icon"><option value="sparkles">Sparkles</option><option value="headphones">Headphones</option><option value="megaphone">Megaphone</option><option value="calendar-days">Calendar</option><option value="scroll">Scroll</option><option value="compass">Compass</option><option value="book-open">Open book</option><option value="map">Map</option><option value="feather">Feather</option><option value="flame">Flame</option><option value="trophy">Trophy</option><option value="heart">Heart</option><option value="info">Info</option><option value="star">Star</option><option value="lightbulb">Lightbulb</option><option value="users">People</option><option value="bell">Bell</option><option value="music">Music</option></select></label></div>
                <div class="hc-rich-label">Title</div><div class="hc-format-tools" role="toolbar" aria-label="Title and description formatting"><button type="button" data-cmd="bold" title="Bold"><b>B</b></button><button type="button" data-cmd="italic" title="Italic"><i>I</i></button><button type="button" data-cmd="underline" title="Underline"><u>U</u></button><button type="button" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button><button type="button" data-link="1" title="Link selected text">Link</button><label title="Text color"><input data-color type="color" value="#d3a62b" aria-label="Text color" style="width:35px;height:30px;padding:2px;border:0;background:transparent;cursor:pointer"></label><select data-font aria-label="Font"><option value="Spectral">Spectral</option><option value="Georgia">Georgia</option><option value="serif">Serif</option><option value="system-ui">System</option><option value="Arial">Arial</option></select></div>
                <div class="hc-rich-edit" data-rich="titleHtml" contenteditable="true" role="textbox" aria-label="Card title" data-placeholder="Give this card a title"></div>
                <div class="hc-rich-label">Description</div><div class="hc-rich-edit" data-rich="bodyHtml" contenteditable="true" role="textbox" aria-label="Card description" aria-multiline="true" data-placeholder="Add a short description or leave blank"></div>
                <div class="hc-form-grid" style="margin-top:11px"><label class="hc-field">Button text<input data-field="buttonLabel" maxlength="48" placeholder="e.g. Explore" value="${hcEsc(card.buttonLabel)}"></label><label class="hc-field">Link URL<input data-field="url" maxlength="500" inputmode="url" placeholder="https://example.com" value="${hcEsc(card.url)}"></label><label class="hc-field">Card style<select data-field="layout"><option value="compact">Compact</option><option value="spotlight">Spotlight</option></select></label><label class="hc-field">Accent color<select data-field="tone"><option value="amber">Amber</option><option value="indigo">Indigo</option><option value="emerald">Emerald</option><option value="rose">Rose</option><option value="sky">Sky blue</option><option value="violet">Violet</option><option value="slate">Slate</option></select></label></div>
                <div class="hc-editor-preview-wrap"><div class="hc-editor-preview-label">This card</div><div class="hc-card-preview"></div></div>`;
            row.querySelector('[data-rich="titleHtml"]').innerHTML = card.titleHtml;
            row.querySelector('[data-rich="bodyHtml"]').innerHTML = card.bodyHtml;
            row.querySelector('[data-field="layout"]').value = card.layout;
            row.querySelector('[data-field="tone"]').value = card.tone;
            row.querySelector('[data-field="icon"]').value = card.icon;
            row.querySelectorAll('[data-rich]').forEach(editor => {
                editor.addEventListener('focus', () => { hcActiveEditor = editor; });
                editor.addEventListener('keyup', hcSaveSelection); editor.addEventListener('mouseup', hcSaveSelection);
                editor.addEventListener('input', () => { hcSaveSelection(); hcEditorInput({ target: editor }); });
            });
            row.querySelectorAll('.hc-format-tools button').forEach(control => {
                control.addEventListener('mousedown', event => event.preventDefault());
                control.addEventListener('click', () => hcFormat(row, control));
            });
            row.querySelector('[data-color]').addEventListener('input', event => hcApplyFormat(row, 'foreColor', event.target.value));
            row.querySelector('[data-font]').addEventListener('change', event => hcApplyFormat(row, 'fontName', event.target.value));
            row.querySelectorAll('[data-action]').forEach(control => control.addEventListener('click', () => hcCardAction(row.dataset.cardId, control.dataset.action)));
            row.addEventListener('dragstart', event => {
                if (event.target.closest('input,select,[contenteditable],button')) { event.preventDefault(); return; }
                hcSyncEditor(); hcDragId = row.dataset.cardId; row.classList.add('is-dragging');
                event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', hcDragId);
            });
            row.addEventListener('dragover', event => { if (!hcDragId) return; event.preventDefault(); row.classList.add('is-drop-target'); });
            row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
            row.addEventListener('drop', event => {
                event.preventDefault(); row.classList.remove('is-drop-target');
                const from = hcCards.findIndex(item => item.id === hcDragId), to = hcCards.findIndex(item => item.id === row.dataset.cardId);
                if (from >= 0 && to >= 0 && from !== to) { const [moved] = hcCards.splice(from, 1); hcCards.splice(to, 0, moved); hcMarkDirty(); hcRenderEditorList(); hcRenderHome(); }
            });
            row.addEventListener('dragend', () => { row.classList.remove('is-dragging'); document.querySelectorAll('.hc-editor-card').forEach(el => el.classList.remove('is-drop-target')); hcDragId = ''; });
            row.querySelector('.hc-card-preview').appendChild(hcCardElement(card, true));
            list.appendChild(row);
        });
        if (window.lucide) lucide.createIcons({ root: list });
    }
    function hcSaveSelection() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount && hcActiveEditor && hcActiveEditor.contains(selection.anchorNode)) hcSelection = selection.getRangeAt(0).cloneRange();
    }
    function hcRestoreSelection(row) {
        if (!hcActiveEditor || !row.contains(hcActiveEditor)) hcActiveEditor = row.querySelector('[data-rich="bodyHtml"]');
        if (!hcActiveEditor) return false;
        hcActiveEditor.focus();
        const selection = window.getSelection();
        if (hcSelection && hcActiveEditor.contains(hcSelection.commonAncestorContainer)) { selection.removeAllRanges(); selection.addRange(hcSelection); }
        return true;
    }
    function hcApplyFormat(row, command, value) {
        if (!hcRestoreSelection(row)) return;
        document.execCommand(command, false, value);
        hcSaveSelection(); hcEditorInput({ target: hcActiveEditor });
    }
    function hcFormat(row, button) {
        if (!hcRestoreSelection(row)) return;
        if (button.dataset.cmd) { document.execCommand(button.dataset.cmd, false); hcSaveSelection(); hcEditorInput({ target: hcActiveEditor }); return; }
        const rawUrl = prompt('Paste a link URL (https://...)'); if (!rawUrl) return;
        const href = hcCleanUrl(rawUrl); if (!href) { showToast('Use a valid http or https link.', 'error'); return; }
        const selected = window.getSelection()?.toString();
        if (selected) document.execCommand('createLink', false, href);
        else {
            const label = prompt('Text to show for this link:') || href;
            document.execCommand('insertHTML', false, `<a href="${hcEsc(href)}">${hcEsc(label)}</a>`);
        }
        hcSaveSelection(); hcEditorInput({ target: hcActiveEditor });
    }
    function hcSyncEditor(rebuildPreviewId = '') {
        const list = document.getElementById('hc-editor-list'); if (!list) return;
        const rows = [...list.querySelectorAll('.hc-editor-card')];
        hcCards = rows.map((row, index) => {
            const old = hcCards.find(item => item.id === row.dataset.cardId) || {};
            const value = key => row.querySelector(`[data-field="${key}"]`)?.value || '';
            return hcNormalizeCard({ ...old, id: row.dataset.cardId, kicker: value('kicker'), icon: value('icon'),
                titleHtml: hcSafeHtml(row.querySelector('[data-rich="titleHtml"]')?.innerHTML || '', true),
                bodyHtml: hcSafeHtml(row.querySelector('[data-rich="bodyHtml"]')?.innerHTML || '', false),
                buttonLabel: value('buttonLabel'), url: value('url'), layout: value('layout'), tone: value('tone') }, index);
        });
        hcDirty = true;
        rows.forEach(row => {
            const card = hcCards.find(item => item.id === row.dataset.cardId);
            if (card) hcUpdateCardPreview(row, card, row.dataset.cardId === rebuildPreviewId);
        });
        hcUpdateSaveButton();
    }
    function hcUpdateCardPreview(row, card, rebuild = false) {
        const preview = row.querySelector('.hc-card-preview');
        if (!preview) return;
        let article = preview.querySelector('.hc-card');
        if (rebuild || !article) {
            preview.replaceChildren(hcCardElement(card, true));
            if (window.lucide) lucide.createIcons();
            return;
        }
        article.dataset.tone = card.tone; article.dataset.layout = card.layout;
        const icon = article.querySelector('.hc-card-icon');
        if (icon && icon.dataset.iconName !== card.icon) {
            icon.dataset.iconName = card.icon; icon.innerHTML = `<i data-lucide="${hcEsc(card.icon)}" aria-hidden="true"></i>`;
            if (window.lucide) lucide.createIcons();
        }
        const copy = article.querySelector('.hc-card-copy');
        let kicker = copy.querySelector('.hc-card-kicker');
        if (card.kicker && !kicker) { kicker = document.createElement('span'); kicker.className = 'hc-card-kicker'; copy.prepend(kicker); }
        if (kicker) { kicker.textContent = card.kicker; kicker.hidden = !card.kicker; }
        const title = copy.querySelector('.hc-card-title'), body = copy.querySelector('.hc-card-body');
        if (title) title.innerHTML = card.titleHtml;
        if (body) body.innerHTML = card.bodyHtml;
    }
    function hcEditorInput(event) {
        const row = event.target.closest('.hc-editor-card');
        if (row) hcSyncEditor();
    }
    function hcEditorChange(event) {
        const row = event.target.closest('.hc-editor-card');
        if (!row) return;
        const key = event.target.dataset.field;
        hcSyncEditor(['icon', 'layout', 'tone', 'url', 'buttonLabel'].includes(key) ? row.dataset.cardId : '');
    }
    function hcMarkDirty() { hcDirty = true; hcUpdateSaveButton(); }
    function hcUpdateSaveButton() {
        const button = document.getElementById('hc-save');
        const label = button && button.querySelector('span');
        if (label && !hcSaveBusy) label.textContent = hcDirty ? 'Save changes' : 'Save cards';
    }
    function hcCardAction(id, action) {
        hcSyncEditor();
        const from = hcCards.findIndex(card => card.id === id);
        if (from < 0) return;
        if (action === 'remove') {
            if (!confirm('Remove this card from the home page?')) return;
            hcCards.splice(from, 1);
        } else {
            const to = from + (action === 'up' ? -1 : 1);
            if (to < 0 || to >= hcCards.length) return;
            const [card] = hcCards.splice(from, 1); hcCards.splice(to, 0, card);
        }
        hcMarkDirty(); hcRenderEditorList(); hcRenderHome();
    }
    function hcAddCard() {
        hcSyncEditor();
        if (hcCards.length >= 12) return showToast('You can have up to 12 home cards.', 'error');
        hcCards.push({ id: `home-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kicker: '', titleHtml: 'A new Hero feature', bodyHtml: 'Add a few words to tell visitors about it.', buttonLabel: '', url: '', icon: 'sparkles', tone: 'indigo', layout: 'compact' });
        hcMarkDirty(); hcRenderEditorList(); hcRenderHome();
        const last = document.querySelector('#hc-editor-list .hc-editor-card:last-child');
        last?.scrollIntoView({ behavior: 'smooth', block: 'center' }); last?.querySelector('[data-rich="titleHtml"]')?.focus();
    }
    async function hcDiscardEdits() {
        if (hcDirty && !confirm('Discard your unsaved home card changes?')) return;
        if (!db) { hcCards = hcDefault.map(card => ({ ...card })); hcDirty = false; hcRenderEditorList(); hcRenderHome(); return; }
        const button = document.getElementById('hc-reload'); if (button) button.disabled = true;
        try { const snapshot = await hcRef().get({ source: 'server' }); hcDirty = false; hcSnapshotCards(snapshot); }
        catch (error) { console.error('Reloading home cards failed:', error); showToast('Could not reload saved cards. Check the steward sign-in.', 'error'); }
        finally { if (button) button.disabled = false; }
    }
    async function hcSaveCards() {
        if (!db || !window.__heroCanAccessApp) return showToast('The secure Hero session is still starting. Please try again in a moment.', 'error');
        const invalidLink = [...document.querySelectorAll('#hc-editor-list .hc-editor-card [data-field="url"]')]
            .some(field => field.value.trim() && !hcCleanUrl(field.value));
        if (invalidLink) return showToast('One of the card links is invalid. Use a full http or https address.', 'error');
        hcSyncEditor();
        const button = document.getElementById('hc-save');
        if (hcSaveBusy) return;
        hcSaveBusy = true; if (button) { button.disabled = true; button.textContent = 'Saving...'; }
        try {
            await hcRef().set({ cards: hcNormalizeCards(hcCards), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            hcDirty = false; hcLoaded = true;
            hcRenderHome();
            showToast('Home cards saved and live.', 'success');
            hcUpdateSaveButton();
        } catch (error) {
            console.error('Saving home cards failed:', error);
            showToast(error && error.code === 'permission-denied' ? 'Could not save: this tab needs the steward admin session. Unlock Stewards again and retry.' : 'Could not save home cards. Check your connection and try again.', 'error');
        } finally { hcSaveBusy = false; if (button) button.disabled = false; hcUpdateSaveButton(); }
    }
    hcBuildAdmin();
})();
