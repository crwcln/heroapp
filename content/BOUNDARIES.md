# Curated map boundaries

Hero now loads map outlines from `content/location-boundaries.geojson`; the browser does not fetch boundary data from a CDN.

1. Sign in as a steward and open the quiz editor.
2. For historical entries, enter a year in the per-location Year field (negative values mean BCE). Save/deploy the quiz locations.
3. Choose **Export boundary build catalog**. It downloads both shared tour lists; it contains no account records.
4. From the repository root, run `npm run build:boundaries -- "C:\\path\\to\\location-catalog.json"`.
5. Review `content/location-boundaries-unmatched.json`. Add aliases, historical years, or a hand-traced GeoJSON feature in `content/location-boundary-overrides.json`, then rebuild.

## Build and publish from your browser

1. In the site's steward quiz editor, choose **Export boundary build catalog**.
2. Open `/border-studio.html`, enter the Border Studio password, and load the downloaded catalog JSON.
3. To build automatic matches, choose **Build and publish boundaries**. No terminal or local build command is needed. GitHub runs the boundary matcher, commits `content/location-boundaries.geojson` and `content/location-boundaries-unmatched.json`, and then triggers an EdgeOne deployment.
4. Watch the status on the page or open its GitHub Actions link. When complete, inspect `content/location-boundaries-unmatched.json` in GitHub for locations that need more help.
5. For a manual correction, load the unmatched report and existing overrides, select the location, add a Natural Earth alias or historical year, or draw/upload a Polygon. Load existing manual GeoJSON before editing it so its features are preserved. Then publish again.

To enable this browser workflow, configure `BORDER_TOOL_PASSWORD`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and (if needed) `DEPLOY_BRANCH` in EdgeOne. The GitHub token needs repository contents read/write and Actions workflow-dispatch permissions. Add the GitHub Actions repository secret `EDGEONE_DEPLOY_WEBHOOK_URL` with the same EdgeOne deploy webhook URL as `DEPLOY_WEBHOOK_URL`. Make sure branch protection allows GitHub Actions to push the generated boundary files.

The catalog and any loaded overrides/manual shapes are committed to the configured GitHub branch; this is a real publish action, not just a local preview. The map uses OpenStreetMap tiles, and the page loads web fonts and Leaflet from public CDNs. Automatic and historical matches can be wrong, so review the generated map and unmatched report after the deploy.

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
