# Where to change things in Hero

This file is a map, not code. Nothing here needs editing itself.

| I want to change... | Edit this file |
|---|---|
| Site name, version number, tagline, which features are on | `js/00-site-config.js` (top block only) |
| Colors, fonts, background style | `css/night.css` (`:root` = light, `html.dark` = dark) + `tailwind.config.js` then `npm run build:css` |
| Nav labels ("Hall of Heroes" etc.) | the matching text in `index.html` (nav + mobile tab bar) |
| Historical quotes | `js/00-quotes.js` -- just add more `{ t, a }` lines, never remove in-use ones |
| Flappy Bird: bird image, trigger phrase, pipe gap, gravity | `edge-functions/api/config.js` (env vars) -- see that file's top comment |
| The hidden "Lost Legends" places | `js/14-secret.js` -> the `LEGENDS` array |
| Admin password, dev password, deploy webhook, Firebase/Gemini keys | EdgeOne project environment variables (never in code) |
| Loading screen text, facts | `js/13-intro.js` -> `INTRO_SCENES` (the film) / `js/08-settings-cookies.js` -> `FACTS` |
| New theme colorway | `js/00-site-config.js`-style block: see `THEMES` in the generator notes, or ask for a new one by name |

General rule: **numbers, text and toggles belong in `js/00-site-config.js`**; everything else is grouped by
feature (one file per feature in `js/`, named `NN-feature-name.js`) so a change stays inside one file.
