# Hero

Hero is a map-based history quiz built as a static site with Firebase and EdgeOne serverless functions.

## Start here

- Read [`CONFIG.md`](CONFIG.md) for the configuration map, deployment variables, and project layout.
- Edit [`js/00-site-config.js`](js/00-site-config.js) for the site name, version, data namespace, tagline, intro, and feature flags.
- Edit [`js/02-firebase-config.js`](js/02-firebase-config.js) for the public Firebase web app configuration.
- Paste [`firestore.rules`](firestore.rules) into the matching Firebase project's Firestore Rules page and publish it.

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
