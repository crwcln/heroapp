// ===== MAP HIGHLIGHT + PREMIUM EXTRAS =====
// Outlines the area behind a marker (country, continent, sea/ocean, river, region) using Natural Earth boundary data
// loaded on demand from jsDelivr; places without a matching shape get an animated pulse ring instead.
const HL_BASE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/';
const HL_FILES = { land: 'ne_110m_admin_0_countries.geojson', water: 'ne_110m_geography_marine_polys.geojson', river: 'ne_110m_rivers_lake_centerlines.geojson', region: 'ne_110m_geography_regions_polys.geojson' };
let hlIndex = {}, hlLoading = null, hlLayer = null, hlTok = 0;
const hlNorm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(the|river|sea|ocean|gulf|bay|strait|empire|kingdom|mountains|mountain|desert|peninsula|lake|plateau|islands|island)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const hlAdd = (k, type, f) => { const n = hlNorm(k); if (n) (hlIndex[n] = hlIndex[n] || []).push({ type, f }); };
function hlLoad() {
    if (hlLoading) return hlLoading;
    hlLoading = Promise.all(Object.entries(HL_FILES).map(async ([type, file]) => {
        try {
            const j = await (await fetch(HL_BASE + file)).json();
            j.features.forEach(f => {
                const p = f.properties || {};
                ['name', 'NAME', 'ADMIN', 'NAME_LONG', 'name_en', 'NAME_EN'].forEach(k => p[k] && hlAdd(p[k], type, f));
                if (type === 'land' && p.CONTINENT) { const key = '__c_' + hlNorm(p.CONTINENT); (hlIndex[key] = hlIndex[key] || []).push({ type: 'continent', f }); }
            });
        } catch (e) { /* offline or blocked: pulse rings are used instead */ }
    }));
    return hlLoading;
}
const hlKind = loc => { const t = (loc.name + ' ' + (loc.category || '')).toLowerCase();
    return /river|sea|ocean|gulf|bay|strait|lake|canal|channel|current/.test(t) ? 'water' : /empire|kingdom|dynasty|caliphate|republic/.test(t) ? 'empire' : /route|road|trade|silk/.test(t) ? 'route' : 'land'; };
function hlClear() { hlTok++; if (hlLayer) { try { map.removeLayer(hlLayer); } catch (e) { /* map already gone */ } hlLayer = null; } }
function hlShow(loc) {
    hlClear(); const my = hlTok;
    hlLoad().then(() => {
        if (my !== hlTok || typeof map === 'undefined' || !map) return;
        const n = hlNorm(loc.name); let ms = (hlIndex[n] || []).slice();
        if (!ms.length && hlIndex['__c_' + n]) ms = hlIndex['__c_' + n].slice();
        const pri = hlKind(loc) === 'water' ? ['river', 'water', 'region', 'land', 'continent'] : ['land', 'continent', 'region', 'water', 'river'];
        ms.sort((a, b) => pri.indexOf(a.type) - pri.indexOf(b.type));
        const top = ms.length ? ms[0].type : null, sel = ms.filter(m => m.type === top);
        hlLayer = sel.length
            ? L.geoJSON({ type: 'FeatureCollection', features: sel.map(m => m.f) }, { style: () => ({ className: 'hl hl-' + top }), interactive: false }).addTo(map)
            : L.circleMarker([loc.lat, loc.lng], { radius: 22, className: 'hl hl-pulse hl-' + hlKind(loc), interactive: false }).addTo(map);
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
