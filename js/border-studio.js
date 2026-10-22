(() => {
    const $ = id => document.getElementById(id);
    const gate = $('gate'), studio = $('studio'), gateStatus = $('gate-status');
    let accessToken = '', tokenExpiry = 0, catalogLocations = [], unmatched = [], overrides = [], manualFeatures = [], selected = null, pendingManual = null;
    let map = null, drawingPoints = [], drawingMarkers = [], drawingLine = null, drawnShape = null, locationMarker = null, isDrawing = false;

    const setStatus = (id, message, isError = false) => {
        const el = $(id);
        el.textContent = message;
        el.classList.toggle('error', isError);
    };
    const readFile = async input => {
        const file = input.files?.[0];
        if (!file) return null;
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than 20 MB.`);
        return JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    };
    const requestAuth = async (action, password = '') => {
        const response = await fetch('/api/border-tool-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(action === 'verify' ? { Authorization: `Bearer ${accessToken}` } : {}) },
            body: JSON.stringify({ action, ...(action === 'login' ? { password } : {}) }),
            cache: 'no-store',
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) throw new Error(result.error === 'not_configured' ? 'Set BORDER_TOOL_PASSWORD (at least 20 characters) in EdgeOne environment variables, then redeploy.' : 'Password check failed or the session expired.');
        return result;
    };
    const requireAccess = async () => {
        if (!accessToken || Date.now() >= tokenExpiry) {
            lockStudio();
            throw new Error('Studio locked. Enter the password again.');
        }
        await requestAuth('verify');
    };
    function lockStudio() {
        accessToken = '';
        tokenExpiry = 0;
        pendingManual = null;
        resetDrawing();
        selected = null;
        if (locationMarker) map?.removeLayer(locationMarker);
        locationMarker = null;
        catalogLocations = [];
        unmatched = [];
        overrides = [];
        manualFeatures = [];
        $('password').value = '';
        gate.classList.remove('hidden');
        studio.classList.add('hidden');
        ['catalog-file', 'unmatched-file', 'overrides-file', 'existing-manual-file', 'manual-file'].forEach(id => { $(id).value = ''; });
        $('aliases').value = '';
        $('hint-region').value = '';
        $('year').value = '';
        $('location-details').textContent = 'Choose a location to prepare a matching override.';
        setStatus('loaded-status', 'No files loaded yet.');
        $('location-select').replaceChildren(new Option('Load an unmatched report first', ''));
        $('location-select').disabled = true;
        $('save-override').disabled = true;
        updateOverrideCount();
        setStatus('gate-status', 'Studio locked. Your loaded files are cleared.');
    }
    $('login-form').addEventListener('submit', async event => {
        event.preventDefault();
        const password = $('password').value;
        $('password').value = '';
        setStatus('gate-status', 'Checking password…');
        try {
            const result = await requestAuth('login', password);
            accessToken = result.token;
            tokenExpiry = result.expiresAt;
            gate.classList.add('hidden');
            studio.classList.remove('hidden');
            setStatus('gate-status', '');
            $('catalog-file').focus();
        } catch (error) {
            setStatus('gate-status', error.message, true);
        }
    });
    $('lock-button').addEventListener('click', lockStudio);

    $('catalog-file').addEventListener('change', async event => {
        try {
            const json = await readFile(event.currentTarget);
            if (!json) return;
            catalogLocations = Array.isArray(json) ? json : json.locations;
            if (!Array.isArray(catalogLocations)) throw new Error('Catalog must be an array or contain a locations array.');
            updateLoadedStatus();
            populateLocations();
        } catch (error) { setStatus('loaded-status', error.message, true); }
    });
    $('unmatched-file').addEventListener('change', async event => {
        try {
            const json = await readFile(event.currentTarget);
            if (!json) return;
            unmatched = Array.isArray(json) ? json : json.locations;
            if (!Array.isArray(unmatched)) throw new Error('Report must be an array or contain a locations array.');
            updateLoadedStatus();
            populateLocations();
        } catch (error) { setStatus('loaded-status', error.message, true); }
    });
    $('overrides-file').addEventListener('change', async event => {
        try {
            const json = await readFile(event.currentTarget);
            if (!json) return;
            overrides = Array.isArray(json) ? json : json.overrides;
            if (!Array.isArray(overrides)) throw new Error('Overrides must be an array or contain an overrides array.');
            updateLoadedStatus();
            updateOverrideCount();
            populateLocations();
        } catch (error) { setStatus('loaded-status', error.message, true); }
    });
    $('existing-manual-file').addEventListener('change', async event => {
        try {
            const json = await readFile(event.currentTarget);
            if (!json) return;
            if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw new Error('Manual boundaries must be a GeoJSON FeatureCollection.');
            if (json.features.some(feature => !feature || feature.type !== 'Feature' || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type))) {
                throw new Error('Every manual boundary must be a Polygon or MultiPolygon feature.');
            }
            manualFeatures = json.features;
            updateOverrideCount();
            setStatus('loaded-status', `${catalogLocations.length} catalog locations, ${unmatched.length} unmatched items, ${overrides.length} overrides, and ${manualFeatures.length} manual features loaded.`);
        } catch (error) { setStatus('loaded-status', error.message, true); }
    });
    const updateLoadedStatus = () => setStatus('loaded-status', `${catalogLocations.length} catalog locations, ${unmatched.length} unmatched items, and ${overrides.length} existing overrides loaded.`);
    function populateLocations() {
        const select = $('location-select');
        select.replaceChildren();
        if (!unmatched.length) {
            select.add(new Option('Load an unmatched report first', ''));
            select.disabled = true; $('save-override').disabled = true; return;
        }
        select.add(new Option('Choose an unmatched location…', ''));
        unmatched.forEach((item, index) => select.add(new Option(`${item.name || 'Unnamed'}${item.category ? ` · ${item.category}` : ''}${item.status ? ` · ${item.status}` : ''}`, String(index))));
        select.disabled = false;
        $('save-override').disabled = true;
    }
    const locationFor = item => {
        const same = catalogLocations.find(loc => item.id && loc.id === item.id && (!item.name || loc.name === item.name));
        return same || catalogLocations.find(loc => item.name && loc.name === item.name) || item;
    };
    $('location-select').addEventListener('change', () => {
        const index = $('location-select').value;
        selected = index === '' ? null : locationFor(unmatched[Number(index)]);
        pendingManual = null;
        resetDrawing();
        if (!selected && locationMarker) {
            map?.removeLayer(locationMarker);
            locationMarker = null;
        }
        $('manual-file').value = '';
        $('manual-status').textContent = '';
        $('save-override').disabled = !selected;
        $('location-details').textContent = selected ? `${selected.name || 'Unnamed'} · ${selected.category || 'Uncategorized'} · ${selected.tour || 'tour not specified'}${selected.year != null ? ` · year ${selected.year}` : ''}` : 'Choose a location to prepare a matching override.';
        loadSelectedOverride();
    });
    const findOverride = loc => overrides.find(row => (loc.id && row.locationId === loc.id) || (row.name && row.name.toLowerCase() === String(loc.name || '').toLowerCase()));
    function loadSelectedOverride() {
        const row = selected && findOverride(selected);
        $('aliases').value = Array.isArray(row?.aliases) ? row.aliases.join('\n') : '';
        $('hint-region').value = row?.hintRegion || '';
        $('year').value = row?.year ?? selected?.year ?? '';
        $('match-mode').value = row?.file ? 'manual' : row?.source === 'historical' ? 'historical' : 'alias';
        $('kind').value = row?.kind || '';
        updateMode();
    }
    function updateMode() {
        const manual = $('match-mode').value === 'manual';
        $('manual-file-wrap').classList.toggle('hidden', !manual);
        if (manual && selected) {
            initializeMap();
            centerMapOnSelected();
            setTimeout(() => map?.invalidateSize(), 0);
        }
    }
    $('match-mode').addEventListener('change', updateMode);
    function initializeMap() {
        if (map) return;
        if (!window.L) {
            setStatus('draw-status', 'The map library could not load. You can still upload a GeoJSON file instead.', true);
            $('draw-mode-button').disabled = true;
            $('upload-mode-button').click();
            return;
        }
        map = L.map('border-map', { worldCopyJump: true }).setView([20, 0], 2);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        }).addTo(map);
        map.on('click', event => {
            if (!isDrawing) return;
            drawingPoints.push(event.latlng);
            renderDraft();
            setStatus('draw-status', `${drawingPoints.length} points added. Keep tracing, undo the last point, or finish the shape.`);
        });
    }
    function centerMapOnSelected() {
        if (!map) return;
        if (locationMarker) map.removeLayer(locationMarker);
        const lat = selected?.lat == null || selected.lat === '' ? NaN : Number(selected.lat);
        const lng = selected?.lng == null || selected.lng === '' ? NaN : Number(selected.lng);
        if (Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180) {
            map.setView([lat, lng], 6);
            locationMarker = L.circleMarker([lat, lng], {
                radius: 7, color: '#fff', weight: 3, fillColor: '#d4a94f', fillOpacity: 1,
            }).addTo(map).bindTooltip(selected.name || 'Catalog location');
            setStatus('draw-status', `Centered on ${selected.name || 'the selected location'}. Zoom in and trace the boundary by clicking around its edge.`);
        } else {
            map.setView([20, 0], 2);
            setStatus('draw-status', 'This location has no coordinates in the catalog. Pan and zoom to the right place before tracing.');
        }
    }
    function renderDraft() {
        drawingMarkers.forEach(marker => map.removeLayer(marker));
        drawingMarkers = drawingPoints.map(point => L.circleMarker(point, {
            radius: 5, color: '#fff', weight: 2, fillColor: '#087f79', fillOpacity: 1,
        }).addTo(map));
        if (drawingLine) map.removeLayer(drawingLine);
        drawingLine = drawingPoints.length > 1
            ? L.polyline(drawingPoints, { color: '#087f79', weight: 3, dashArray: '7 5' }).addTo(map)
            : null;
        updateDrawControls();
    }
    function updateDrawControls() {
        $('start-drawing').disabled = isDrawing || !selected;
        $('undo-point').disabled = !drawingPoints.length || !isDrawing;
        $('finish-drawing').disabled = !isDrawing || drawingPoints.length < 3;
        $('clear-drawing').disabled = !drawingPoints.length && !pendingManual && !isDrawing;
        if (map) map.getContainer().style.cursor = isDrawing ? 'crosshair' : '';
    }
    function resetDrawing() {
        isDrawing = false;
        drawingPoints = [];
        drawingMarkers.forEach(marker => map?.removeLayer(marker));
        drawingMarkers = [];
        if (drawingLine) map?.removeLayer(drawingLine);
        if (drawnShape) map?.removeLayer(drawnShape);
        drawingLine = null;
        drawnShape = null;
        updateDrawControls();
    }
    $('draw-mode-button').addEventListener('click', () => {
        pendingManual = null;
        $('manual-file').value = '';
        resetDrawing();
        $('draw-mode-button').classList.add('active');
        $('upload-mode-button').classList.remove('active');
        $('draw-panel').classList.remove('hidden');
        $('manual-upload-wrap').classList.add('hidden');
        initializeMap();
        setTimeout(() => map?.invalidateSize(), 0);
    });
    $('upload-mode-button').addEventListener('click', () => {
        pendingManual = null;
        resetDrawing();
        $('upload-mode-button').classList.add('active');
        $('draw-mode-button').classList.remove('active');
        $('manual-upload-wrap').classList.remove('hidden');
        $('draw-panel').classList.add('hidden');
    });
    $('start-drawing').addEventListener('click', () => {
        if (!selected) return;
        pendingManual = null;
        resetDrawing();
        isDrawing = true;
        updateDrawControls();
        setStatus('draw-status', 'Click at least three points around the boundary. You can pan and zoom while drawing.');
    });
    $('undo-point').addEventListener('click', () => {
        drawingPoints.pop();
        renderDraft();
        setStatus('draw-status', drawingPoints.length ? `${drawingPoints.length} points remain.` : 'No points on the map. Click to add a point.');
    });
    $('finish-drawing').addEventListener('click', () => {
        if (drawingPoints.length < 3) return;
        const ring = drawingPoints.map(point => [point.lng, point.lat]);
        ring.push([...ring[0]]);
        pendingManual = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
        isDrawing = false;
        if (drawingLine) map.removeLayer(drawingLine);
        drawingLine = null;
        drawnShape = L.polygon(drawingPoints, { color: '#087f79', weight: 3, fillColor: '#0fa89a', fillOpacity: .24 }).addTo(map);
        updateDrawControls();
        setStatus('draw-status', `Shape ready with ${drawingPoints.length} points. Save this override to add it to the export.`);
        setStatus('manual-status', 'Map shape ready. Save this override to keep it in the working copy.');
    });
    $('clear-drawing').addEventListener('click', () => {
        pendingManual = null;
        resetDrawing();
        setStatus('draw-status', 'Shape cleared. Start drawing to trace a new one.');
        $('manual-status').textContent = '';
    });
    $('manual-file').addEventListener('change', async event => {
        try {
            const json = await readFile(event.currentTarget);
            if (!json) { pendingManual = null; return; }
            const features = json.type === 'Feature' ? [json] : json.type === 'FeatureCollection' ? json.features : [];
            if (features.length !== 1) throw new Error('Upload a GeoJSON Feature or a FeatureCollection containing exactly one feature.');
            const feature = features[0];
            if (!feature || feature.type !== 'Feature' || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) throw new Error('Manual borders must be Polygon or MultiPolygon features.');
            const coordinates = feature.geometry.coordinates;
            const polygons = feature.geometry.type === 'Polygon' ? [coordinates] : coordinates;
            if (!Array.isArray(polygons) || !polygons.length || polygons.some(polygon => !Array.isArray(polygon) || !polygon.length || polygon.some(ring => !Array.isArray(ring) || ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1])))) {
                throw new Error('Each polygon ring must contain at least four points and end at its starting point.');
            }
            const positions = [];
            const walk = node => {
                if (!Array.isArray(node)) throw new Error('Invalid GeoJSON coordinates.');
                if (typeof node[0] === 'number') {
                    if (node.length < 2 || !Number.isFinite(node[0]) || !Number.isFinite(node[1]) || Math.abs(node[0]) > 180 || Math.abs(node[1]) > 90) throw new Error('Coordinates must be valid longitude/latitude pairs.');
                    positions.push(node); return;
                }
                node.forEach(walk);
            };
            walk(coordinates);
            if (positions.length < 4) throw new Error('A polygon needs at least four coordinate positions.');
            pendingManual = feature;
            setStatus('manual-status', `Loaded one ${feature.geometry.type} with ${positions.length} positions. Verify the shape and source before exporting.`);
            $('draw-status').textContent = '';
            updateDrawControls();
        } catch (error) {
            pendingManual = null;
            setStatus('manual-status', error.message, true);
        }
    });
    $('save-override').addEventListener('click', async () => {
        try {
            await requireAccess();
            if (!selected) throw new Error('Choose a location first.');
            const mode = $('match-mode').value;
            const yearText = $('year').value.trim();
            const year = yearText === '' ? null : Number(yearText);
            if (mode === 'historical' && (!Number.isInteger(year) || !Number.isFinite(year))) throw new Error('Historical matches require an integer year; use a negative number for BCE.');
            if (mode === 'manual' && !pendingManual && !findOverride(selected)?.file) throw new Error('Upload one Polygon or MultiPolygon GeoJSON feature first.');
            const aliases = $('aliases').value.split(/[\\n,]/).map(value => value.trim()).filter(Boolean);
            const row = { ...(findOverride(selected) || {}) };
            if (selected.id) row.locationId = selected.id;
            row.name = selected.name || row.name || '';
            if (aliases.length) row.aliases = [...new Set(aliases)];
            else delete row.aliases;
            const hintRegion = $('hint-region').value.trim();
            if (hintRegion) row.hintRegion = hintRegion; else delete row.hintRegion;
            if (mode === 'historical') {
                row.source = 'historical'; row.year = year;
                delete row.file; delete row.featureIndex;
            } else if (mode === 'manual') {
                if (pendingManual) {
                    row.file = 'hero-manual-boundaries.geojson';
                    row.featureIndex = manualFeatures.length;
                    manualFeatures.push(pendingManual);
                    pendingManual = null;
                    resetDrawing();
                }
                if ($('kind').value) row.kind = $('kind').value;
                else delete row.kind;
                delete row.source; delete row.year;
            } else {
                delete row.source; delete row.year; delete row.file; delete row.featureIndex; delete row.kind;
            }
            const existingIndex = overrides.findIndex(item => (selected.id && item.locationId === selected.id) || (item.name && item.name.toLowerCase() === String(selected.name || '').toLowerCase()));
            if (existingIndex < 0) overrides.push(row); else overrides[existingIndex] = row;
            updateOverrideCount();
            setStatus('manual-status', 'Override saved in this tab. Download the files to keep it.');
        } catch (error) { setStatus('manual-status', error.message, true); }
    });
    const updateOverrideCount = () => {
        $('override-count').textContent = `${overrides.length} overrides ready; ${manualFeatures.length} manual GeoJSON features.`;
        $('download-overrides').disabled = !overrides.length;
        $('download-manual').disabled = !manualFeatures.length;
        updateDrawControls();
    };
    async function downloadFile(contents, name, type) {
        await requireAccess();
        const blob = new Blob([JSON.stringify(contents, null, 2)], { type });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = name; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('export-status', `Downloaded ${name}. Put it in content/ and run the local boundary build.`);
    }
    $('download-overrides').addEventListener('click', async () => {
        try { await downloadFile(overrides, 'location-boundary-overrides.json', 'application/json'); }
        catch (error) { setStatus('export-status', error.message, true); }
    });
    $('download-manual').addEventListener('click', async () => {
        try { await downloadFile({ type: 'FeatureCollection', features: manualFeatures }, 'hero-manual-boundaries.geojson', 'application/geo+json'); }
        catch (error) { setStatus('export-status', error.message, true); }
    });
    updateOverrideCount();
})();
