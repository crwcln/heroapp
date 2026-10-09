// ================= INITIALIZE & UTILS =================
        lucide.createIcons();

        function showToast(message, type = 'info') {
            const cfg = { info: ['info', '#38bdf8', 'rgba(56,189,248,.16)'], success: ['check-circle', '#34d399', 'rgba(52,211,153,.16)'], error: ['alert-circle', '#fb7185', 'rgba(251,113,133,.16)'] }[type] || ['info', '#38bdf8', 'rgba(56,189,248,.16)'];
            const dur = type === 'error' ? 5000 : 3500;
            const container = document.getElementById('toast-container');
            while (container.children.length >= 4) container.firstElementChild.remove();

            const el = document.createElement('div');
            el.className = 'toast';
            el.setAttribute('role', type === 'error' ? 'alert' : 'status');
            el.style.setProperty('--tc', cfg[1]); el.style.setProperty('--tb', cfg[2]); el.style.setProperty('--td', dur + 'ms');
            el.innerHTML = `<svg class="toast-trace" aria-hidden="true"><rect class="toast-track"></rect><rect class="toast-line"></rect></svg>
                <div class="toast-body"><span class="toast-icon"><i data-lucide="${cfg[0]}"></i></span><span class="toast-msg"></span></div>`;
            el.querySelector('.toast-msg').textContent = message;
            container.appendChild(el);
            lucide.createIcons();

            // size the tracing line to the toast's outline (perimeter of a rounded rect)
            const w = el.offsetWidth, h = el.offsetHeight, r = 14, inset = 1.25;
            const rw = w - inset * 2, rh = h - inset * 2;
            const perim = 2 * (rw + rh) - (8 - 2 * Math.PI) * r;
            const svg = el.querySelector('.toast-trace');
            svg.setAttribute('width', w); svg.setAttribute('height', h);
            el.style.setProperty('--h', h + 'px');
            el.querySelectorAll('rect').forEach(rc => { rc.setAttribute('x', inset); rc.setAttribute('y', inset); rc.setAttribute('width', rw); rc.setAttribute('height', rh); rc.setAttribute('rx', r - inset); });
            const line = el.querySelector('.toast-line');
            line.style.strokeDasharray = perim; line.style.setProperty('--P', perim);

            let gone = false;
            const dismiss = () => {
                if (gone) return; gone = true;
                el.classList.add('leaving');
                el.addEventListener('animationend', ev => { if (ev.animationName === 'toastOut') el.remove(); });
                setTimeout(() => el.remove(), 600);
            };
            line.addEventListener('animationend', dismiss);   // line finished tracing -> swipe away
            el.addEventListener('click', dismiss);
            setTimeout(dismiss, dur + 1200);                  // safety net
        }

        const norm = (str) => {
            if (!str) return "";
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        };

        // Theme Toggle
        function toggleDarkMode() {
            const html = document.documentElement;
            const moon = document.getElementById('theme-icon-moon');
            const sun = document.getElementById('theme-icon-sun');
            
            if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                moon.classList.remove('hidden'); sun.classList.add('hidden');
                localStorage.setItem('theme', 'light');
            } else {
                html.classList.add('dark');
                sun.classList.remove('hidden'); moon.classList.add('hidden');
                localStorage.setItem('theme', 'dark');
            }
        }

        // Open in about:blank cloaking function
        function openInAboutBlank() {
            const win = window.open('about:blank', '_blank');
            if (win) {
                const iframe = win.document.createElement('iframe');
                iframe.src = window.location.href;
                iframe.style.width = '100vw';
                iframe.style.height = '100vh';
                iframe.style.border = 'none';
                iframe.style.margin = '0';
                iframe.style.padding = '0';
                
                win.document.body.style.margin = '0';
                win.document.body.style.overflow = 'hidden';
                win.document.title = window.__cloakTitle || "Home"; // Cloaks the tab title
                
                // Adds a generic favicon to complete the cloak
                const link = win.document.createElement('link');
                link.rel = 'icon';
                link.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><rect width=%2216%22 height=%2216%22 rx=%224%22 fill=%22%2364748b%22/></svg>';
                win.document.head.appendChild(link);
                
                win.document.body.appendChild(iframe);
            } else {
                showToast("Popup blocked! Please allow popups to use this feature.", "error");
            }
        }

        if (localStorage.getItem('theme') !== 'light') {
            document.documentElement.classList.add('dark');
            document.getElementById('theme-icon-sun').classList.remove('hidden');
        } else {
            document.getElementById('theme-icon-moon').classList.remove('hidden');
        }

        // ================= FIREBASE SETUP =================
        let db = null, auth = null;
        window.__heroCanAccessApp = false;
        let globalLocations = [];
        let globalQuizTitle = "The Grand Tour";
        let currentGlobalMessage = "";
        const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'map-quiz-pro-default';
        let userId = null;
        let activeDataUid = '';

        async function applyFirebaseUser(user) {
            let allowed = false, isAdmin = false;
            if (user) {
                try { isAdmin = (await user.getIdTokenResult()).claims.admin === true; }
                catch (e) { console.warn('Could not read account claims:', e); }
                allowed = isAdmin || (!user.isAnonymous && user.emailVerified === true);
            }
            userId = allowed ? user.uid : null;
            if (userId && activeDataUid !== userId) {
                activeDataUid = userId;
                loadGlobalSettings(); loadLeaderboard();
                loadChangelog(); loadSiteMode(); loadVisits(); countVisit(); startAnalytics();
            } else if (!userId) {
                activeDataUid = '';
                if (typeof stopAnalytics === 'function') stopAnalytics();
            }
            window.__heroCanAccessApp = allowed;
            window.dispatchEvent(new CustomEvent('hero-auth-state', { detail: { user, authorized: allowed, isAdmin } }));
        }
        window.__heroApplyAuthUser = applyFirebaseUser;

        async function initFirebase() {
            if (typeof window.__firebase_config !== 'undefined' && window.__firebase_config) {
                try {
                    const firebaseConfig = JSON.parse(window.__firebase_config);
                    firebase.initializeApp(firebaseConfig);
                    auth = firebase.auth();
                    db = firebase.firestore();

                    const beginAuth = () => {
                        window.dispatchEvent(new Event('hero-firebase-ready'));
                        auth.onAuthStateChanged(async user => { await applyFirebaseUser(user); });
                    };
                    // Members sign in for a browser session; a fresh session starts at the signup gate.
                    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).then(beginAuth).catch(error => {
                        console.warn('Session-only sign-in persistence unavailable:', error);
                        auth.setPersistence(firebase.auth.Auth.Persistence.NONE).then(beginAuth).catch(beginAuth);
                    });
                } catch (e) {
                    console.error("Firebase init failed:", e);
                    enableLocalMode();
                }
            } else enableLocalMode();
        }
        
        function enableLocalMode() { globalLocations = []; renderAdminList(); hideCover(); }
        
        document.addEventListener('DOMContentLoaded', () => {
            const moreNav = document.getElementById('nav-more');
            document.addEventListener('click', event => { if (moreNav && moreNav.open && !moreNav.contains(event.target)) moreNav.open = false; });
            document.addEventListener('keydown', event => { if (event.key === 'Escape' && moreNav) moreNav.open = false; });
            initFirebase();
            initVanillaParticles();
            document.getElementById('player-name').value = localStorage.getItem('mq_playerName') || '';
            renderUserCustomList();
        });

        function initVanillaParticles() {
            const canvas = document.getElementById('particles-bg');
            const ctx = canvas.getContext('2d');
            let particles = [];
            const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
            window.addEventListener('resize', resize);
            resize();

            for (let i = 0; i < 40; i++) particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, size: Math.random() * 2 + 1 });

            function animateParticles() {
                if(canvas.style.display === 'none') { requestAnimationFrame(animateParticles); return; }
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const isDark = document.documentElement.classList.contains('dark');
                ctx.fillStyle = isDark ? 'rgba(45, 212, 191, 0.45)' : 'rgba(13, 148, 136, 0.35)';
                
                particles.forEach(p => {
                    p.x += p.vx; p.y += p.vy;
                    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                });
                requestAnimationFrame(animateParticles);
            }
            animateParticles();
        }

        // ================= DATA & STATE =================
        let customLocations = JSON.parse(localStorage.getItem(QUIZZES[yearMode].custom)) || [];
        let map = null, tileLayer = null, mapStyleIndex = 0;
        let activeQuizData = [], quizStats = {}, points = 0, solvedCount = 0, timerInterval = null, secondsElapsed = 0;

        function switchView(viewId) {
            if (window.__heroCanAccessApp === false && !['auth-view'].includes(viewId)) {
                if (window.__heroShowAuthGate) window.__heroShowAuthGate();
                return;
            }
            const views = document.querySelectorAll('.view-section');
            const particles = document.getElementById('particles-bg');
            if (viewId === 'quiz-view') particles.style.display = 'none'; else particles.style.display = 'block';

            views.forEach(el => {
                if(!el.classList.contains('hidden')) {
                    el.classList.add('fade-out');
                    setTimeout(() => { el.classList.add('hidden'); el.classList.remove('fade-out'); }, 200);
                }
            });
            setTimeout(() => {
                const target = document.getElementById(viewId);
                target.classList.remove('hidden', 'fade-out');
                if (viewId !== 'quiz-view' && timerInterval) clearInterval(timerInterval);
                if (viewId === 'quiz-view' && map) setTimeout(() => { map.invalidateSize(); }, 100);
            }, 200);
        }

        // ================= FIREBASE SYNC & MESSAGES =================
        function loadGlobalSettings() {
            if(!db || !userId) return;
            Object.keys(QUIZZES).forEach(key => {
                const ref = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc(QUIZZES[key].doc);
                ref.onSnapshot(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        store[key] = { locs: data.locations || [], title: data.title || QUIZZES[key].defTitle, msg: data.message || '' };
                    }
                    if (key === yearMode) applyMode();
                });
            });
        }

        function dismissGlobalMsg() {
            document.getElementById('global-msg-modal').classList.add('hidden');
            if (currentGlobalMessage) {
                localStorage.setItem(QUIZZES[yearMode].seen, currentGlobalMessage);
                document.getElementById('global-msg-min-text').innerText = currentGlobalMessage;
                document.getElementById('global-msg-minimized').classList.remove('hidden');
            }
        }

        function loadLeaderboard() {
            if(!db || !userId) return;
            if (lbUnsub) lbUnsub();
            lbUnsub = db.collection('artifacts').doc(appId).collection('public').doc('data').collection(QUIZZES[yearMode].lb)
            .onSnapshot(snapshot => {
                let data = [];
                snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
                data.sort((a, b) => b.score - a.score || a.time - b.time);
                
                const list = document.getElementById('leaderboard-list');
                list.innerHTML = '';
                
                if (data.length === 0) return list.innerHTML = '<p class="text-center text-slate-500 italic py-8">No scores yet. Be the first!</p>';

                data.slice(0, 50).forEach((entry, idx) => {
                    const item = document.createElement('div');
                    item.className = `flex justify-between items-center p-4 rounded-2xl border ${idx === 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`;
                    const mins = String(Math.floor(entry.time / 60)).padStart(2, '0'), secs = String(entry.time % 60).padStart(2, '0');
                    item.innerHTML = `<div class="flex items-center gap-3"><span class="font-bold w-6 text-slate-400">#${idx+1}</span><div class="leaderboard-player-name font-bold text-lg"></div></div><div class="text-right"><div class="font-black text-indigo-600 text-xl font-mono">${Number(entry.score).toLocaleString()} <span class="text-xs">pts</span></div><div class="text-xs text-slate-500">${mins}:${secs}</div></div>`;
                    item.querySelector('.leaderboard-player-name').textContent = entry.name || 'Hero player';
                    list.appendChild(item);
                });
            });
        }

        // ================= JSON IMPORT & EXPORT UTILS =================
        function importJSON(type) {
            try {
                const textareaId = type === 'admin' ? 'json-import-admin' : 'json-import-user';
                const val = document.getElementById(textareaId).value;
                const arr = JSON.parse(val);
                
                const mapped = arr.map(a => ({ 
                    id: 'loc_' + Math.random().toString(36).substr(2, 9), 
                    name: a.name, 
                    category: a.category || 'Imported',
                    lat: parseFloat(a.lat), 
                    lng: parseFloat(a.lng) 
                }));

                if (type === 'admin') { 
                    globalLocations.push(...mapped); 
                    renderAdminList(); 
                } else { 
                    customLocations.push(...mapped); 
                    localStorage.setItem(QUIZZES[yearMode].custom, JSON.stringify(customLocations)); 
                    renderUserCustomList(); 
                }
                
                showToast(`Imported ${mapped.length} locations successfully!`, 'success');
                document.getElementById(textareaId).value = '';
            } catch(e) { 
                showToast('Invalid JSON format. Please check your syntax.', 'error'); 
            }
        }

        function copyAIPrompt() {
            const input = document.getElementById('ai-prompt-text');
            input.select();
            input.setSelectionRange(0, 99999);
            try {
                navigator.clipboard.writeText(input.value).then(() => {
                    showToast('Prompt copied to clipboard!', 'success');
                }).catch(() => {
                    document.execCommand("copy");
                    showToast('Prompt copied! (Fallback)', 'success');
                });
            } catch (err) {
                document.execCommand("copy");
                showToast('Prompt copied! (Fallback)', 'success');
            }
        }


        // ================= USER CUSTOM MAP LOGIC =================
        async function userAddPlace() {
            const name = document.getElementById('user-place-name').value.trim();
            const category = document.getElementById('user-place-category').value.trim() || 'Custom';
            const btnLoader = document.getElementById('user-add-loader');
            
            if (!name) return showToast("Enter a place name.", "error");
            btnLoader.classList.remove('hidden');

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`);
                const data = await response.json();
                if (data && data.length > 0) {
                    customLocations.push({ id: 'loc_' + Date.now(), name: data[0].name || name, category, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
                    localStorage.setItem(QUIZZES[yearMode].custom, JSON.stringify(customLocations));
                    renderUserCustomList();
                    document.getElementById('user-place-name').value = '';
                    showToast(`Added ${data[0].name || name} to My Map!`, "success");
                } else showToast("Location not found.", "error");
            } catch (e) { showToast("Network error.", "error"); } 
            finally { btnLoader.classList.add('hidden'); }
        }

        function renderUserCustomList() {
            document.getElementById('user-loc-count').innerText = customLocations.length;
            document.getElementById('custom-quiz-count').innerText = `${customLocations.length} locations`;
            const listEl = document.getElementById('user-custom-list');
            listEl.innerHTML = '';
            customLocations.forEach((loc, idx) => {
                const item = document.createElement('div');
                item.className = 'flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700';
                item.innerHTML = `<div><div class="font-bold text-sm text-slate-800 dark:text-white">${loc.name}</div><div class="text-[10px] font-bold uppercase text-slate-500 mt-1">${loc.category}</div></div>
                    <button onclick="removeUserLoc(${idx})" class="text-rose-500 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
                listEl.appendChild(item);
            });
            lucide.createIcons();
        }

        async function removeUserLoc(idx) {
            const L0 = customLocations[idx]; if (!L0) return;
            if (!(await customConfirm({ title: 'Remove location?', message: `"${L0.name}" will be removed from My Map.`, confirmText: 'Remove', danger: true }))) return;
            await rowOut('#user-custom-list', idx); customLocations.splice(idx, 1);
            localStorage.setItem(QUIZZES[yearMode].custom, JSON.stringify(customLocations)); renderUserCustomList(); showToast('Location removed.', 'success');
        }

        // ================= ADMIN LOGIC =================
        let adminChecking = false;
        async function unlockAdmin() {
            if (adminChecking) return;
            const input = document.getElementById('admin-password');
            const val = input.value;
            if (!val) return showToast("Enter the password.", "error");
            adminChecking = true;
            const ok = await checkPassword('admin', val);
            adminChecking = false;
            if (ok === true) {
                adminToken = lastAuthToken; onAdminUnlocked();
                document.getElementById('admin-lock').classList.add('hidden');
                document.getElementById('admin-panel').classList.remove('hidden');
                input.value = '';
            } else if (ok === false) { showToast("Incorrect password.", "error"); badInput(input); }
            else showToast(authFailMsg(), "error");
        }

        async function geocodeAndAddPlace() {
            const name = document.getElementById('place-name-input').value.trim();
            const cat = document.getElementById('place-category-input').value.trim() || 'Custom';
            const btnLoader = document.getElementById('add-loader');
            
            if (!name) return showToast("Enter a place name.", "error");
            btnLoader.classList.remove('hidden');

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`);
                const data = await response.json();
                if (data && data.length > 0) {
                    globalLocations.push({ id: 'loc_' + Date.now(), name: data[0].name || name, category: cat, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
                    renderAdminList();
                    document.getElementById('place-name-input').value = '';
                    showToast(`Added ${data[0].name || name} successfully.`, "success");
                } else showToast("Location not found.", "error");
            } catch (e) { showToast("Error during search.", "error"); } 
            finally { btnLoader.classList.add('hidden'); }
        }

        function renderAdminList() {
            document.getElementById('admin-loc-count').innerText = globalLocations.length;
            const listEl = document.getElementById('custom-list');
            listEl.innerHTML = '';
            globalLocations.forEach((loc, idx) => {
                const item = document.createElement('div');
                item.className = 'flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700';
                item.innerHTML = `<div><div class="font-bold text-sm text-slate-800 dark:text-white">${loc.name}</div><div class="text-[10px] font-bold uppercase text-slate-500 mt-1">${loc.category}</div></div>
                    <button onclick="removeAdminLoc(${idx})" class="text-rose-500 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
                listEl.appendChild(item);
            });
            lucide.createIcons();
        }

        async function removeAdminLoc(idx) {
            const L0 = globalLocations[idx]; if (!L0) return;
            if (!(await customConfirm({ title: 'Remove location?', message: `"${L0.name}" will be removed from this quiz once you deploy.`, confirmText: 'Remove', danger: true }))) return;
            await rowOut('#custom-list', idx); globalLocations.splice(idx, 1); renderAdminList(); showToast('Location removed.', 'success');
        }

        function saveGlobalQuiz() {
            if(!db || !userId) return showToast("Cannot deploy offline.", "error");
            const newTitle = document.getElementById('admin-quiz-title').value.trim() || 'The Grand Tour';
            const newMessage = document.getElementById('admin-global-msg').value.trim();
            
            const btn = document.getElementById('save-global-btn');
            const orig = btn.innerHTML;
            btn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> <span>Deploying...</span>`;
            
            db.collection('artifacts').doc(appId).collection('public').doc('data').collection('globalSettings').doc(QUIZZES[yearMode].doc)
                .set({ locations: globalLocations, title: newTitle, message: newMessage })
                .then(() => {
                    showToast("Live! Challenge updated.", "success");
                    btn.innerHTML = orig;
                }).catch(e => { btn.innerHTML = orig; showToast("Failed to deploy.", "error"); });
        }

        // ADDED: Clear Leaderboard Logic
        async function clearLeaderboard() {
            if (!(await customConfirm({ title: 'Wipe leaderboard?', message: `This permanently deletes ALL ${QUIZZES[yearMode].label} leaderboard entries. This cannot be undone.`, confirmText: 'Wipe leaderboard', danger: true }))) return;
            
            if (!db || !userId) return showToast("Cannot clear leaderboard in offline mode.", "error");
            
            const btn = document.getElementById('clear-lb-btn');
            const origHTML = btn.innerHTML;
            
            // Show loading state
            btn.innerHTML = `<div class="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div> <span>Wiping...</span>`;
            btn.disabled = true;
            
            try {
                const collectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection(QUIZZES[yearMode].lb);
                const snapshot = await collectionRef.get();
                
                if (snapshot.empty) {
                    showToast("Leaderboard is already empty.", "info");
                    btn.innerHTML = origHTML;
                    btn.disabled = false;
                    return;
                }

                // Firebase batch deletes allow up to 500 operations at once
                const batch = db.batch();
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                
                await batch.commit();
                showToast("Leaderboard completely wiped.", "success");
                
            } catch (error) {
                console.error("Error clearing leaderboard: ", error);
                showToast("Failed to clear leaderboard.", "error");
            } finally {
                // Restore button state
                btn.innerHTML = origHTML;
                btn.disabled = false;
                lucide.createIcons(); // Re-render the trash icon
            }
        }

        // ================= QUIZ LOGIC =================
        function startQuiz(mode) {
            activeQuizData = mode === 'default' ? globalLocations : customLocations;
            if (activeQuizData.length === 0) return showToast("No locations to play!", "error");

            points = 0; solvedCount = 0; secondsElapsed = 0; quizStats = {};
            activeQuizData.forEach(loc => quizStats[loc.id] = { name: loc.name, mistakes: 0, solved: false });

            document.getElementById('q-score').innerText = '0';
            document.getElementById('q-solved').innerText = '0';
            document.getElementById('q-total').innerText = activeQuizData.length;
            
            switchView('quiz-view');
            initMap();
            
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                secondsElapsed++;
                const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
                const s = String(secondsElapsed % 60).padStart(2, '0');
                document.getElementById('timer-display').innerText = `${m}:${s}`;
            }, 1000);
        }

        function toggleMapStyle() {
            if(!map) return;
            mapStyleIndex = (mapStyleIndex + 1) % 3;
            const styles = [
                { url: TILE_SATELLITE, attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community' },
                { url: TILE_STANDARD, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' },
                { url: TILE_HOT, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> | Tiles <a href="https://www.openstreetmap.fr/">OpenStreetMap France</a> / <a href="https://www.hotosm.org/">HOT</a>' }
            ];
            // Tile layers have no setAttribution() method. Recreate the layer so Leaflet's
            // attribution control removes the old provider and registers the new one.
            if (tileLayer) map.removeLayer(tileLayer);
            tileLayer = L.tileLayer(styles[mapStyleIndex].url, { attribution: styles[mapStyleIndex].attribution }).addTo(map);
        }

        function initMap() {
            if (map) { map.remove(); map = null; }
            map = L.map('map-container', { worldCopyJump: true, minZoom: 2, maxZoom: 14, zoomControl: false }).setView([25, 20], 2.5);
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            mapStyleIndex = 0;
            tileLayer = L.tileLayer(TILE_SATELLITE, { attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community' }).addTo(map);

            const unsolvedIcon = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-pin unsolved'></div>", iconSize: [26, 26], iconAnchor: [13, 13] });
            const solvedIcon = L.divIcon({ className: 'custom-div-icon', html: "<div class='marker-pin solved'></div>", iconSize: [26, 26], iconAnchor: [13, 13] });

            activeQuizData.forEach(loc => {
                const marker = L.marker([loc.lat, loc.lng], { icon: unsolvedIcon }).addTo(map);
                marker._loc = loc; hlBind(marker, loc);
                if (gameMode === 'find') marker.on('click', () => findClick(marker, loc));

                const popupWrap = document.createElement('div');
                popupWrap.className = 'w-56 font-sans flex flex-col gap-2 relative';
                popupWrap.innerHTML = `<div class="font-extrabold text-sm border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Identify Location</div>`;

                const searchWrap = document.createElement('div');
                searchWrap.className = 'relative';
                
                const input = document.createElement('input');
                input.type = 'text'; input.placeholder = 'Search...';
                input.className = 'w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500';
                
                const dropdownList = document.createElement('div');
                dropdownList.className = 'custom-combo-list hidden';

                let activeDropdownIndex = -1;

                const populateList = (filterText = '') => {
                    dropdownList.innerHTML = '';
                    activeDropdownIndex = -1;
                    const matches = activeQuizData.filter(d => norm(d.name).includes(norm(filterText)));
                    
                    if (matches.length === 0) {
                        dropdownList.innerHTML = `<div class="p-2 text-xs text-center text-slate-500 italic">No matches</div>`;
                    } else {
                        matches.sort((a,b) => a.name.localeCompare(b.name)).forEach((m, index) => {
                            const item = document.createElement('div');
                            item.className = 'combo-item';
                            item.innerText = m.name;
                            item.dataset.id = m.id;
                            item.dataset.index = index;
                            
                            item.onclick = (e) => {
                                e.stopPropagation();
                                input.value = m.name;
                                input.dataset.selectedId = m.id;
                                dropdownList.classList.add('hidden');
                                setTimeout(() => btn.click(), 50); // Auto submit on click
                            };
                            dropdownList.appendChild(item);
                        });
                    }
                };

                const updateHighlight = () => {
                    const items = dropdownList.querySelectorAll('.combo-item');
                    items.forEach(el => el.classList.remove('bg-indigo-50', 'dark:bg-slate-700', 'text-indigo-600'));
                    if (activeDropdownIndex >= 0 && items[activeDropdownIndex]) {
                        items[activeDropdownIndex].classList.add('bg-indigo-50', 'dark:bg-slate-700', 'text-indigo-600');
                        items[activeDropdownIndex].scrollIntoView({ block: 'nearest' });
                    }
                };

                input.onfocus = () => { populateList(input.value); dropdownList.classList.remove('hidden'); };
                input.oninput = (e) => { populateList(e.target.value); dropdownList.classList.remove('hidden'); input.dataset.selectedId = ''; };
                
                input.onkeydown = (e) => {
                    const items = dropdownList.querySelectorAll('.combo-item');
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeDropdownIndex = (activeDropdownIndex + 1) % items.length;
                        updateHighlight();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeDropdownIndex = (activeDropdownIndex - 1 + items.length) % items.length;
                        updateHighlight();
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!dropdownList.classList.contains('hidden') && activeDropdownIndex >= 0) {
                            items[activeDropdownIndex].click();
                        } else if (input.dataset.selectedId) {
                            btn.click();
                        } else if (items.length === 1) {
                            items[0].click();
                        } else if (items.length > 0) {
                            items[0].click();
                        }
                    }
                };

                document.addEventListener('click', (e) => { if (!searchWrap.contains(e.target)) dropdownList.classList.add('hidden'); });

                searchWrap.appendChild(input); searchWrap.appendChild(dropdownList);
                popupWrap.appendChild(searchWrap);

                const btn = document.createElement('button');
                btn.className = 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg p-2 text-sm hidden'; // Hidden because Enter does it
                btn.innerText = 'Lock';
                popupWrap.appendChild(btn);

                const feedback = document.createElement('div');
                feedback.className = 'text-xs font-bold hidden text-center rounded-lg p-2';
                popupWrap.appendChild(feedback);

                btn.onclick = () => {
                    const selectedId = input.dataset.selectedId;
                    if (!selectedId) return;

                    if (selectedId === loc.id) {
                        const mks = quizStats[loc.id].mistakes;
                        points += mks === 0 ? 1000 : (mks === 1 ? 500 : 100);
                        solvedCount++; quizStats[loc.id].solved = true;

                        marker.setIcon(solvedIcon);
                        document.getElementById('q-score').innerText = points.toLocaleString();
                        document.getElementById('q-solved').innerText = solvedCount;
                        
                        marker.closePopup();
                        marker.unbindPopup();
                        marker.bindPopup(`<div class="font-black text-emerald-600 text-base text-center px-2 py-1">${loc.name}</div>`);

                        if (solvedCount === activeQuizData.length) setTimeout(endQuizEarly, 1000);
                    } else {
                        quizStats[loc.id].mistakes++; badInput(input); recordMiss(loc.name);
                        feedback.innerText = 'Incorrect';
                        feedback.className = 'text-xs font-bold text-rose-700 bg-rose-100 text-center block rounded p-1 animate-bounce-short';
                        input.value = ''; input.dataset.selectedId = '';
                        setTimeout(() => feedback.classList.add('hidden'), 1500);
                    }
                };

                // Pushes the map down automatically to prevent popup hiding under the header toolbar
                if (gameMode !== 'find') marker.bindPopup(popupWrap, { minWidth: 220, offset: [0, -10], autoPanPaddingTopLeft: [10, 90] });
                
                // Auto focus input when dot is clicked
                marker.on('popupopen', () => { setTimeout(() => { input.focus(); }, 50); mobileCenterMarker(marker); });
            });
        }

        let finalScore = 0;
        function endQuizEarly() {
            clearInterval(timerInterval);
            const tb = Math.max(0, 10000 - (secondsElapsed * 10));
            finalScore = points + tb;
            document.getElementById('sum-final-score').innerText = finalScore.toLocaleString();
            switchView('summary-view');
            fireConfetti();
        }

        function submitScore() {
            if(!db || !userId) return showToast("Offline mode.", "error");
            const name = (document.getElementById('player-name').value.trim() || localStorage.getItem('hero_member_name') || auth.currentUser?.displayName || 'Hero').slice(0, 15);
            localStorage.setItem('mq_playerName', name);
            db.collection('artifacts').doc(appId).collection('public').doc('data').collection(QUIZZES[yearMode].lb).add({
                userId, name, score: finalScore, time: secondsElapsed, tour: QUIZZES[yearMode].label,
                perfect: activeQuizData.length > 0 && solvedCount === activeQuizData.length && Object.values(quizStats).every(q => q.solved && q.mistakes === 0),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                showToast("Score saved!", "success");
                window.dispatchEvent(new Event('hero-score-saved'));
                setTimeout(() => switchView('leaderboard-view'), 1000);
            }).catch(e => showToast(`Could not save score (${e.code || 'error'}). Sign in with a verified account and retry.`, 'error'));
        }

        function fireConfetti() {
            const canvas = document.getElementById('confetti-canvas');
            canvas.classList.remove('hidden'); canvas.width = window.innerWidth; canvas.height = window.innerHeight;
            const ctx = canvas.getContext('2d'), pieces = [], colors = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899'];
            for (let i = 0; i < 150; i++) pieces.push({ x: Math.random() * canvas.width, y: -canvas.height * Math.random(), size: Math.random() * 10 + 5, color: colors[Math.floor(Math.random() * colors.length)], speed: Math.random() * 5 + 3, angle: Math.random() * 360, spin: Math.random() * 0.2 - 0.1 });
            function animate() {
                if(canvas.classList.contains('hidden')) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height); let active = false;
                pieces.forEach(p => { p.y += p.speed; p.angle += p.spin; if (p.y < canvas.height) active = true;
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); ctx.restore(); });
                if (active) requestAnimationFrame(animate); else canvas.classList.add('hidden');
            } animate();
        }
