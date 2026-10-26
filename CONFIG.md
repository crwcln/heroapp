# Configuration guide

Use this guide to find the right place for a setting. Public site settings live in source files; passwords, private keys, and deploy tokens belong only in EdgeOne environment variables.

## The first files to edit

| What you want to change | Where to change it |
| --- | --- |
| Site name, data namespace, version, tagline, intro film, or feature switches | [`js/00-site-config.js`](js/00-site-config.js) |
| Visitor message shown while Dev Mode is enabled | Admin panel → **Dev Mode** → Visitor construction message |
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
3. In Firebase Console, create Firestore, enable **Anonymous** under Authentication > Sign-in method, add the deployed domain to authorized domains, and publish `firestore.rules`. Keep student email/password and social sign-in providers disabled.
4. Set the EdgeOne environment variables below. Firebase Admin service-account values must belong to the same project as the browser config.

The Firebase web config is public browser configuration. It is not a service-account credential. Keep service-account private keys, admin passwords, GitHub tokens, and AI provider keys out of the repository and browser code.

## EdgeOne environment variables

Set these in the EdgeOne Pages project settings. Never commit real values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | Yes | Steward/admin sign-in and signing server-side admin sessions |
| `DEV_ACCESS` | Yes for early access | Unlocks the launch countdown and development mode controls; `DEV_PASSWORD` remains supported as a legacy fallback |
| `FIREBASE_CLIENT_EMAIL` | Yes for secure steward sign-in and push sending | Firebase service-account email |
| `FIREBASE_PRIVATE_KEY_1` … `FIREBASE_PRIVATE_KEY_N` | Yes for secure steward sign-in and push sending | Private key split into chunks no longer than 450 characters; one `FIREBASE_PRIVATE_KEY` value is also supported |
| `FIREBASE_API_KEY` | Yes for Clio | The public Firebase web API key from `js/02-firebase-config.js`; used by the server-side Firebase Auth verification request |
| `DEPLOY_WEBHOOK_URL` | Yes for redeploy | EdgeOne build/deploy webhook URL |
| `GITHUB_TOKEN` | Yes for redeploy | GitHub token with repository contents read/write access |
| `GITHUB_REPOSITORY` | Optional | Repository as `owner/name`; defaults to `crwcln/heroapp` |
| `DEPLOY_BRANCH` | Optional | Branch to commit to; defaults to `main` |
| `GEMINI_API_KEY` | Optional | Enables Clio AI |
| `FIREBASE_WEB_PUSH_VAPID_KEY` | Yes for push notifications | Public Web Push certificate key from Firebase Console → Project settings → Cloud Messaging → Web Push certificates |
| `FIREBASE_PROJECT_ID` | Recommended | Firebase project ID; used by the push sender when it cannot be derived from `FIREBASE_CLIENT_EMAIL` |
| `GEMINI_MODEL` | Optional | Overrides the model preference list in `edge-functions/api/chat.js` |
| `FLAPPY_TRIGGER`, `FLAPPY_BIRD_URL`, `FLAPPY_GRAVITY`, `FLAPPY_GAP` | Optional | Overrides for the Flappy Bird feature |

The Steward redeploy action creates an empty Git commit with the message entered in the panel, advances the configured branch, and asks EdgeOne to build it. A successful webhook response means the build request was accepted; check EdgeOne **Build & Deploy** for the final build result.

The construction-screen visitor message can be edited from the admin panel's **Dev Mode** card after unlocking it. Leave it blank to restore the default.

`edgeone.json` runs `npm run build` on each deployment. The build stamps every local JS/CSS URL with that file's content hash and gives each deployment a unique build ID. Open pages check the uncached HTML every 30 seconds and announce a new deployment before automatically reloading; users can choose **Not now** to stay on the current version. The HTML entry point is served with `no-store` so browsers receive the latest build ID and asset references. This is required because the site serves JavaScript with a one-year immutable browser cache policy. After publishing this change, verify the EdgeOne deployment log includes `Stamped ... local assets` and that `/js/00-site-config.js` has a versioned `?v=` URL in the deployed HTML.

Web push uses Firebase Cloud Messaging HTTP v1. Set `FIREBASE_WEB_PUSH_VAPID_KEY` to the **public** Web Push certificate key from Firebase Console > Project settings > Cloud Messaging > Web Push certificates. Publish the updated `firestore.rules` so guest browsers can save their own notification tokens.

To authorize the sender, open Google Cloud Console for the Firebase project used in `js/02-firebase-config.js` (currently `heroapp-cc053`), then go to **IAM & Admin > IAM > Grant access**. Add the service-account email stored in EdgeOne as `FIREBASE_CLIENT_EMAIL` (the `client_email` field in its JSON key). Grant **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`). This role includes `cloudmessaging.messages.create`; do not grant Owner.

The announcement endpoint also queries opted-in tokens in Firestore. Grant the same account **Cloud Datastore Viewer** (`roles/datastore.viewer`) so it can read the token documents. Expired-token deletion is best-effort with this read-only role. The roles are project-level; keep the service-account key only in EdgeOne secrets. Also enable **Firebase Cloud Messaging API** in Google Cloud Console > APIs & Services > Enabled APIs & services. The sender requests only the `firebase.messaging` and `datastore` OAuth scopes.

Users opt in under Settings ? Notifications. New announcements are sent to opted-in browsers; editing an announcement does not send a second alert. The sender reports separate errors for Firestore lookup and FCM send permissions, pointing to the IAM setting to check.

## No student accounts

Students do not create a username, password, or profile and do not enter an email address. Hero starts a Firebase Anonymous Authentication session automatically. The random guest ID exists only so Firebase can protect each browser's data and accept its scores; it is not a sign-in that students manage.

Guest progress, streaks, and push-notification preferences follow that browser's local Firebase session. Clearing the browser's site data or moving to another device creates a different guest ID, so progress does not transfer or have account recovery. Existing Firebase Auth users and old Firestore records are left untouched; the site signs old non-steward sessions out and starts a guest session instead.

Legacy leaderboards included player names, so those old collections are now steward-only. The Hall of Heroes, Daily Challenge, and Flappy Bird now use guest-only collections and will start with no scores; legacy rows are preserved, not deleted.

## Project layout

- `index.html` contains page markup and loads the scripts in order.
- `js/NN-feature.js` contains browser features; `00` files are configuration and shared setup.
- `css/` contains stylesheets; rebuild generated Tailwind output with `npm run build:css` after changing Tailwind inputs.
- `edge-functions/api/` contains server-side EdgeOne endpoints. Secrets are read from `context.env` here.
- `firestore.rules` defines database permissions and must be published to the active Firebase project.
- `scripts/bump-version.js` and `npm run release:patch|minor|major` update the site and package versions.
- Run `npm run setup:git-hooks` once per clone to prefix VS Code/Git commit subjects with the version in `js/00-site-config.js`.
