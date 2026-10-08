# HERO: 60-second trailer, Remotion build brief (for Codex in VS Code)

> Paste this whole file into Codex as the task, or save it as `AGENTS.md` in the Remotion project root.
> **Goal:** a 1920x1080, 30 fps, **1800-frame (60.0 s)** promo trailer for **Hero**, a geography/history map-quiz site.
> Tone: **upbeat, energetic, premium**, with spinning 3D camera moves. The **admin section (0:44 to 0:54) shifts to a serious tone**, then the finale snaps back to upbeat.
> Taglines: **"Studying, redefined."** (hero line), **"All new. All Hero."** (end card), **"Where history happened."** (site slogan, small).

---

## 0. Setup

```bash
npx create-video@latest hero-trailer      # blank TypeScript template
cd hero-trailer
npm i @remotion/google-fonts @remotion/three @remotion/transitions @remotion/media-utils three @react-three/fiber
mkdir -p public/vo public/music reference
# copy the Hero website repo into ./reference/hero  (read-only reference, never import from it at runtime)
```

Composition: `id="HeroTrailer"`, `width=1920`, `height=1080`, `fps=30`, `durationInFrames=1800`.
Render: `npx remotion render HeroTrailer out/hero-trailer.mp4`. Check stills while building: `npx remotion still HeroTrailer --frame=450 out/f450.png`.

## 1. Make it look like the real website (read the code, do not guess)

The video must reproduce the site's UI from its actual code. **Before writing any scene, read these files in `reference/hero/` and copy exact values** (colors, radii, shadows, gradients, spacing). Rebuild each UI piece as a React component (do not screenshot).

| Need | Read this file | What to copy |
|---|---|---|
| Colors, fonts, star-field background | `css/night.css`, `css/premium.css` | `--bg-base`, `--field`, `--line`, `--ink-500`, `--brand-*`, `--sec`, the star-field SVG tile, `.glass-panel` look and its 72px gradient accent bar |
| Component styling | `css/styles.css` | `.glass-panel`, `.st-card`, `.st-chip`, `.sw` toggle, `.toast` (tracing-border timer), `.sh-msg` chat bubbles, `.rv-row` weak-spot rows, `.marker-pin`, `#mode-pick`, `#admin-tabs`, `.an-kpi`, `.an-bar`, `.ib-*` inbox badges, `.qotd` quote block |
| Page markup and labels | `index.html` | Home hero, nav ("Hall of Heroes", "Private Charts", "Send a Word", "Stewards", "Customs"), year toggle, mode buttons, summary view with the score tooltip |
| Logo | `index.html` (`class="p1"` ... `class="rays"` SVG) | The H monogram: two stems, crossbar, four serifs, arch. Wordmark **HERO**, Spectral 700, letter-spacing 0.3em |
| Loader and intro film | `css/styles.css` (`.ld-*`), `css/intro.css`, `js/13-intro.js` | Ring + ripples, the white-fade-then-night-sky reveal, `LAND` polygons, scene captions |
| Map highlights | `js/12-map-highlight.js`, `css/premium.css` (`path.hl-*`) | Colors by type: water `#38bdf8`/`#0284c7`, land `#34d399`, continent `#a78bfa`, region `#f59e0b`, empire `#a855f7`, route `#fb923c`, river dashed animated |
| Quote of the day | `js/00-quotes.js` | Use a real quote, e.g. Herodotus: "Egypt is the gift of the Nile." |
| Admin panel | `index.html` (`#admin-panel`), `js/09-analytics-admin-tabs.js` | Tab bar (Quiz, Changelog, Feedback, Analytics, Site), KPI cards, live sessions table |

### `src/theme.ts` (starting tokens; verify against the files above)
```ts
export const T = {
  bg: '#0a0b1a', card: '#12132b', ink: '#ece9ff', muted: '#8b8ab0', line: 'rgba(160,158,230,0.16)',
  indigo: '#6b69e6', amber: '#ffb454', amberSoft: '#ffd9a0',
  ok: '#34d399', bad: '#fb7185', water: '#38bdf8', land: '#34d399', continent: '#a78bfa',
  region: '#f59e0b', empire: '#a855f7', route: '#fb923c',
  // admin / serious grade (see section 5)
  steel: '#9fb3c8', graphite: '#0b0d12', slate: '#1b2330',
};
```

