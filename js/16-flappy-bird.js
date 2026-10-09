// ===== FLAPPY BIRD (easter egg) =====
// Type the trigger phrase to Clio (default "JEEMIN?!"). Bird picture: replace media/bird.png, or set FLAPPY_BIRD_URL (see
// edge-functions/api/config.js). Pipe gap, gravity and the trigger can be tuned there too. Scores post to their own board
// (Firestore collection "flappy"), separate from the Hall of Heroes.
const FLAPPY_DEFAULTS = { flappyTrigger: 'JEEMIN?!', flappyBirdUrl: 'media/bird.png', flappyGravity: 0.45, flappyGap: 160 };
let flCfg = Object.assign({}, FLAPPY_DEFAULTS);
fetch('/api/config').then(r => r.ok ? r.json() : null).then(d => { if (d) flCfg = Object.assign(flCfg, d); }).catch(() => { /* defaults */ });
const flCol = () => db.collection('artifacts').doc(appId).collection('public').doc('data').collection('flappy');
let flState = null;
function flOpen() {
    if (document.getElementById('flappy')) return;
    const el = document.createElement('div'); el.id = 'flappy';
    el.innerHTML = '<div class="fl-wrap"><button class="fl-close">Close \u2715</button><div class="fl-hud">0</div><canvas width="360" height="560"></canvas><div class="fl-over"><h3>Game over</h3><div class="fl-score"></div><div class="fl-row"><input maxlength="15" placeholder="Your name"><button class="cm-btn go fl-submit">Post score</button></div><div class="fl-board">Loading best runs...</div><button class="cm-btn ghost fl-again" style="color:#fff;border-color:rgba(255,255,255,.4)">Play again</button></div></div>';
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('open'));
    el.querySelector('.fl-close').onclick = flClose; document.addEventListener('keydown', flKeys);
    const cv = el.querySelector('canvas'), img = new Image(); img.src = flCfg.flappyBirdUrl;
    flState = { cv, ctx: cv.getContext('2d'), img, y: 260, vy: 0, pipes: [], score: 0, t: 0, dead: false, raf: 0, posted: false };
    cv.onpointerdown = flFlap; el.querySelector('.fl-again').onclick = () => { flReset(); flLoop(); }; el.querySelector('.fl-submit').onclick = flPost; flLoop();
}
function flKeys(e) { if (e.key === 'Escape') flClose(); if (e.key === ' ' && document.getElementById('flappy') && e.target.tagName !== 'INPUT') { e.preventDefault(); flFlap(); } }
function flReset() { Object.assign(flState, { y: 260, vy: 0, pipes: [], score: 0, t: 0, dead: false, posted: false }); document.getElementById('flappy').classList.remove('over'); }
function flFlap() { if (flState && !flState.dead) flState.vy = -7.6; }
function flClose() { if (flState) cancelAnimationFrame(flState.raf); document.removeEventListener('keydown', flKeys); const el = document.getElementById('flappy'); if (el) { el.classList.remove('open'); setTimeout(() => el.remove(), 400); } }
async function flBoard() {
    const box = document.querySelector('#flappy .fl-board'); if (!box) return;
    try { const s = await flCol().orderBy('score', 'desc').limit(5).get(); box.innerHTML = ''; s.docs.forEach((d, i) => { const r = document.createElement('div'); r.innerHTML = '<span></span><b></b>'; r.firstChild.textContent = `${i + 1}. ${d.data().name}`; r.lastChild.textContent = d.data().score; box.appendChild(r); }); if (!s.size) box.textContent = 'No scores yet. Be the first!'; }
    catch (e) { box.textContent = 'Leaderboard unavailable right now.'; }
}
async function flPost() {
    const s = flState; if (!s || s.posted || !s.score) return showToast(s && s.posted ? 'Already posted.' : 'Score at least 1 to post.', 'info');
    const name = (document.querySelector('#flappy input').value.trim() || 'Anonymous').slice(0, 15);
    try { await flCol().add({ name, score: s.score, userId, ts: firebase.firestore.FieldValue.serverTimestamp() }); s.posted = true; showToast('Score posted!', 'success'); flBoard(); } catch (e) { showToast(`Could not post (${e.code || 'error'}).`, 'error'); }
}
function flDie() { const s = flState; s.dead = true; const el = document.getElementById('flappy'); el.classList.add('over'); el.querySelector('.fl-score').textContent = `Score: ${s.score}`; flBoard(); }
function flLoop() {
    const s = flState, { ctx, cv } = s; s.t++; s.vy += flCfg.flappyGravity; s.y += s.vy;
    if (s.t % 90 === 1) s.pipes.push({ x: cv.width, top: 40 + Math.random() * (cv.height - flCfg.flappyGap - 120), gap: flCfg.flappyGap });
    s.pipes.forEach(p => p.x -= 2.6); s.pipes = s.pipes.filter(p => p.x > -60);
    const g = ctx.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#1a2a52'); g.addColorStop(1, '#0a0e1a'); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#d4af37'; s.pipes.forEach(p => { ctx.fillRect(p.x, 0, 46, p.top); ctx.fillRect(p.x, p.top + p.gap, 46, cv.height - p.top - p.gap); if (!p.passed && p.x + 46 < 60) { p.passed = true; s.score++; } });
    ctx.save(); ctx.translate(60, s.y); ctx.rotate(Math.max(-0.5, Math.min(0.9, s.vy / 12)));
    if (s.img.complete && s.img.naturalWidth) ctx.drawImage(s.img, -20, -20, 40, 40); else { ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill(); }
    ctx.restore(); document.querySelector('#flappy .fl-hud').textContent = s.score;
    if (s.y < 10 || s.y > cv.height - 10 || s.pipes.some(p => p.x < 78 && p.x + 46 > 42 && (s.y - 16 < p.top || s.y + 16 > p.top + p.gap))) return flDie();
    s.raf = requestAnimationFrame(flLoop);
}
const _secretAsk = secretAsk;
secretAsk = function (text) {
    if (String(text || '').trim() === flCfg.flappyTrigger) { sh.msgs.push({ r: 'user', t: text }, { r: 'model', t: "...you weren't supposed to know that word." }); shRender(); setTimeout(flOpen, 700); return true; }
    return _secretAsk(text);
};
