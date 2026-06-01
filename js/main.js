// ============================================================
// main.js — 進入點：loadData + bootstrap + 全域函式綁定
// ============================================================
import { CATEGORY_DOT } from './config.js';
import { targets } from './state.js';
import { fetchStockData } from './api.js';
import { renderRow, renderSkeletonRow, escapeHtml } from './ui.js';
import {
    openSettings, closeSettings, renderSettingsList,
    editTarget, cancelEdit, deleteTarget, submitTargetForm,
    saveSettings, exportTargets, importTargets,
} from './settings.js';

async function loadData() {
    const tableBody  = document.getElementById('dataTable');
    const progWrap   = document.getElementById('loadingProgress');
    const progBar    = document.getElementById('progBar');
    const progLabel  = document.getElementById('progLabel');
    const progPct    = document.getElementById('progPct');
    const refreshBtn = document.getElementById('refreshBtn');
    const lastBadge  = document.getElementById('lastUpdateBadge');

    // Disable refresh button while loading
    if (refreshBtn) refreshBtn.disabled = true;
    if (lastBadge)  lastBadge.style.display = 'none';

    // Show progress bar
    progWrap.style.display = 'block';
    progBar.style.width = '0%';
    progLabel.textContent = '正在取得資料…';
    progPct.textContent = '0%';

    // Group targets by category (preserve order)
    const grouped = {};
    const catOrder = [];
    targets.forEach(t => {
        if (!grouped[t.category]) {
            grouped[t.category] = [];
            catOrder.push(t.category);
        }
        grouped[t.category].push(t);
    });

    // Build skeleton rows — one group-header + N skeleton rows per category
    tableBody.innerHTML = '';
    const skeletonMap = {};
    catOrder.forEach(cat => {
        const dotCls = CATEGORY_DOT[cat] || 'dot-1';
        const headerTr = document.createElement('tr');
        headerTr.className = 'cat-group-row';
        headerTr.innerHTML = `<td colspan="8"><div class="cat-group-inner"><span class="dot ${dotCls}"></span>${escapeHtml(cat)}</div></td>`;
        tableBody.appendChild(headerTr);

        grouped[cat].forEach(t => {
            const skelTr = renderSkeletonRow();
            skelTr.id = `row-${t.symbol}`;
            tableBody.appendChild(skelTr);
            skeletonMap[t.symbol] = skelTr;
        });
    });

    let loadedCount = 0;
    const totalCount = targets.length;

    // Fetch all in parallel; replace skeleton on completion
    const promises = targets.map(async (target) => {
        const res = await fetchStockData(target);
        loadedCount++;

        const pct = Math.round((loadedCount / totalCount) * 100);
        progBar.style.width = pct + '%';
        progPct.textContent = pct + '%';
        progLabel.textContent = `已完成 ${loadedCount} / ${totalCount}`;

        const newTr = renderRow(res);
        const oldTr = skeletonMap[target.symbol];
        if (oldTr) oldTr.replaceWith(newTr);

        return res;
    });

    await Promise.all(promises);

    // Done
    progWrap.style.display = 'none';
    if (refreshBtn) refreshBtn.disabled = false;

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${now.getMonth() + 1}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (lastBadge) { lastBadge.textContent = `更新 ${stamp}`; lastBadge.style.display = 'inline-block'; }
}

// 監聽 settings.js 發出的重新載入事件（避免循環依賴）
document.addEventListener('stock:reload', loadData);

window.onload = loadData;

// ── 全域函式綁定（供 HTML onclick 使用）──────────────────────
window.loadData          = loadData;
window.openSettings      = openSettings;
window.closeSettings     = closeSettings;
window.renderSettingsList = renderSettingsList;
window.editTarget        = editTarget;
window.cancelEdit        = cancelEdit;
window.deleteTarget      = deleteTarget;
window.submitTargetForm  = submitTargetForm;
window.saveSettings      = saveSettings;
window.exportTargets     = exportTargets;
window.importTargets     = importTargets;
