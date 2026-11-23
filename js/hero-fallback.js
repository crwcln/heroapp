// Small, focused Hero map for visitors while the full site is in construction mode.
(() => {
  const $ = id => document.getElementById(id);
  const say = (message, error = false) => {
    const node = $('status'); node.textContent = message; node.style.color = error ? '#f2c4b6' : '';
  };
  const appId = window.__app_id || 'hero-2026';
  let map, boundaryIndex = {}, boundaryFeatures = {}, locations = [], order = [], current = 0, found = 0, hoverLayers = [], solvedLayers = [], solvedIds = new Set();
  const markers = new Map();
  const readDoc = name => firebase.firestore().collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc(name).get();
  function startMap() {
    map = L.map('map', { worldCopyJump: true, minZoom: 2, maxZoom: 12, zoomControl: true }).setView([23, 5], 2.3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    map.createPane('heroFallbackBorders').style.zIndex = '620';
  }
  function locEntry(loc) {
    return boundaryIndex['fallback:' + loc.id] || boundaryIndex['default:' + loc.id] || boundaryIndex[loc.id] || null;
  }
  function clearPreview() {
    hoverLayers.forEach(layer => map.removeLayer(layer));
    hoverLayers = [];
  }
  function showBoundary(loc, persistent = false) {
    const entry = locEntry(loc);
    const features = (entry?.featureIds || []).map(id => boundaryFeatures[id]).filter(Boolean);
    if (!features.length) return false;
    if (!persistent) clearPreview();
    const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
      pane: 'heroFallbackBorders',
      interactive: false,
      style: { color: '#e2bf4d', weight: 2.4, opacity: .95, fillColor: '#d8b84f', fillOpacity: .2, lineCap: 'round', lineJoin: 'round' }
    }).addTo(map);
    if (persistent) { solvedIds.add(String(loc.id)); solvedLayers.push(layer); }
    else hoverLayers.push(layer);
    return true;
  }
  function paintProgress() {
    $('found').textContent = found + ' / ' + locations.length;
    $('round-label').textContent = 'Place ' + Math.min(current + 1, order.length) + ' of ' + order.length;
  }
  function nextPlace() {
    clearPreview();
    current++;
    if (current >= order.length) {
      $('question').textContent = 'You explored the whole map.';
      say(found + ' places found. Start another round whenever you like.');
      $('next').textContent = 'Play again'; $('next').hidden = false;
      $('next').onclick = beginRound;
      $('round-label').textContent = 'Round complete';
      return;
    }
    const target = order[current];
    $('question').textContent = 'Find ' + target.name;
    $('next').hidden = true;
    say('Tap its dot on the map. Hover over a dot to preview its border.');
    paintProgress();
  }
  function buildMarkers() {
    locations.forEach(loc => {
      const marker = L.marker([Number(loc.lat), Number(loc.lng)], {
        icon: L.divIcon({ className: '', html: '<span class="marker"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        title: loc.name,
        keyboard: true,
        riseOnHover: true
      }).addTo(map);
      markers.set(String(loc.id), marker);
      marker.on('mouseover', () => { if (!solvedIds.has(String(loc.id))) showBoundary(loc); });
      marker.on('mouseout', () => clearPreview());
      marker.on('click', () => {
        const target = order[current];
        if (!target) return;
        if (String(target.id) !== String(loc.id)) {
          say('That is ' + loc.name + '. Keep looking for ' + target.name + '.');
          return;
        }
        const element = marker.getElement()?.querySelector('.marker');
        if (element) element.classList.add('solved');
        const hasBorder = showBoundary(loc, true);
        found++; paintProgress();
        if (current === order.length - 1) {
          $('question').textContent = 'You found ' + loc.name + '.';
          say(hasBorder ? 'Its border is now marked on the map.' : 'Found! Its border is not in the map data yet.');
          $('next').textContent = 'Finish round'; $('next').hidden = false;
        } else {
          $('question').textContent = 'You found ' + loc.name + '.';
          say(hasBorder ? 'Its border is marked. Continue to the next place.' : 'Found! No saved border for this place yet. Continue to the next one.');
          $('next').textContent = 'Next place'; $('next').hidden = false;
        }
      });
    });
    $('next').onclick = nextPlace;
  }
  function beginRound() {
    solvedLayers.forEach(layer => map.removeLayer(layer)); solvedLayers = [];
    clearPreview();
    order = [...locations].sort(() => Math.random() - .5);
    current = 0; found = 0; solvedIds = new Set();
    markers.forEach(marker => marker.getElement()?.querySelector('.marker')?.classList.remove('solved'));
    $('next').hidden = true;
    $('next').onclick = nextPlace;
    paintProgress();
    $('question').textContent = order.length ? 'Find ' + order[0].name : 'No locations are set up yet.';
    say(order.length ? 'Tap its dot on the map. Hover over a dot to preview its border.' : 'A steward can add locations in Admin → Fallback.');
    $('round-label').textContent = order.length ? 'Place 1 of ' + order.length : 'Map practice';
  }
  async function loadData() {
    try {
      if (!window.__firebase_config) throw new Error('Firebase settings are unavailable.');
      const config = JSON.parse(window.__firebase_config);
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
      const auth = app.auth(), db = app.firestore();
      const user = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Guest sign-in timed out.')), 10000);
        auth.onAuthStateChanged(async currentUser => {
          if (currentUser) { clearTimeout(timeout); resolve(currentUser); }
          else {
            try { await auth.signInAnonymously(); }
            catch (error) { clearTimeout(timeout); reject(error); }
          }
        }, error => { clearTimeout(timeout); reject(error); });
      });
      if (!user) throw new Error('Could not open a guest map session.');
      const [fallback, main, boundaryResponse] = await Promise.all([
        readDoc('fallbackQuiz'), readDoc('defaultQuiz'), fetch('content/location-boundaries.geojson')
      ]);
      if (!boundaryResponse.ok) throw new Error('The Hero border bundle could not be loaded (HTTP ' + boundaryResponse.status + ').');
      const boundaryData = await boundaryResponse.json();
      boundaryIndex = boundaryData.locations || {};
      boundaryFeatures = Object.fromEntries((boundaryData.features || []).map(feature => [feature.id || feature.properties?.heroBoundaryId, feature]));
      const separate = fallback.exists && Array.isArray(fallback.data().locations);
      const source = separate ? fallback.data().locations : (main.exists && Array.isArray(main.data().locations) ? main.data().locations : []);
      locations = source.filter(loc => loc && typeof loc.name === 'string' && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng)))
        .map((loc, index) => ({ ...loc, id: String(loc.id || 'fallback-' + index), tour: separate ? 'fallback' : 'default' }));
      $('source-note').textContent = separate ? 'Using the Steward-managed fallback location list.' : 'Using the 1 Year locations until a separate fallback list is saved.';
      if (!separate && !locations.length) throw new Error('No saved locations were found. A steward can add them in Admin → Fallback.');
      startMap(); buildMarkers(); beginRound();
    } catch (error) {
      console.error('Hero fallback could not start:', error);
      $('question').textContent = 'The map could not open.';
      say(error.code === 'permission-denied' ? 'The map data is not available to guests. Check the Firebase public read rules.' : (error.message || 'Check your connection and reload.'), true);
      $('round-label').textContent = 'Map unavailable';
    }
  }
  $('next').addEventListener('click', nextPlace);
  loadData();
})();
