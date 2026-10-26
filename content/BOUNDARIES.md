# Curated map boundaries

Hero loads map outlines from `content/location-boundaries.geojson`; visitors' browsers do not fetch boundary datasets from a CDN.

## Server button (works on a Chromebook)

After the one-time setup below, a steward can open the Quiz tab and click **Rebuild borders now**. The server reads both live tours from Firestore, matches locations against map data, commits the boundary bundle and review list to GitHub in one commit, then asks EdgeOne to deploy. A summary appears in the panel with matches and locations that need a year or a closer look.

The server builder uses Natural Earth v5.1.2 at 1:50m scale for countries, states/provinces, lakes, marine areas, rivers, and geographic regions. Natural Earth is public domain. Historical polygons come from `aourednik/historical-basemaps`; the nearest available year is selected for each historical location's `year`, and non-exact years are flagged. Historical outlines are a work in progress and should be reviewed.

### One-time setup (from a computer)

1. Deploy `edge-functions/api/build-boundaries.js` to the EdgeOne project.
2. In Google Cloud Console, grant the Firebase service account in `FIREBASE_CLIENT_EMAIL` the **Cloud Datastore Viewer** role (`roles/datastore.viewer`) on the Firebase project. This endpoint only reads quiz data, so the read-only role is sufficient.
3. Confirm EdgeOne has `ADMIN_PASSWORD`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY_1..N`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and `DEPLOY_WEBHOOK_URL`. Set `FIREBASE_PROJECT_ID` if it cannot be derived from the service-account email. The GitHub token needs contents read/write access.

The button reports missing settings and Firestore, GitHub, or deploy-hook errors. If the GitHub commit succeeds but EdgeOne rejects the deploy hook, the panel shows the commit ID and tells the steward to start a deployment from EdgeOne.

The rebuild runs in one server request. If EdgeOne returns a timeout, check GitHub for a new commit and EdgeOne's deployment page before retrying; the platform's function time limit may require splitting very large location sets into smaller builds.

## Local full-detail build

The CLI remains available from a computer for Natural Earth 1:10m detail:

1. Sign in as a steward and open the quiz editor.
2. Choose **Export boundary build catalog**. It downloads both live tours; it contains no account records.
3. From the repository root, run `npm run build:boundaries -- "C:\\path\\to\\location-catalog.json"`.
4. Review `content/location-boundaries-unmatched.json`, update overrides as needed, then rebuild.

The CLI uses Natural Earth v5.1.2 at 1:10m scale. It downloads map data only during the build; the generated matched shapes are what the site ships.

## Overrides and review

Add aliases or historical years in `content/location-boundary-overrides.json`. Hand-traced features for things such as trade routes can be stored as GeoJSON under `content/manual/` and referenced by an override:

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

Locations that only match a containing province or country receive a contextual outline and appear in the review list. Each server rebuild commits the list to `content/location-boundaries-unmatched.json`.
