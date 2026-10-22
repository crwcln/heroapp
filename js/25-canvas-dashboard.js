// Canvas dashboard. Personal access tokens live in sessionStorage only and are
// forwarded through Hero's same-origin relay to the student's Canvas instance.
(() => {
    const TOKEN_KEY = 'hero_canvas_token_session';
    const URL_KEY = 'hero_canvas_url_session';
    let snapshot = null, loading = false;
    const root = () => document.getElementById('canvas-dashboard');
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtDate = (value) => {
        if (!value) return 'No deadline';
        const d = new Date(value);
        return Number.isNaN(+d) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
    };
    const baseUrl = (v) => {
        const u = new URL(v.trim());
        if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw new Error('Enter your Canvas school URL, starting with https://.');
        return u.origin;
    };
    const getJson = async (url, token) => {
        let response;
        try {
            response = await fetch('/api/canvas', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ url }),
            });
        } catch {
            throw new Error("Couldn't reach Hero's Canvas relay. Check your connection and try again.");
        }
        let detail = null;
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            try {
                detail = JSON.parse(body);
            } catch {
                throw new Error(`Hero's Canvas relay returned a non-JSON HTTP ${response.status} response. EdgeOne may not have deployed or run the Canvas relay correctly.`);
            }
        }
        if (!response.ok) {
            const relayErrors = {
                canvas_host_not_allowed: "This Canvas domain isn't configured for secure access. Ask the Hero administrator to add its hostname to CANVAS_ALLOWED_HOSTS in EdgeOne.",
                canvas_redirect: 'Canvas redirected this address. Use the final school URL shown in your browser when signed in to Canvas.',
                canvas_unreachable: `Hero's relay could not connect to Canvas${detail.cause ? ` (${detail.cause})` : ''}. This is an EdgeOne-to-Canvas network failure, not a rejected token.`,
                canvas_timeout: 'Canvas took too long to respond. Try again in a moment.',
                invalid_canvas_response: 'Canvas returned an unexpected response. Check the school URL.',
                canvas_non_json_response: `Canvas's gateway returned ${detail.contentType} (HTTP ${detail.upstreamStatus}) while loading ${new URL(url).pathname.replace('/api/v1/', '')}. This usually indicates a school-side Canvas/gateway problem, not an invalid token.`,
            };
            const errors = Array.isArray(detail.errors) ? detail.errors : Object.values(detail.errors || {}).flat();
            const apiMessage = errors.map(error => typeof error === 'string' ? error : error?.message).filter(Boolean).join(' ');
            const endpoint = new URL(url).pathname.replace('/api/v1/', '');
            const message = relayErrors[detail.error] ||
                (response.status === 401 ? 'Canvas rejected this access token. Check that it is current and has not expired.' :
                    response.status === 403 ? 'Canvas denied access. Your school may restrict API tokens or this data.' :
                        `Canvas rejected ${endpoint} (${response.status})${apiMessage ? `: ${apiMessage}` : '.'}`);
            const error = new Error(message);
            error.status = response.status; throw error;
        }
        return { data: await response.json(), next: response.headers.get('Link') };
    };
    const api = async (base, token, path) => {
        const first = new URL(`${base}/api/v1/${path}`);
        let url = first, result = [], pages = 0;
        do {
            if (url.origin !== first.origin || !url.pathname.startsWith('/api/v1/')) throw new Error('Canvas supplied an unsafe pagination link; request stopped.');
            const response = await getJson(url.href, token);
            result.push(...(Array.isArray(response.data) ? response.data : [response.data]));
            const next = response.next?.split(',').find(part => /rel="next"/.test(part));
            url = next ? new URL(next.slice(0, next.indexOf(';')).trim().replace(/^<|>$/g, ''), url) : null;
        } while (url && ++pages < 12);
        return result;
    };
    const form = (error = '') => {
        root().innerHTML = `<section class="canvas-connect">
            <div class="canvas-eyebrow"><span>YOUR ACADEMIC COMMAND DECK</span><i data-lucide="sparkles"></i></div>
            <h1>Make room for the work that matters.</h1>
            <p class="canvas-lede">Connect Canvas to bring your courses, grades, announcements, quizzes, and deadlines into one calm view.</p>
            <div class="canvas-security"><i data-lucide="shield-check"></i><span>Your token stays in this browser tab session and is briefly forwarded by Hero’s secure relay to your Canvas school. Hero does not save it to your account or Firestore.</span></div>
            ${error ? `<div class="canvas-error" role="alert">${esc(error)}</div>` : ''}
            <form id="canvas-connect-form" class="canvas-form">
                <label>Canvas school URL<input id="canvas-url" type="url" required placeholder="https://school.instructure.com" autocomplete="url" value="${esc(sessionStorage.getItem(URL_KEY) || '')}"><small>Use the same address where you open Canvas.</small></label>
                <label>Canvas access token<input id="canvas-token" type="password" required placeholder="Paste your Canvas token" autocomplete="off" spellcheck="false"><small>Create a personal access token in Canvas Account → Settings. Treat it like your password.</small></label>
                <button class="canvas-primary" type="submit"><i data-lucide="arrow-up-right"></i> Open my dashboard</button>
            </form>
            <p class="canvas-footnote">If your school uses a custom Canvas domain, the Hero administrator may need to allowlist it. Schools can also disable personal access tokens or restrict API access.</p>
        </section>`;
        lucide.createIcons();
        document.getElementById('canvas-connect-form').onsubmit = async (event) => {
            event.preventDefault();
            const button = event.currentTarget.querySelector('button'); button.disabled = true; button.textContent = 'Connecting securely…';
            try {
                const base = baseUrl(document.getElementById('canvas-url').value);
                const token = document.getElementById('canvas-token').value.trim();
                if (!token) throw new Error('Paste your Canvas token to continue.');
                sessionStorage.setItem(URL_KEY, base); sessionStorage.setItem(TOKEN_KEY, token);
                await loadDashboard(base, token);
            } catch (e) { sessionStorage.removeItem(TOKEN_KEY); form(e.message || 'Could not connect to Canvas.'); }
        };
    };
    const loadDashboard = async (base, token) => {
        if (loading) return;
        loading = true;
        root().innerHTML = '<section class="canvas-loading"><span class="canvas-loader"></span><h1>Gathering your courses…</h1><p>Reading the Canvas details available to your account.</p></section>';
        try {
            const [profile] = await api(base, token, 'users/self/profile');
            const [courses, enrollments] = await Promise.all([
                api(base, token, 'courses?enrollment_state[]=active&include[]=term&per_page=100'),
                api(base, token, 'users/self/enrollments?state[]=active&state[]=completed&per_page=100')
            ]);
            const active = courses.filter(c => c.name && (c.workflow_state === 'available' || !c.workflow_state)).slice(0, 8);
            const courseIds = new Set(active.map(c => String(c.id)));
            const eligibleEnrollments = enrollments.filter(e => courseIds.has(String(e.course_id)));
            const assignmentsByCourse = [], announcementsByCourse = [];
            // Keep the number of simultaneous API calls low; Canvas dynamically throttles clients.
            for (const c of active) {
                const [assignments, quizzes, announcements] = await Promise.all([
                    api(base, token, `courses/${encodeURIComponent(c.id)}/assignments?include[]=submission&order_by=due_at&per_page=100`),
                    api(base, token, `courses/${encodeURIComponent(c.id)}/quizzes?per_page=100`).catch(() => []),
                    api(base, token, `announcements?context_codes[]=course_${encodeURIComponent(c.id)}&per_page=10`)
                ]);
                assignmentsByCourse.push({ course: c, rows: [...assignments, ...quizzes.map(q => ({ ...q, name: q.title, isCanvasQuiz: true, points_possible: q.points_possible }))] });
                announcementsByCourse.push({ course: c, rows: announcements });
            }
            const assignments = assignmentsByCourse.flatMap(x => x.rows.map(a => ({ ...a, courseName: x.course.name, courseId: x.course.id }))).sort((a,b) => new Date(a.due_at || '9999') - new Date(b.due_at || '9999'));
            const announcements = announcementsByCourse.flatMap(x => x.rows.map(a => ({ ...a, courseName: x.course.name }))).sort((a,b) => new Date(b.posted_at || 0) - new Date(a.posted_at || 0)).slice(0, 8);
            const gradeRows = eligibleEnrollments.map(e => ({ courseName: active.find(c => String(c.id) === String(e.course_id))?.name || e.course_id, grade: e.grades?.current_grade, score: e.grades?.current_score })).filter(e => e.grade || Number.isFinite(e.score));
            snapshot = { name: profile.name || profile.short_name || 'Student', courses: active, assignments, announcements, grades: gradeRows };
            renderDashboard(snapshot);
        } catch (e) {
            if (e.status === 401) { sessionStorage.removeItem(TOKEN_KEY); form(e.message); }
            else root().innerHTML = `<section class="canvas-connect"><div class="canvas-eyebrow">CANVAS CONNECTION</div><h1>We couldn’t load your dashboard.</h1><div class="canvas-error" role="alert">${esc(e.message || 'Canvas request failed.')}</div><p class="canvas-lede">Check that your school URL is correct and that the token is current and has access to this data. If your school uses a custom Canvas domain, ask the Hero administrator to allowlist it.</p><button class="canvas-secondary" onclick="heroCanvasDisconnect()">Return to secure setup</button></section>`;
        } finally { loading = false; }
    };
    const renderDashboard = (data) => {
        const now = Date.now();
        const due = data.assignments.filter(a => a.due_at && new Date(a.due_at).getTime() >= now && !a.has_submitted_submissions).slice(0, 8);
        const overdue = data.assignments.filter(a => a.due_at && new Date(a.due_at).getTime() < now && !a.has_submitted_submissions && !a.submission?.workflow_state?.match(/submitted|graded/)).length;
        const submitted = data.assignments.filter(a => a.has_submitted_submissions || a.submission?.submitted_at).length;
        const avg = data.grades.filter(g => Number.isFinite(g.score)).map(g => g.score);
        const mean = avg.length ? `${Math.round(avg.reduce((x,y) => x + y, 0) / avg.length)}%` : '—';
        const dueCards = due.map(a => `<article class="canvas-work-card"><div class="canvas-work-top"><span class="canvas-course-pill">${esc(a.courseName)}</span><span class="${new Date(a.due_at).getTime() < now + 86400000 ? 'canvas-due-soon' : 'canvas-due-date'}">${esc(fmtDate(a.due_at))}</span></div><h3>${esc(a.name || 'Assignment')}</h3><p>${a.isCanvasQuiz ? 'Quiz' : 'Assignment'}${a.points_possible != null ? ` · ${esc(a.points_possible)} points` : ''}${a.submission_types?.includes('online_quiz') && !a.isCanvasQuiz ? ' · Quiz' : ''}</p></article>`).join('');
        const gradeCards = data.grades.map(g => `<div class="canvas-grade-row"><span>${esc(g.courseName)}</span><strong>${esc(g.grade || (Number.isFinite(g.score) ? `${Math.round(g.score)}%` : '—'))}</strong></div>`).join('');
        const courseCards = data.courses.map(c => `<article class="canvas-course-card"><span class="canvas-course-orb"></span><h3>${esc(c.name)}</h3><p>${esc(c.course_code || c.term?.name || 'Active course')}</p></article>`).join('');
        const announcementCards = data.announcements.map(a => `<article class="canvas-announcement"><small>${esc(a.courseName)} · ${esc(fmtDate(a.posted_at))}</small><h3>${esc(a.title || 'Course announcement')}</h3><p>${esc(String(a.message || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 260))}</p></article>`).join('');
        root().innerHTML = `<section class="canvas-overview">
            <header class="canvas-welcome"><div><div class="canvas-eyebrow">YOUR STUDY SEASON, IN FOCUS</div><h1>Good to see you, ${esc(data.name)}.</h1><p>Your classes and next steps, gathered in one place.</p></div><div class="canvas-actions"><button class="canvas-secondary" onclick="heroCanvasRefresh()"><i data-lucide="refresh-cw"></i> Refresh</button><button class="canvas-secondary" onclick="heroCanvasDisconnect()"><i data-lucide="log-out"></i> Disconnect</button></div></header>
            <div class="canvas-stats"><article><span>COURSES</span><strong>${data.courses.length}</strong><small>active this term</small></article><article><span>GRADE SNAPSHOT</span><strong>${esc(mean)}</strong><small>average of available scores</small></article><article><span>UP NEXT</span><strong>${due.length || '—'}</strong><small>upcoming items shown</small></article><article><span>PAST DUE</span><strong class="${overdue ? 'canvas-stat-alert' : ''}">${overdue}</strong><small>${submitted} submitted or graded</small></article></div>
            <div class="canvas-content-grid"><section class="canvas-section canvas-deadlines"><div class="canvas-section-head"><div><div class="canvas-eyebrow">THE NEAR HORIZON</div><h2>Coming up</h2></div><span>${due.length} upcoming</span></div>${dueCards || '<p class="canvas-empty">You’re clear for now. Enjoy the breathing room.</p>'}</section>
                <section class="canvas-section canvas-grades"><div class="canvas-section-head"><div><div class="canvas-eyebrow">YOUR PROGRESS</div><h2>Gradebook</h2></div></div>${gradeCards || '<p class="canvas-empty">Canvas did not return current grades for these courses.</p>'}</section>
                <section class="canvas-section canvas-classes"><div class="canvas-section-head"><div><div class="canvas-eyebrow">YOUR SCHEDULE</div><h2>Courses</h2></div></div><div class="canvas-course-grid">${courseCards || '<p class="canvas-empty">No active courses were returned.</p>'}</div></section>
                <section class="canvas-section canvas-announcements"><div class="canvas-section-head"><div><div class="canvas-eyebrow">FROM YOUR INSTRUCTORS</div><h2>Announcements</h2></div></div>${announcementCards || '<p class="canvas-empty">No recent announcements were returned.</p>'}</section></div>
            <p class="canvas-refresh-note">Canvas data is read live when you connect. Verify important grades and due dates in Canvas.</p>
        </section>`;
        lucide.createIcons();
    };
    window.heroCanvasDisconnect = () => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(URL_KEY); snapshot = null; form(); };
    window.heroCanvasRefresh = () => { const token = sessionStorage.getItem(TOKEN_KEY), url = sessionStorage.getItem(URL_KEY); if (token && url) { snapshot = null; loadDashboard(url, token); } };
    window.heroCanvasGetClioContext = () => {
        if (!snapshot) return '';
        const a = snapshot.assignments.filter(x => x.due_at && !x.has_submitted_submissions).slice(0, 5).map(x => `${x.name} (${x.courseName}, due ${fmtDate(x.due_at)})`);
        const g = snapshot.grades.slice(0, 8).map(x => `${x.courseName}: ${x.grade || (Number.isFinite(x.score) ? `${Math.round(x.score)}%` : 'grade unavailable')}`);
        const ann = snapshot.announcements.slice(0, 3).map(x => `${x.courseName}: ${x.title}`);
        return `Student name: ${snapshot.name}. Courses: ${snapshot.courses.map(x => x.name).slice(0, 8).join('; ')}. Grades: ${g.join('; ')}. Upcoming work: ${a.join('; ')}. Recent announcements: ${ann.join('; ')}`.slice(0, 2400);
    };
    window.addEventListener('hero-auth-state', (e) => {
        if (e.detail?.authorized && sessionStorage.getItem(TOKEN_KEY) && sessionStorage.getItem(URL_KEY) && !snapshot) loadDashboard(sessionStorage.getItem(URL_KEY), sessionStorage.getItem(TOKEN_KEY));
    });
    window.addEventListener('hero-view-change', (e) => { if (e.detail === 'canvas-view' && !snapshot) { const token = sessionStorage.getItem(TOKEN_KEY), url = sessionStorage.getItem(URL_KEY); if (token && url) loadDashboard(url, token); else form(); } });
    const oldSwitch = window.switchView;
    if (oldSwitch) window.switchView = function(id, ...args) { const r = oldSwitch.call(this, id, ...args); if (id === 'canvas-view' && !snapshot) { const token = sessionStorage.getItem(TOKEN_KEY), url = sessionStorage.getItem(URL_KEY); if (token && url) loadDashboard(url, token); else form(); } window.dispatchEvent(new CustomEvent('hero-view-change', { detail: id })); return r; };
})();
