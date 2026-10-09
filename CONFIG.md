# Configuration guide

Use this guide to find the right place for a setting. Public site settings live in source files; passwords, private keys, and deploy tokens belong only in EdgeOne environment variables.

## The first files to edit

| What you want to change | Where to change it |
| --- | --- |
| Site name, data namespace, version, tagline, intro film, or feature switches | [`js/00-site-config.js`](js/00-site-config.js) |
| Firebase browser app/project | [`js/02-firebase-config.js`](js/02-firebase-config.js) |
| Colors, fonts, or visual theme | [`css/night.css`](css/night.css), [`tailwind.config.js`](tailwind.config.js), and [`css/styles.css`](css/styles.css) |
| Navigation labels and page layout | [`index.html`](index.html) |
| Historical quotes | [`js/00-quotes.js`](js/00-quotes.js) |
| Intro scenes and loading facts | [`js/13-intro.js`](js/13-intro.js) and [`js/08-settings-cookies.js`](js/08-settings-cookies.js) |
| Hidden Lost Legends places | [`js/14-secret.js`](js/14-secret.js) |
| Flappy Bird tuning defaults | [`js/16-flappy-bird.js`](js/16-flappy-bird.js) |
| Firebase database access | [`firestore.rules`](firestore.rules) |

## When duplicating the site

1. In `js/00-site-config.js`, choose a unique `id` and set the site's `name` and other display settings. The `id` separates this site's Firestore records from other copies using the same database.
2. In `js/02-firebase-config.js`, use the web app values from the Firebase project for this copy.
3. In Firebase Console, create Firestore, enable the sign-in methods used by the site, add the deployed domain to authorized domains, and publish `firestore.rules`.
4. Set the EdgeOne environment variables below. Firebase Admin service-account values must belong to the same project as the browser config.

The Firebase web config is public browser configuration. It is not a service-account credential. Keep service-account private keys, admin passwords, GitHub tokens, and AI provider keys out of the repository and browser code.

## EdgeOne environment variables

Set these in the EdgeOne Pages project settings. Never commit real values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Yes | Steward/admin sign-in and signing server-side admin sessions |
| `DEV_PASSWORD` | Yes | Unlocks development mode controls |
| `FIREBASE_CLIENT_EMAIL` | Yes for secure admin sign-in | Firebase service-account email |
| `FIREBASE_PRIVATE_KEY_1` … `FIREBASE_PRIVATE_KEY_N` | Yes for secure admin sign-in | Private key split into chunks no longer than 450 characters; one `FIREBASE_PRIVATE_KEY` value is also supported |
| `DEPLOY_WEBHOOK_URL` | Yes for redeploy | EdgeOne build/deploy webhook URL |
| `GITHUB_TOKEN` | Yes for redeploy | GitHub token with repository contents read/write access |
| `GITHUB_REPOSITORY` | Optional | Repository as `owner/name`; defaults to `crwcln/heroapp` |
| `DEPLOY_BRANCH` | Optional | Branch to commit to; defaults to `main` |
| `GEMINI_API_KEY` | Optional | Enables Clio AI |
| `GEMINI_MODEL` | Optional | Overrides the model preference list in `edge-functions/api/chat.js` |
| `FLAPPY_TRIGGER`, `FLAPPY_BIRD_URL`, `FLAPPY_GRAVITY`, `FLAPPY_GAP` | Optional | Overrides for the Flappy Bird feature |

The Steward redeploy action creates an empty Git commit with the message entered in the panel, advances the configured branch, and asks EdgeOne to build it. A successful webhook response means the build request was accepted; check EdgeOne **Build & Deploy** for the final build result.

## Project layout

- `index.html` contains page markup and loads the scripts in order.
- `js/NN-feature.js` contains browser features; `00` files are configuration and shared setup.
- `css/` contains stylesheets; rebuild generated Tailwind output with `npm run build:css` after changing Tailwind inputs.
- `edge-functions/api/` contains server-side EdgeOne endpoints. Secrets are read from `context.env` here.
- `firestore.rules` defines database permissions and must be published to the active Firebase project.
- `scripts/bump-version.js` and `npm run release:patch|minor|major` update the site and package versions.
