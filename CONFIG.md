# Hero configuration guide

Use this page to find where a setting or piece of content is maintained. This is a reference guide; you do not need to edit this file when changing the site.

## Quick reference

| To change… | Edit… |
|---|---|
| Site name, version, tagline, or enabled features | `js/00-site-config.js` — top block |
| Colors, fonts, or background style | `css/night.css` (`:root` for light mode, `html.dark` for dark mode), then `tailwind.config.js`; rebuild with `npm run build:css` |
| Navigation labels (such as “Hall of Heroes”) | Matching text in `index.html` (desktop navigation and mobile tab bar) |
| Historical quotes | `js/00-quotes.js` — add `{ t, a }` entries; keep entries that are already in use |
| Flappy Bird image, trigger phrase, pipe gap, or gravity | Environment variables in `edge-functions/api/config.js`; see that file’s opening comment |
| Hidden “Lost Legends” places | `js/14-secret.js` — `LEGENDS` array |
| Loading screen text or facts | `js/13-intro.js` — `INTRO_SCENES` for the film; `js/08-settings-cookies.js` — `FACTS` |
| Admin/developer passwords, deploy webhook, GitHub deploy token, or Firebase/Gemini keys | EdgeOne project environment variables; never put these in source code |
| A new theme colorway | Follow the `THEMES` generator notes, using `js/00-site-config.js` as a guide; request a new colorway by name if needed |

## General rule

Numbers, text, and feature toggles usually belong in `js/00-site-config.js`. Other functionality is organized by feature in `js/`, with one file per feature named `NN-feature-name.js`, so related changes stay together.
