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
Students can connect from the Canvas tab with their Canvas school URL and a personal access token. Requests pass through Hero's same-origin EdgeOne relay to avoid browser CORS failures; the token remains in `sessionStorage`, is forwarded only to the student's Canvas host, and is not persisted by Hero or stored in Firestore. `*.instructure.com` hosts are allowed by default. For a school's custom Canvas domain, add its exact hostname to the optional `CANVAS_ALLOWED_HOSTS` EdgeOne setting. Schools can still disable personal access tokens or restrict API access; a school-approved OAuth developer key is the right next step if those restrictions apply.
Clio only receives a short Canvas summary when the student checks the Canvas sharing option in the chat.
