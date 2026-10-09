// ===== FEATURE FLAGS =====
// Reads SITE.features from js/00-site-config.js. Loaded last so it can switch things off after everything else is ready.
const FEAT = SITE.features || {};
const hideSel = (...sels) => sels.forEach(s => document.querySelectorAll(s).forEach(e => { e.style.display = 'none'; }));
if (FEAT.clio === false) { hideSel('#sherpa-fab', '#sherpa-panel', '#nav-actions > button[onclick*="ai-view"]'); window.sherpaToggle = () => {}; }
if (FEAT.music === false) { prefs.music = 'off'; applyPrefs(); hideSel('#sw-music'); }
if (FEAT.tutorial === false) window.tutMaybe = () => {};
if (FEAT.randomLocations === false) hideSel('#rand-locs'.replace('#rand-locs', 'label.st-chip:has(#rand-locs)'));
if (FEAT.cookies === false) { consent = 'essential'; hideSel('#cookie-banner'); }
if (FEAT.secrets === false) { secretAsk = () => false; fbSecret = () => false; }
if (FEAT.flappyBird === false) { const _sa = secretAsk; secretAsk = t => (String(t).trim() === flCfg.flappyTrigger ? false : _sa(t)); }
