# Hero

**Duplicating this repo?** change `SITE.id` in `js/00-site-config.js` so each copy has its own data.


Static site (EdgeOne Pages) + Firebase + EdgeOne Edge Functions.

    index.html          markup
    css/styles.css      all styles (themes, animations, components)
    js/NN-*.js          scripts, loaded in order (00s = setup, later = features)
    edge-functions/api  auth, deploy, firebase-token, chat
    firestore.rules     paste into Firebase console -> Firestore -> Rules

## EdgeOne environment variables (each value max 500 bytes)
ADMIN_PASSWORD, DEV_PASSWORD, DEPLOY_WEBHOOK_URL, FIREBASE_CLIENT_EMAIL,
FIREBASE_PRIVATE_KEY_1..N (private key split in <=450-char chunks), GEMINI_API_KEY, optional GEMINI_MODEL.

Config checks (no secrets shown): open /api/firebase-token and /api/chat in a browser.

## Firebase project checklist (after switching projects)
Web config in `js/02-firebase-config.js` and the service account behind `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY_n` must be from the **same** Firebase project. Enable Anonymous sign-in and Email/Password > Email link sign-in, create Firestore, publish `firestore.rules`, and add your site domain under Authentication > Settings > Authorized domains. Open `/api/firebase-token` to see which project the service account belongs to.

Visitors can optionally verify an email link and add a name. This links that verified identity to the browser ID for steward moderation. Automatic browser error reports collect uncaught JavaScript exceptions and unhandled promise rejections only after analytics consent; they do not identify visual or logical bugs automatically.

## Intro film
First visit: no loader, the page stays dark, then the intro plays. Put your MP4 in `media/` and set `introVideo` in `js/00-site-config.js`. Bump `intro` to show it again to everyone.

## Announcements
Post from Stewards -> Site -> Announcements. The newest one pops up once per browser, then lives on the Announcements page and the sidebar bell.