### Fonts (use only what the site uses)
**Spectral** only: weights 400, 500, 600, 700 plus italic 400/500 (quotes). Load with `@remotion/google-fonts/Spectral` (`loadFont('normal', {weights:['400','500','600','700']})` and `loadFont('italic', ...)`). Numbers use `font-variant-numeric: tabular-nums`. No other typeface anywhere.

## 2. Visual language

- Background: near-black `#0a0b1a`, drifting star-field (parallax by camera), soft indigo radial glow at 50% 38%.
- Every UI card: rounded 22 to 24px, translucent `rgba(14,15,36,0.72)`, 1px border `T.line`, **72px indigo-to-amber accent bar at the top-left**.
- Amber (`#ffb454`) = highlight/energy. Indigo = structure. Use amber sparingly for pops, markers, kinetic words.
- **"NEW" tag**: small amber pill with dark text, springs in next to any feature that did **not** exist in the old site (*Map Quiz Pro*). See the NEW list in section 4.
- Kinetic typography: headline words slide up with `spring({damping: 14})`, 4-frame stagger; captions are Spectral 700, 64 to 88 px, centered.
- Motion polish: motion blur on whip pans (`filter: blur()` ramp), subtle chromatic offset on cuts, 2 to 3 frames of overshoot on every spring.

## 3. 3D camera system

Build `<Camera3D>` (CSS 3D, renders reliably in Remotion) and use `@remotion/three` only for background stars and the logo reveal.

```tsx
// src/Camera3D.tsx
import {interpolate, useCurrentFrame} from 'remotion';
type Key = {f: number; rotY?: number; rotX?: number; z?: number; x?: number; y?: number; roll?: number};
export const Camera3D: React.FC<{keys: Key[]; persp?: number; children: React.ReactNode}> = ({keys, persp = 1400, children}) => {
  const frame = useCurrentFrame(); const fs = keys.map(k => k.f);
  const v = (p: keyof Key) => interpolate(frame, fs, keys.map(k => (k[p] as number) ?? 0), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{perspective: persp, width: '100%', height: '100%', overflow: 'hidden'}}>
      <div style={{width: '100%', height: '100%', transformStyle: 'preserve-3d',
        transform: `translate3d(${v('x')}px, ${v('y')}px, ${v('z')}px) rotateX(${v('rotX')}deg) rotateY(${v('rotY')}deg) rotateZ(${v('roll')}deg)`}}>
        {children}
      </div>
    </div>
  );
};
```
Ease keyframes with `Easing.bezier(0.22, 1, 0.36, 1)` where smoothness is needed. Layer UI at different `translateZ` values (e.g. banner +80, map 0, stars -400) so the orbit produces real parallax.

**Camera presets** (name them in code): `orbitReveal` (rotY -35 to +20), `whipSpin` (rotY 0 to 360 in 24 frames, motion blur), `craneDown` (y -300 to 0, rotX 25 to 0), `dollyTilt` (z -600 to 0 with rotX 12 to 0), `flythrough` (z 0 to 500 through the UI layers), `slowPush` (z 0 to 120 over the whole scene, no rotation; **admin only**).

## 4. Storyboard, voice-over and timing (30 fps)

Place each VO clip with `<Sequence from={startFrame}><Audio src={staticFile('vo/NN.mp3')} /></Sequence>`. **Visual beats must land on the word marked with ▶.** If a clip runs long, nudge `playbackRate` (max 1.08) before moving visuals. Subtitles: show the VO line as a lower caption, Spectral 600, 44 px.

