// ===== BULK SELECT & DELETE (locations) =====
// Click a row to select it. Shift-click selects a range; Ctrl/Cmd-click toggles one row without clearing the rest.
function bulkWire(listId, getArr, setArr, saveFn) {
    const sel = new Set(); let lastIdx = null;
    const bar = document.createElement('div');
    bar.className = 'bulk-select-toolbar mb-3'; bar.style.display = 'none';
    bar.innerHTML = `<div class="bulk-select-count"><span class="bulk-n">0</span> selected <span class="bulk-select-hint">Click a row to select; Ctrl/Cmd-click or Shift-click to add more.</span></div>
        <div class="bulk-select-actions">
            <button type="button" class="cm-btn ghost">Select all</button>
            <button type="button" class="cm-btn ghost">Clear</button>
            <button type="button" class="cm-btn ghost bulk-delete-selected">Delete selected</button>
            <button type="button" class="cm-btn ghost bulk-delete-all">Delete all</button>
        </div>`;
    const list = document.getElementById(listId); list.parentElement.insertBefore(bar, list);
    const [selAllBtn, clearBtn, delSelBtn, delAllBtn] = bar.querySelector('.bulk-select-actions').children;
    function refresh() {
        const rows = [...list.children];
        rows.forEach((r, i) => r.classList.toggle('bulk-on', sel.has(i)));
        bar.style.display = getArr().length ? 'grid' : 'none';
        bar.querySelector('.bulk-n').textContent = sel.size;
        delSelBtn.disabled = !sel.size; delSelBtn.classList.toggle('bulk-btn-off', !sel.size);
    }
    function wireRows() {
        [...list.children].forEach((row, i) => {
            row.style.cursor = 'pointer';
            row.addEventListener('mousedown', e => { if (e.shiftKey || e.metaKey || e.ctrlKey) e.preventDefault(); });
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
