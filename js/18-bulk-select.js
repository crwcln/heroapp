// ===== BULK SELECT & DELETE (locations) =====
// Click a row to select it. Shift-click selects a range; Ctrl/Cmd-click toggles one row without clearing the rest.
function bulkWire(listId, getArr, setArr, saveFn) {
    const sel = new Set(); let lastIdx = null;
    const bar = document.createElement('div');
    bar.className = 'bulk-select-toolbar flex items-center gap-2 mb-3 flex-wrap'; bar.style.display = 'none';
    bar.innerHTML = `<span class="text-xs font-bold text-slate-500"><span class="bulk-n">0</span> selected</span>
        <button class="cm-btn ghost" style="padding:6px 12px;font-size:12px">Select all</button>
        <button class="cm-btn ghost" style="padding:6px 12px;font-size:12px">Clear</button>
        <button class="cm-btn go" style="padding:6px 12px;font-size:12px;background:linear-gradient(135deg,#e11d48,#fb7185)">Delete selected</button>
        <span class="flex-1"></span>
        <button class="cm-btn ghost" style="padding:6px 12px;font-size:12px;color:#e11d48;border-color:#fda4af">Delete all</button>`;
    const list = document.getElementById(listId); list.parentElement.insertBefore(bar, list);
    const [selAllBtn, clearBtn, delSelBtn, spacer, delAllBtn] = bar.children;
    spacer.classList.add('bulk-select-spacer');
    function refresh() {
        const rows = [...list.children];
        rows.forEach((r, i) => r.classList.toggle('bulk-on', sel.has(i)));
        bar.style.display = getArr().length ? 'flex' : 'none';
        bar.querySelector('.bulk-n').textContent = sel.size;
        delSelBtn.disabled = !sel.size; delSelBtn.style.opacity = sel.size ? 1 : .5;
    }
    function wireRows() {
        [...list.children].forEach((row, i) => {
            row.style.cursor = 'pointer';
            row.onclick = (e) => {
                if (e.target.closest('button')) return;   // let the row's own delete/edit buttons work normally
                if (e.shiftKey && lastIdx !== null) { const [a, b] = [lastIdx, i].sort((x, y) => x - y); sel.clear(); for (let k = a; k <= b; k++) sel.add(k); }
                else if (e.metaKey || e.ctrlKey) { sel.has(i) ? sel.delete(i) : sel.add(i); lastIdx = i; }
                else { sel.clear(); sel.add(i); lastIdx = i; }
                refresh();
            };
        });
        refresh();
    }
    selAllBtn.onclick = () => { sel.clear(); getArr().forEach((_, i) => sel.add(i)); refresh(); };
    clearBtn.onclick = () => { sel.clear(); refresh(); };
    delSelBtn.onclick = async () => {
        if (!sel.size) return;
        if (!(await customConfirm({ title: `Remove ${sel.size} location${sel.size > 1 ? 's' : ''}?`, message: 'This cannot be undone once you deploy.', confirmText: 'Remove', danger: true }))) return;
        setArr(getArr().filter((_, i) => !sel.has(i))); sel.clear(); saveFn(); showToast('Locations removed.', 'success');
    };
    delAllBtn.onclick = async () => {
        const n = getArr().length; if (!n) return;
        if (!(await customConfirm({ title: `Delete all ${n} locations?`, message: 'Every location in this list will be removed. This cannot be undone once you deploy.', confirmText: 'Delete all', danger: true }))) return;
        setArr([]); sel.clear(); saveFn(); showToast('All locations removed.', 'success');
    };
    return wireRows;
}
const bulkAdmin = bulkWire('custom-list', () => globalLocations, (v) => { globalLocations = v; }, renderAdminList);
const bulkUser = bulkWire('user-custom-list', () => customLocations, (v) => { customLocations = v; }, () => { localStorage.setItem(QUIZZES[yearMode].custom, JSON.stringify(customLocations)); renderUserCustomList(); });
const _ral = renderAdminList, _ruc = renderUserCustomList;
renderAdminList = function () { _ral(); bulkAdmin(); };
renderUserCustomList = function () { _ruc(); bulkUser(); };
renderAdminList(); renderUserCustomList();