| # | Time | Frames | Scene | Camera | VO (energetic, bright) |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:04 | 0 to 120 | **Cold open.** Black, stars streak past; the H monogram assembles (stems rise, crossbar grows, serifs and arch fade in); wordmark HERO tracks in. At frame 100 a **white flash** (nod to the site's intro) | `orbitReveal` around the logo, 3D extruded logo via three.js | "Meet ▶Hero." (f24) "Studying, ▶redefined." (f66) |
| 2 | 0:04 to 0:10 | 120 to 300 | **Home.** Flash resolves into the home panel floating in 3D: quote-of-the-day, game-mode chips, two big cards. The **1 Year / 2 Year slider** slides; the whole page re-skins its data (title swaps, counts change). Tag **NEW**: Quote of the day, Year slider | `craneDown` then slow orbit | "Geography with ▶history attached. Pick your tour: ▶one year, or ▶two. Each with its own leaderboard." (f132, f200, f228) |
| 3 | 0:10 to 0:18 | 300 to 540 | **Name the Place + map highlighting.** Dark map tilted back in 3D, markers drop in with spring. Hover/tap markers one by one: **water lights blue, land green, continents violet, empires purple, a dashed river flows**, each with the pulse ring. A popup with the search field types "Nile". Tag **NEW**: Region highlighting, dark map | `dollyTilt` into `whipSpin` at f420 to reveal a second view | "Tap a ▶marker. Name the place. ▶Countries, seas, rivers, even ▶empires light up as you explore. All ▶new." (f306, f348, f378, f400, f470) |
| 4 | 0:18 to 0:23 | 540 to 690 | **Find the Land.** Amber banner "Find: The Nile" drops in; a cursor flies across and clicks the right pin; green ripple, score counter ticks up, timer bar drains. Tag **NEW**: Find the Land mode | `flythrough` | "Flip it ▶around. Hero names a place, you find the ▶land. Beat the clock." (f552, f600, f650) |
| 5 | 0:23 to 0:28 | 690 to 840 | **Lands Forgotten.** The `.rv-row` bars fill (Carthage 5x, Hormuz 4x, Anatolia 3x), then the rows fly into a review round. Tag **NEW**: Weak-spot review | `orbitReveal` tight on the rows | "Miss a place? Hero ▶remembers. Your forgotten lands come back until they ▶stick." (f702, f786) |
| 6 | 0:28 to 0:33 | 840 to 990 | **Clio, your muse of history.** Round bubble expands to the full-page chat; user bubble "Why does the Nile matter?"; typing dots; answer bubble with a memory trick. Tag **NEW**: Clio AI | `whipSpin` into `slowPush` | "Meet ▶Clio, your muse of history. Memory ▶tricks, one question away." (f852, f930) |
| 7 | 0:33 to 0:39 | 990 to 1170 | **Customs.** The six colorways (Bronze, Dusk, Ember, Moss, Coral, Graphite) swap live on the home panel; background switches contours, aurora, dot grid; font chips switch; the **animated toggle** flips on ambient music with a waveform; **light/dark circular reveal** from the sun/moon button. Tag **NEW**: Customs, ambient music, animated toggles | `orbitReveal` plus `whipSpin` at the mode swap | "Make it ▶yours. Six ▶colorways, four fonts, and ambient space ▶music. Light to dark, like a ▶sunrise." (f1000, f1040, f1096, f1146) |
| 8 | 0:39 to 0:44 | 1170 to 1320 | **Montage, 6 quick cuts (25 frames each, whip-pan transitions):** Hall of Heroes (gold/silver/bronze rails), Private Charts + JSON import, The Chronicle + update popup, Send a Word (photo and video attachments), the tracing-border toast, **phone in 3D** showing the bottom tab bar | `whipSpin` between cuts, phone orbits | "▶Private charts. A living ▶chronicle. A word to the ▶scribes. Built for your ▶phone." (f1176, f1212, f1248, f1290) |
| 9 | **0:44 to 0:54** | 1320 to 1620 | **ADMIN: SERIOUS.** See section 5. Stewards panel: tab bar (Quiz, Chronicle, Feedback, Analytics, Site), **live analytics** (live-now KPI pulsing, device and browser bars, 14-day chart), **feedback inbox** (expand a report with a screenshot), **dev wall** ("Under Construction" screen), **one-click redeploy** button with cooldown | `slowPush` only, no spins | "For the ▶stewards, a different kind of control. ▶Live analytics. A feedback ▶inbox. One-click ▶redeploys. And a development wall, locked behind a ▶password." (f1332, f1404, f1458, f1500, f1550, f1596) |
| 10 | 0:54 to 1:00 | 1620 to 1800 | **Finale, upbeat returns.** Grade snaps back to indigo/amber, white flash, the logo orbits at full speed over the star-field, "NEW" tags from earlier orbit around it. End card: **"Studying, redefined."**, then **"All new. All Hero."** and the site URL | `whipSpin` into `orbitReveal`, final 20 frames locked off | "Hero. ▶Studying, redefined. All ▶new. Set ▶forth." (f1632, f1668, f1722) |

