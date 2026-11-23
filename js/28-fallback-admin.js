// Admin editor for the lightweight peer-facing Hero map.
(() => {
  const $ = id => document.getElementById(id);
  const ref = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc('fallbackQuiz');
  let locations = [], savedSeparately = false, boundaryIndex = {}, boundaryReady = false;
  const status = (message, error = false) => {
    const el = $('fallback-admin-status');
    if (el) { el.textContent = message; el.classList.toggle('text-rose-500', error); el.classList.toggle('text-slate-500', !error); }
  };
  const cleanLocation = (item, index, ids = new Set()) => {
    const name = String(item?.name || '').trim().slice(0, 120);
    const lat = Number(item?.lat), lng = Number(item?.lng);
    if (!name || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error('Every place needs a name and valid latitude/longitude.');
    }
    let id = String(item.id || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    if (!id || ids.has(id)) id = 'fallback_' + Date.now().toString(36) + '_' + index.toString(36);
    ids.add(id);
    const out = { id, name, category: String(item.category || 'Places').trim().slice(0, 60), lat, lng };
    if (item.year !== undefined && item.year !== '') {
      const year = Number(item.year);
      if (!Number.isInteger(year) || year < -5000 || year > 2100) throw new Error('Historical years must be whole numbers from -5000 through 2100.');
      out.year = year;
    }
    for (const key of ['aliases', 'boundaryType', 'region', 'country', 'continent']) {
      if (Array.isArray(item[key])) out[key] = item[key].filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()).slice(0, 20);
      else if (typeof item[key] === 'string' && item[key].trim()) out[key] = item[key].trim().slice(0, 120);
    }
    return out;
  };
  const hasBorder = loc => {
    const entry = boundaryIndex['fallback:' + loc.id] || boundaryIndex['default:' + loc.id] || boundaryIndex[loc.id];
    return !!(entry && Array.isArray(entry.featureIds) && entry.featureIds.length);
  };
  function render() {
    const list = $('fallback-location-list'), json = $('fallback-json');
    if (!list || !json) return;
    $('fallback-admin-count').textContent = locations.length + (locations.length === 1 ? ' place' : ' places') + (savedSeparately ? ' · saved' : ' · 1 Year copy');
    const matched = locations.filter(hasBorder).length;
    $('fallback-border-count').textContent = boundaryReady ? matched + ' with borders · ' + (locations.length - matched) + ' without' : 'Checking border data…';
    json.value = JSON.stringify(locations, null, 2);
    list.replaceChildren();
    if (!locations.length) {
      const empty = document.createElement('p'); empty.className = 'py-5 text-center text-sm text-slate-500'; empty.textContent = 'No fallback places yet. Add a place or import a JSON list.'; list.append(empty); return;
    }
    locations.forEach((loc, index) => {
      const row = document.createElement('div'); row.className = 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800';
      const copy = document.createElement('div'); copy.className = 'min-w-0 flex-1';
      const title = document.createElement('div'); title.className = 'truncate text-sm font-bold text-slate-800 dark:text-slate-100'; title.textContent = loc.name;
      const detail = document.createElement('div'); detail.className = 'mt-0.5 text-[11px] text-slate-500'; detail.textContent = (loc.category || 'Places') + ' · ' + Number(loc.lat).toFixed(2) + ', ' + Number(loc.lng).toFixed(2) + (loc.year != null ? ' · ' + loc.year : '');
      copy.append(title, detail);
      const badge = document.createElement('span'); badge.className = 'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ' + (hasBorder(loc) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300');
      badge.textContent = boundaryReady ? (hasBorder(loc) ? 'Border' : 'No border') : '…';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20'; remove.setAttribute('aria-label', 'Remove ' + loc.name); remove.innerHTML = '<i data-lucide="x"></i>';
      remove.addEventListener('click', () => { locations.splice(index, 1); render(); });
      row.append(copy, badge, remove); list.append(row);
    });
    if (window.lucide) lucide.createIcons({ root: list });
  }
  async function load() {
    if (!db || !userId) return status('Waiting for secure steward sign-in…');
    try {
      status('Loading the fallback list…');
      const snap = await ref().get();
      savedSeparately = snap.exists;
      if (snap.exists) locations = (Array.isArray(snap.data().locations) ? snap.data().locations : []).map((loc, i, rows) => cleanLocation(loc, i, new Set(rows.slice(0, i).map(v => v.id))));
      else {
        const starter = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc('defaultQuiz').get();
        locations = starter.exists && Array.isArray(starter.data().locations) ? starter.data().locations.map((loc, i) => cleanLocation(loc, i)) : [];
      }
      status(savedSeparately ? 'Saved fallback list loaded. Changes here stay separate from the tours.' : 'Starter copy loaded from the 1 Year tour. Save it once to make the fallback list independent.');
      render();
    } catch (error) {
      console.error('Fallback locations could not load:', error);
      status('Could not load fallback locations (' + (error.code || error.message || 'error') + '). Unlock Steward access again and retry.', true);
    }
  }
  async function loadBoundaryIndex() {
    try {
      const response = await fetch('content/location-boundaries.geojson');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      boundaryIndex = (await response.json()).locations || {};
    } catch (error) { console.warn('Fallback border status unavailable:', error); }
    boundaryReady = true; render();
  }
  window.importFallbackJSON = () => {
    try {
      const parsed = JSON.parse($('fallback-json').value);
      if (!Array.isArray(parsed) || parsed.length > 500) throw new Error('Paste a JSON array with no more than 500 places.');
      locations = parsed.map((item, index, rows) => cleanLocation(item, index, new Set(rows.slice(0, index).map(v => v.id))));
      status('JSON loaded into the draft. Save the list when it looks right.');
      render();
    } catch (error) { status(error.message || 'That JSON list could not be loaded.', true); }
  };
  window.addFallbackLocation = () => {
    const item = { name: $('fallback-name').value, category: $('fallback-category').value, lat: $('fallback-lat').value, lng: $('fallback-lng').value, year: $('fallback-year').value };
    try {
      const loc = cleanLocation(item, locations.length);
      locations.push(loc); ['fallback-name','fallback-category','fallback-lat','fallback-lng','fallback-year'].forEach(id => { $(id).value = ''; });
      status(loc.name + ' added to the draft. Save the list to publish it to the fallback page.');
      render();
    } catch (error) { status(error.message, true); }
  };
  window.saveFallbackLocations = async () => {
    if (!adminToken) { status('Steward session is missing or expired. Sign in again.', true); return false; }
    try {
      const parsed = JSON.parse($('fallback-json').value);
      if (!Array.isArray(parsed) || parsed.length > 500) throw new Error('The location list must be a JSON array of up to 500 places.');
      locations = parsed.map((item, index, rows) => cleanLocation(item, index, new Set(rows.slice(0, index).map(v => v.id))));
      await ref().set({ locations, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      savedSeparately = true; status('Fallback locations saved. The peer page will use this list now.'); render(); return true;
    } catch (error) {
      console.error('Could not save fallback locations:', error);
      status(error.message && !error.code ? error.message : 'Could not save fallback locations (' + (error.code || 'error') + ').', true); return false;
    }
  };
  window.rebuildFallbackBorders = async () => {
    const saved = await window.saveFallbackLocations();
    if (!saved) return;
    status('Opening the border builder…');
    setAdminTab('quiz');
    setTimeout(() => { if (typeof rebuildBordersNow === 'function') rebuildBordersNow(); }, 80);
  };
  window.addEventListener('hero-admin-authenticated', load);
  window.addEventListener('hero-admin-locked', () => status('Unlock Steward access to edit the peer fallback.'));
  window.addEventListener('hero-auth-state', event => { if (event.detail?.isAdmin) load(); });
  loadBoundaryIndex();
})();
