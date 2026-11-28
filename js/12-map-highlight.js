const TILE_STANDARD = HeroMap.TILES[1].url;
const TILE_HOT = HeroMap.TILES[2].url;
const TILE_SATELLITE = HeroMap.TILES[0].url;
// ===== MAP HIGHLIGHT + PREMIUM EXTRAS =====
// Curated Natural Earth and historical boundaries are bundled into one local GeoJSON file.
// No map-boundary data is requested from a CDN while a player is using the site.
let hlLocations = {}, hlFeatures = {}, hlLoading = null, hlLayers = [], hlTok = 0, hlMissingWarned = false, hlReady = false;
const hlNorm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function hlLoad() {
    if (hlLoading) return hlLoading;
    hlLoading = fetch('content/location-boundaries.geojson').then(response => {
        if (!response.ok) throw new Error(`Boundary bundle unavailable (${response.status})`);
        return response.json();
    }).then(data => {
        hlLocations = data.locations || {};
        hlFeatures = Object.fromEntries((data.features || []).map(feature => [feature.id || feature.properties?.heroBoundaryId, feature]));
    }).catch(error => {
        console.warn('Hero boundary bundle could not load. A steward can rebuild it from the Quiz tab.', error);
        hlLocations = {}; hlFeatures = {};
    }).finally(() => {
        hlReady = true;
        document.dispatchEvent(new Event('hero-boundaries-ready'));
    });
    return hlLoading;
}
const hlLocationEntry = loc => {
    if (!loc || !loc.id) return null;
    return hlLocations[`${loc.tour || yearMode}:${loc.id}`] || hlLocations[loc.id] || null;
};
window.__heroHasBoundary = loc => {
    if (!hlReady) return null;
    const entry = hlLocationEntry(loc);
    return !!entry?.featureIds?.some(id => !!hlFeatures[id]);
};
const hlKind = loc => HeroMap.kind(loc);
function hlHintRegion(loc) {
    const entry = hlLocationEntry(loc);
    if (entry?.hintRegion) return entry.hintRegion;
    const feature = entry?.featureIds?.map(id => hlFeatures[id]).find(Boolean), p = feature?.properties || {};
    const local = p.NAME_1 || p.name_1 || p.ADM1_NAME || '';
    const country = p.ADM0_NAME || p.NAME_0 || p.ADMIN || '';
    if (local && country && hlNorm(local) !== hlNorm(country)) return `${local}, ${country}`;
    const region = loc.region || loc.continent || loc.country || p.CONTINENT || p.REGION_UN || p.REGION_WB || p.REGION || p.ADM0_NAME || p.ADMIN || p.NAME_0;
    if (region) return String(region);
    const lat = Number(loc.lat), lng = Number(loc.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return `${lat >= 0 ? 'Northern' : 'Southern'} ${lng >= 0 ? 'Eastern' : 'Western'} Hemisphere`;
    return '';
}
window.__heroRegionHint = async loc => { await hlLoad(); return hlHintRegion(loc); };
function hlClear() { hlTok++; if (hlLayers.length) { try { hlLayers.forEach(layer => map.removeLayer(layer)); } catch (e) { /* map already gone */ } hlLayers = []; } }
function hlShow(loc) {
    window.__focusLoc = { name: loc.name, category: loc.category || '' };
    hlClear(); const my = hlTok;
    hlLoad().then(() => {
        if (my !== hlTok || typeof map === 'undefined' || !map) return;
        const entry = hlLocationEntry(loc);
        const features = (entry?.featureIds || []).map(id => hlFeatures[id]).filter(Boolean);
        if (features.length) {
            const kind = entry.kind === 'historic' ? 'empire' : entry.kind || hlKind(loc);
            HeroMap.boundaryPane(map, 'heroBoundaryHighlight', 625);
            hlLayers.push(...HeroMap.boundaryLayers(map, features, 'heroBoundaryHighlight', kind));
            // A pair of gold rings expands from the location dot as its boundary appears.
            // Keep the effect in the same non-interactive pane as the outline.
            hlLayers.push(...HeroMap.ringLayers(map, loc, 'heroBoundaryHighlight'));
        } else {
            // A point halo is not a boundary. Do not show a misleading circle when the curated
            // outline is missing; the location catalog can be exported and rebuilt by a steward.
            if (!hlMissingWarned) {
                hlMissingWarned = true;
                console.warn('No curated geographic outline matched this location. A steward can use Rebuild borders now in the Quiz tab.');
            }
        }
    });
}
function hlBind(marker, loc) {
    hlLoad();
    marker.on('mouseover click popupopen', () => hlShow(loc));
    marker.on('mouseout', () => { if (!marker.isPopupOpen()) hlClear(); });
    marker.on('popupclose', hlClear);
    hlAimInit();
}
let hlAimOverlay = null, hlAimLabel = null, hlAimRaf = 0, hlAimPin = null, hlAimActive = false, hlAimBoundDoc = false;
const hlAimMaps = new WeakSet();
const hlAimEnabled = () => document.documentElement.classList.contains('is-mobile') && document.body.classList.contains('in-quiz') && typeof map !== 'undefined' && !!map;
function hlAimEnsure() {
    if (hlAimOverlay || !document.getElementById('quiz-view')) return;
    hlAimOverlay = document.createElement('div');
    hlAimOverlay.id = 'quiz-crosshair';
    hlAimOverlay.setAttribute('aria-hidden', 'true');
    hlAimOverlay.dataset.locked = '0';
    const ring = document.createElement('span');
    ring.className = 'qc-ring';
    hlAimLabel = document.createElement('span');
    hlAimLabel.className = 'qc-label';
    hlAimLabel.textContent = 'Center a pin';
    hlAimOverlay.append(ring, hlAimLabel);
    document.getElementById('quiz-view').appendChild(hlAimOverlay);
}
function hlAimClear() {
    if (hlAimRaf) cancelAnimationFrame(hlAimRaf);
    hlAimRaf = 0;
    if (hlAimPin) hlAimPin.classList.remove('aim-target');
    hlAimPin = null;
    if (hlAimOverlay) {
        hlAimOverlay.dataset.locked = '0';
        if (hlAimLabel) hlAimLabel.textContent = 'Center a pin';
    }
    if (hlAimActive) { hlAimActive = false; hlClear(); }
}
function hlAimResolve() {
    if (!hlAimEnabled()) { hlAimClear(); return; }
    const bounds = (hlAimOverlay || document.getElementById('quiz-view')).getBoundingClientRect();
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    const stacked = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)].filter(Boolean);
    let icon = null;
    for (const element of stacked) {
        const match = element.closest?.('.leaflet-marker-icon.custom-div-icon');
        if (match) { icon = match; break; }
    }
    let layer = null;
    if (icon && typeof map.eachLayer === 'function') map.eachLayer(candidate => { if (!layer && candidate.getElement?.() === icon) layer = candidate; });
    const pin = icon?.querySelector('.marker-pin') || null;
    const loc = layer?._loc || null;
    if (!pin || !loc) { if (hlAimPin || hlAimActive) hlAimClear(); return; }
    if (hlAimPin === pin) return;
    if (hlAimPin) hlAimPin.classList.remove('aim-target');
    hlAimPin = pin;
    pin.classList.add('aim-target');
    if (hlAimOverlay) {
        hlAimOverlay.dataset.locked = '1';
        if (hlAimLabel) hlAimLabel.textContent = loc.name || 'Location';
    }
    hlAimActive = true;
    hlShow(loc);
}
function hlAimSchedule() {
    if (!hlAimEnabled()) { hlAimClear(); return; }
    if (hlAimRaf) return;
    hlAimRaf = requestAnimationFrame(() => { hlAimRaf = 0; hlAimResolve(); });
}
function hlAimInit() {
    if (!hlAimEnabled()) return;
    hlAimEnsure();
    if (!hlAimOverlay) return;
    if (!hlAimMaps.has(map)) {
        hlAimMaps.add(map);
        map.on('move zoom moveend zoomend viewreset', hlAimSchedule);
    }
    if (!hlAimBoundDoc) {
        hlAimBoundDoc = true;
        document.addEventListener('touchend', hlAimSchedule, { passive: true });
        document.addEventListener('touchcancel', hlAimSchedule, { passive: true });
        document.addEventListener('click', hlAimSchedule, { passive: true });
        new MutationObserver(hlAimSchedule).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-view'] });
    }
    hlAimSchedule();
}
hlLoad();
const rowOut = (sel, idx) => new Promise(res => { const r = document.querySelectorAll(sel + ' > div')[idx]; if (!r) return res(); r.classList.add('row-out'); setTimeout(res, 260); });

// quote of the day on the home page
(function () { const q = quoteOfDay(); document.getElementById('qotd-t').textContent = '\u201c' + q.t + '\u201d'; document.getElementById('qotd-a').textContent = q.a; })();
// background layers (real elements so moving them never restyles the page) + no particle loop
const fxA = document.createElement('div'), fxB = document.createElement('div'); fxA.id = 'fx-a'; fxB.id = 'fx-b'; document.body.prepend(fxB, fxA);
const fxMove = (x, y) => { fxA.style.translate = `${-x * 22}px ${-y * 22}px`; fxB.style.translate = `${x * 60}px ${y * 60}px`; };
{ const pc = document.getElementById('particles-bg'); if (pc) pc.style.display = 'none'; }
