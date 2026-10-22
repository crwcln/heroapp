# Curated map boundaries

Hero now loads map outlines from `content/location-boundaries.geojson`; the browser does not fetch boundary data from a CDN.

1. Sign in as a steward and open the quiz editor.
2. For historical entries, enter a year in the per-location Year field (negative values mean BCE). Save/deploy the quiz locations.
3. Choose **Export boundary build catalog**. It downloads both shared tour lists; it contains no account records.
4. From the repository root, run `npm run build:boundaries -- "C:\\path\\to\\location-catalog.json"`.
5. Review `content/location-boundaries-unmatched.json`. Add aliases, historical years, or a hand-traced GeoJSON feature in `content/location-boundary-overrides.json`, then rebuild.

For a guided local helper, deploy the unlinked `/border-studio.html` page and configure `BORDER_TOOL_PASSWORD` in EdgeOne. Import the catalog, unmatched report, and existing overrides; prepare alias/year matches or draw a Polygon on the map; then download the files. A GeoJSON upload remains available for existing Polygon or MultiPolygon features. The selected files are processed locally and are not uploaded to Hero. The map uses OpenStreetMap tiles, and the page loads the site's web fonts and Leaflet library from their public CDNs. Review each generated shape before deploying.

The build selects matching features from Natural Earth v5.1.2 at 1:10m scale for countries, admin-1 provinces/states, lakes, marine areas, rivers, and geographic regions. Natural Earth is public domain. It downloads only during this build; the generated matched shapes are what the site ships.

Historical polygons come from `aourednik/historical-basemaps`. The build uses the closest year in that project's index for each location's `year`. These boundaries are a work in progress and should be reviewed; the selected source year is recorded in the bundle and any non-exact year is flagged.

Overrides can provide a direct GeoJSON file for features such as trade routes that are not in the source datasets:

```json
[
  {
    "locationId": "silk-road-id",
    "file": "manual/silk-road.geojson",
    "featureIndex": 0,
    "kind": "route",
    "hintRegion": "Central Asia"
  }
]
```

The sample `content/location-boundaries.geojson` is an empty starter bundle until the steward catalog is exported and the build command runs. Locations that match only by containing province/country still get a useful contextual outline and appear in the review report.
