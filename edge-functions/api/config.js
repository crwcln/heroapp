// edge-functions/api/config.js  ->  GET /api/config
// Non-secret tuning values you can change as EdgeOne env vars without touching code. (Env vars can't be read by the browser
// directly, which is why this tiny endpoint hands them over.) Everything here is optional: defaults live in js/16-flappy-bird.js.
//   FLAPPY_TRIGGER   exact phrase typed to Clio that opens the minigame   (default JEEMIN?!)
//   FLAPPY_BIRD_URL  image for the bird, any public URL                   (default media/bird.png in this repo)
//   FLAPPY_GRAVITY   fall speed, about 0.35 to 0.6                        (default 0.45)
//   FLAPPY_GAP       gap between pipes in px, about 130 to 200            (default 160)
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' } });
export function onRequestGet(context) {
  const e = context.env, out = {};
  if (e.FLAPPY_TRIGGER) out.flappyTrigger = e.FLAPPY_TRIGGER;
  if (e.FLAPPY_BIRD_URL) out.flappyBirdUrl = e.FLAPPY_BIRD_URL;
  if (Number(e.FLAPPY_GRAVITY)) out.flappyGravity = Number(e.FLAPPY_GRAVITY);
  if (Number(e.FLAPPY_GAP)) out.flappyGap = Number(e.FLAPPY_GAP);
  return json(out);
}
