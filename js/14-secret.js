// ===== SECRET: THE LOST LEGENDS =====
// Trigger A: ask Clio "Who is Manoj?"   Trigger B: send feedback with Type=General feedback, Area=Something else,
// Summary "Who is Manoj?", Details "That is right."  (that feedback is NOT sent to the inbox).
// Reward: the Gilded colorway + a hidden quiz about legendary lost places. Scores from it never reach the leaderboard.
const LEGENDS = [['Atlantis', 'Legendary Lands', 36, -25], ['El Dorado', 'Lost Cities', 4.97, -73.77], ['Shangri-La', 'Lost Cities', 27.8, 99.7], ['Avalon', 'Legendary Lands', 51.15, -2.72],
    ['Lyonesse', 'Legendary Lands', 50, -6], ['Hy-Brasil', 'Phantom Islands', 51.5, -14], ['Lemuria', 'Lost Continents', -20, 70], ['Thule', 'Phantom Islands', 66, -20]]
    .map(([name, category, lat, lng], i) => ({ id: 'lg_' + i, name, category, lat, lng }));
window.__secret = false;
const norm1 = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const isManoj = s => /^who is manoj\??$/.test(norm1(s));
function secretUnlock() {
    localStorage.setItem('hero_gilded', '1'); secretGear();
    prefs.theme = 'gilded'; applyPrefs(); if (consent === 'all') setCookie('cairn_prefs', JSON.stringify(prefs));
}
function secretGear() {   // permanent doors, once found
    if (!localStorage.getItem('hero_gilded')) return;
    const grid = document.querySelector('#settings-view .st-card[data-theme]'); 
    if (grid && !document.querySelector('.st-card[data-theme="gilded"]')) grid.parentElement.insertAdjacentHTML('beforeend', '<button class="st-card" data-theme="gilded" onclick="setPref(\'theme\',\'gilded\')" style="--a:#c9a227;--b:#ffe08a"><i></i><span>Gilded</span></button>');
    const mp = document.getElementById('mode-pick'); if (mp && !document.getElementById('legends-chip')) mp.insertAdjacentHTML('beforeend', '<button id="legends-chip" class="st-chip" onclick="startLegends()">Lost Legends</button>');
    if (typeof applyPrefs === 'function') applyPrefs();
}
function secretReveal() {
    secretUnlock();
    let el = document.getElementById('secret');
    if (!el) { el = document.createElement('div'); el.id = 'secret'; document.body.appendChild(el); }
    el.innerHTML = `<div class="sc-card"><div class="sc-seal">M</div><h2>The Archive Opens</h2><p>A name whispered to the scribes, and a sealed door swings wide. You have unlocked the Gilded colorway and the Lost Legends: eight places that history only half remembers.</p><div class="sc-btns"><button class="sc-go">Enter the Lost Legends</button><button class="sc-no">Not yet</button></div></div>`;
    el.querySelector('.sc-no').onclick = () => el.classList.remove('open');
    el.querySelector('.sc-go').onclick = () => { el.classList.remove('open'); startLegends(); };
    requestAnimationFrame(() => el.classList.add('open'));
    if (typeof fireConfetti === 'function') fireConfetti();
}
function startLegends() {
    const saved = globalLocations; globalLocations = LEGENDS;
    try { startQuiz('default'); } finally { globalLocations = saved; }
    window.__secret = true;
}
const _sqSecret = startQuiz; startQuiz = function (m) { if (m !== 'default' || globalLocations !== LEGENDS) window.__secret = false; _sqSecret(m); };
const _subSecret = submitScore; submitScore = function () { if (window.__secret) return showToast('Legends are for glory, not the Hall of Heroes.', 'info'); _subSecret(); };
function secretAsk(text) {                     // Clio
    if (!isManoj(text)) return false;
    sh.msgs.push({ r: 'user', t: text }, { r: 'model', t: 'Some questions are not mine to answer. Watch the horizon: a door is opening.' }); shRender();
    setTimeout(secretReveal, 1300); return true;
}
function fbSecret(type, title, desc) {          // feedback form
    if (!(type === 'general' && document.getElementById('fb-area').value === 'Something else' && isManoj(title) && norm1(desc).replace(/\.$/, '') === 'that is right')) return false;
    fbReset(); setTimeout(secretReveal, 250); return true;
}
secretGear();
document.getElementById('about-version').textContent = 'v' + SITE.version;
{ const q = quoteOfDay(); document.getElementById('about-quote').textContent = q.t; document.getElementById('about-quote-a').textContent = q.a; }
