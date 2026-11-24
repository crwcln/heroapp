window.HeroMap = (() => {
  const TILES = [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community' },
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' },
    { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> | Tiles <a href="https://www.openstreetmap.fr/">OpenStreetMap France</a> / <a href="https://www.hotosm.org/">HOT</a>' }
  ];
  function createMap(elementId) {
    const map = L.map(elementId, { worldCopyJump: true, minZoom: 2, maxZoom: 14, zoomControl: false }).setView([25, 20], 2.5);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    return map;
  }
  function addTileLayer(map, index) {
    const tile = TILES[((index % TILES.length) + TILES.length) % TILES.length];
    return L.tileLayer(tile.url, { attribution: tile.attribution }).addTo(map);
  }
  function cycleTileLayer(map, currentLayer, index) {
    if (currentLayer) map.removeLayer(currentLayer);
    const next = (index + 1) % TILES.length;
    return { layer: addTileLayer(map, next), index: next };
  }
  function markerIcons() {
    return {
      unsolved: L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-pin unsolved'></div>", iconSize: [26, 26], iconAnchor: [13, 13] }),
      solved: L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-pin solved'></div>", iconSize: [26, 26], iconAnchor: [13, 13] })
    };
  }
  function kind(loc) {
    const text = ((loc && loc.name) + ' ' + ((loc && loc.category) || '')).toLowerCase();
    if (loc && loc.year != null && loc.year !== '' && Number.isInteger(Number(loc.year))) return 'empire';
    if (/empire|kingdom|dynasty|caliphate|sultanate|ancient|historic/.test(text)) return 'empire';
    if (/route|road|trade|silk/.test(text)) return 'route';
    if (/river|stream/.test(text)) return 'river';
    if (/lake|reservoir/.test(text)) return 'lake';
    if (/sea|ocean|gulf|bay|strait|canal|channel|current|marine/.test(text)) return 'water';
    return 'land';
  }
  function boundaryPane(map, name, zIndex) {
    let pane = map.getPane(name);
    if (!pane) {
      pane = map.createPane(name);
      pane.style.zIndex = String(zIndex);
      pane.style.pointerEvents = 'none';
    }
    return pane;
  }
  function boundaryLayers(map, features, paneName, kindName) {
    const collection = { type: 'FeatureCollection', features };
    return ['hl-halo', 'hl-glow', 'hl-outline', 'hl hl-' + kindName].map(className =>
      L.geoJSON(collection, { pane: paneName, style: () => ({ className }), interactive: false }).addTo(map));
  }
  function ringLayers(map, loc, paneName) {
    if (!Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lng))) return [];
    return [0, 180].map(delay => {
      const ring = L.circleMarker([Number(loc.lat), Number(loc.lng)], {
        pane: paneName, radius: 9, className: 'hl-radiate',
        interactive: false, bubblingMouseEvents: false
      }).addTo(map);
      ring.getElement()?.style.setProperty('--hl-radiate-delay', `${delay}ms`);
      return ring;
    });
  }
  function clearLayers(map, layers) {
    layers.forEach(layer => map.removeLayer(layer));
  }
  return { TILES, createMap, addTileLayer, cycleTileLayer, markerIcons, kind, boundaryPane, boundaryLayers, ringLayers, clearLayers };
})();
