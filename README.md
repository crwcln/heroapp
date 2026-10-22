# Hero

Hero is a map-based history quiz built as a static site with Firebase and EdgeOne serverless functions.

## Start here

- Read [`CONFIG.md`](CONFIG.md) for the configuration map, deployment variables, and project layout.
- Edit [`js/00-site-config.js`](js/00-site-config.js) for the site name, version, data namespace, tagline, intro, and feature flags.
- Edit [`js/02-firebase-config.js`](js/02-firebase-config.js) for the public Firebase web app configuration.
- Paste [`firestore.rules`](firestore.rules) into the matching Firebase project's Firestore Rules page and publish it.
- Read [`content/BOUNDARIES.md`](content/BOUNDARIES.md) to export the quiz catalog and build the bundled 10m map boundaries.

## Project structure

| Path | Contents |
| --- | --- |
| `index.html` | Site markup and script loading order |
| `js/` | Browser code, split by feature |
| `css/` | Site styles and generated Tailwind CSS |
| `edge-functions/api/` | EdgeOne server endpoints; private keys are read from environment variables |
| `scripts/` | Versioning and maintenance scripts |
| `firestore.rules` | Firestore access rules |

## Deploy and secrets

Deploy through EdgeOne Pages. Put admin passwords, Firebase service-account private keys, GitHub tokens, webhook URLs, and the Gemini key in EdgeOne environment variables. Do not commit them or include them in browser JavaScript. The Firebase web config is public by design; Firestore rules and Firebase project settings enforce access.

See [`CONFIG.md`](CONFIG.md) for the full environment variable list, including the GitHub token required by the Steward redeploy feature.

## Version and CSS

- `npm run release:patch`, `npm run release:minor`, or `npm run release:major` updates the site and package version.
- Run `npm run setup:git-hooks` once per clone. VS Code commits then get a `v<version>:` prefix from `SITE.version` in `js/00-site-config.js`; any message you type is kept after the prefix.
- `npm run build:css` rebuilds `css/tailwind.css` from `tailwind.input.css` and `tailwind.config.js`.

## Clio (AI chat) requires a signed-in account
`/api/chat` now verifies the caller's Firebase ID token server-side before it will spend Gemini quota, so it
can't be called anonymously from outside the site. In addition to `GEMINI_API_KEY`, set:

    FIREBASE_API_KEY = the same "apiKey" value already in js/02-firebase-config.js

It isn't a secret (Firebase web API keys are public by design), but the edge function needs its own copy
since environment variables aren't readable from the browser bundle.

Email verification is not required to use Hero. Shared Firestore features still require a non-anonymous Hero account.

## Canvas dashboard
Students can connect from the Canvas tab with their Canvas school URL and a personal access token. Requests pass through Hero's same-origin EdgeOne relay to avoid browser CORS failures; the token and school URL remain in page memory only and are cleared on refresh, sign-out, or account change. The in-memory dashboard data and rendered Canvas content are cleared when navigating away from the Canvas tab. The relay forwards read-only requests to the student's Canvas host; the application code does not write credentials or Canvas responses to Firestore. Canvas details are not automatically sent to Clio. `*.instructure.com` hosts are allowed by default. For a school's custom Canvas domain, add its exact hostname to the optional `CANVAS_ALLOWED_HOSTS` EdgeOne setting. Schools can still disable personal access tokens or restrict API access; a school-approved OAuth developer key is the right next step if those restrictions apply.

## Site maintenance and border helper
The construction-page message can be customized in the admin panel's **Dev Mode** card. Leave the field blank to restore its default.

The unlinked `/border-studio.html` page helps prepare Natural Earth aliases, historical years, and manual GeoJSON overrides. Configure a unique `BORDER_TOOL_PASSWORD` of at least 20 characters in EdgeOne. The page processes selected files locally and only downloads the resulting files; it does not write to GitHub, Firestore, or the live site. Its source code is public, and the password is not a substitute for EdgeOne WAF/rate limiting. See [`content/BOUNDARIES.md`](content/BOUNDARIES.md) for the build/review workflow.
