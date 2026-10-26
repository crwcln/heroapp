const TILE_STANDARD = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_HOT = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
// Esri World Imagery is satellite/aerial imagery; OSM remains available as a no-key street map layer.
const TILE_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// ===== MAP HIGHLIGHT + PREMIUM EXTRAS =====
// Curated Natural Earth and historical boundaries are bundled into one local GeoJSON file.
// No map-boundary data is requested from a CDN while a player is using the site.
let hlLocations = {}, hlFeatures = {}, hlLoading = null, hlLayers = [], hlTok = 0, hlMissingWarned = false;
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
    });
    return hlLoading;
}
const hlLocationEntry = loc => {
    if (!loc || !loc.id) return null;
    return hlLocations[`${loc.tour || yearMode}:${loc.id}`] || hlLocations[loc.id] || null;
};
const hlKind = loc => {
    const t = (loc.name + ' ' + (loc.category || '')).toLowerCase();
    return loc.year != null && loc.year !== '' && Number.isInteger(Number(loc.year)) ? 'empire' : /empire|kingdom|dynasty|caliphate|sultanate|ancient|historic/.test(t) ? 'empire' : /route|road|trade|silk/.test(t) ? 'route' : /river|stream/.test(t) ? 'river' : /lake|reservoir/.test(t) ? 'lake' : /sea|ocean|gulf|bay|strait|canal|channel|current|marine/.test(t) ? 'water' : 'land';
};
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
            const collection = { type: 'FeatureCollection', features };
            ['hl-halo', 'hl-glow', 'hl-outline', 'hl hl-' + kind].forEach(className => {
                const layer = L.geoJSON(collection, { style: () => ({ className }), interactive: false }).addTo(map);
                hlLayers.push(layer);
            });
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
}
const rowOut = (sel, idx) => new Promise(res => { const r = document.querySelectorAll(sel + ' > div')[idx]; if (!r) return res(); r.classList.add('row-out'); setTimeout(res, 260); });

// quote of the day on the home page
(function () { const q = quoteOfDay(); document.getElementById('qotd-t').textContent = '\u201c' + q.t + '\u201d'; document.getElementById('qotd-a').textContent = q.a; })();
// background layers (real elements so moving them never restyles the page) + no particle loop
const fxA = document.createElement('div'), fxB = document.createElement('div'); fxA.id = 'fx-a'; fxB.id = 'fx-b'; document.body.prepend(fxB, fxA);
const fxMove = (x, y) => { fxA.style.translate = `${-x * 22}px ${-y * 22}px`; fxB.style.translate = `${x * 60}px ${y * 60}px`; };
{ const pc = document.getElementById('particles-bg'); if (pc) pc.style.display = 'none'; }
