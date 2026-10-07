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