**NEW-tag list (features not in Map Quiz Pro):** region highlighting, dark map, Find the Land, Lands Forgotten review, Clio AI, 1 Year / 2 Year tours, Customs (themes, fonts, backgrounds), ambient music, animated toggles/dropdowns, light/dark circular reveal, quote of the day, intro film and tutorial, The Chronicle with update popup, Send a Word (photo/video feedback), mobile tab bar, tracing-border toasts, live analytics, feedback inbox, dev wall, one-click redeploy. (Map Quiz Pro only had: single quiz, plain markers, leaderboard, basic admin panel, personal map.)

Do **not** show: the tab-cloak feature, SMS login codes (not built), a custom calendar (not built), or any real passwords, keys, or webhook URLs. Use obviously fake data.

## 5. Tone shift for the admin scene (frames 1320 to 1620)

- **Color grade:** crossfade to `T.graphite`/`T.slate` backgrounds, **remove amber**, accents become `T.steel`; drop star-field to 30% opacity; add a subtle film-grain and vignette. Saturation to about 0.55 over frames 1305 to 1335.
- **Camera:** `slowPush` only. No whip, no spin. Easing is linear-ish and calm.
- **Motion:** no overshoot. Springs use `damping: 30`. Counters tick steadily.
- **Type:** captions Spectral 500, smaller (48 px), left-aligned, no kinetic bounce; sentence cuts are plain fades.
- **Voice:** slower, lower, calm and authoritative; leave 12 to 15 frames of silence between sentences.
- **Music:** crossfade to the serious bed (see section 6) over f1290 to f1350. At f1620 snap back with a riser into the finale.
- Red-line moment at f1550: the dev wall appears (the "Under Construction" screen from `#dev-screen`) with a single low hit.

## 6. Audio

Codex cannot create audio. **You supply:**
- `public/vo/01.mp3` to `public/vo/10.mp3`: one file per scene from the VO column (generate with a TTS tool or record). Energetic read for 1 to 8 and 10; slow, low, serious for 9.
- `public/music/upbeat.mp3`: royalty-free, about 124 BPM, bright electronic/orchestral hybrid.
- `public/music/serious.mp3`: same music, lowered volume
Sync cuts to the beat: with 124 BPM there is a beat every ~14.5 frames; have hard cuts and flashes land on beats where possible. Duck the music by 6 dB under VO.

```tsx
// crossfade in Root audio layer
<Audio src={staticFile('music/upbeat.mp3')} volume={(f) => interpolate(f, [0,1290,1350,1620,1680,1800], [0.6,0.6,0,0,0.6,0.6])} />
<Audio src={staticFile('music/serious.mp3')} volume={(f) => interpolate(f, [1290,1350,1620,1650], [0,0.5,0.5,0])} />
```

## 7. Suggested file layout

```
src/Root.tsx           (Composition, audio layer)
src/theme.ts           src/Camera3D.tsx       src/timeline.ts   (scene frame ranges from section 4)
src/ui/                GlassPanel, NewTag, Logo, Wordmark, MapStage, Marker, Toggle, ChatBubble, WeakRow, AdminTabs, KpiCard, InboxRow
src/scenes/            S01Cold.tsx ... S10Finale.tsx
```

## 8. Working agreement for Codex

1. Read the reference files in section 1 first and summarize the exact tokens you will use.
2. Build `theme.ts`, `Camera3D.tsx`, and the UI components before any scene. Show a still of each component.
3. Build scenes in order 1 to 10, rendering one still per scene at its midpoint and fixing visible mismatches against the real site's CSS.
4. Wire audio last; verify every ▶ word lands within ±3 frames of its visual beat.
5. Final check: total length exactly 1800 frames, no text clipped at 1920x1080, admin scene is clearly more subdued, finale is the most energetic moment.
