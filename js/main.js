// ============================================================
// main.js — 進入點：loadData + bootstrap + 全域函式綁定
// ============================================================
import { CATEGORY_DOT } from './config.js';
import { targets, appSettings, toggleAttention } from './state.js';
import { fetchStockData, fetchSnapshotData, mergeSnapshotRow } from './api.js';
import { renderRow, renderSkeletonRow, escapeHtml, toggleMemoPanel, closeMemoDrawer, switchMemoTab } from './ui.js';
import {
    openSettings, closeSettings, renderSettingsList,
    editTarget, cancelEdit, deleteTarget, submitTargetForm,
    saveSettings, exportTargets, importTargets,
} from './settings.js';

async function loadData(forceFresh = false) {
    const tableBody  = document.getElementById('dataTable');
    const progWrap   = document.getElementById('loadingProgress');
    const progBar    = document.getElementById('progBar');
    const progLabel  = document.getElementById('progLabel');
    const progPct    = document.getElementById('progPct');
    const refreshBtn = document.getElementById('refreshBtn');
    const lastBadge  = document.getElementById('lastUpdateBadge');

    // 依設定決定這次要不要整批走即時抓取（手動刷新時看 refreshButtonMode，一般載入看 dataSourceMode）
    const useLive = forceFresh
        ? appSettings.refreshButtonMode === 'live' || appSettings.dataSourceMode === 'live'
        : appSettings.dataSourceMode === 'live';

    // Disable refresh button while loading
    if (refreshBtn) refreshBtn.disabled = true;
    if (lastBadge)  lastBadge.style.display = 'none';

    // Show progress bar
    progWrap.style.display = 'block';
    progBar.style.width = '0%';
    progLabel.textContent = useLive ? '正在即時抓取最新資料…' : '正在讀取資料快照…';
    progPct.textContent = '0%';

    // 先嘗試讀取排程快照（快，不打外部代理）；讀不到就整批 fallback 走即時抓取
    let snapshotMap = {};
    let snapshotGeneratedAt = null;
    if (!useLive) {
        try {
            const snapshot = await fetchSnapshotData(forceFresh);
            snapshotGeneratedAt = snapshot.generatedAt;
            snapshot.items.forEach(row => { snapshotMap[row.symbol] = row; });
        } catch (e) {
            console.warn('讀取資料快照失敗，改為即時抓取', e);
            progLabel.textContent = '⚠ 快照讀取失敗，改為即時抓取…';
        }
    }

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

    // 快照有資料的標的直接用（不打網路）；快照沒有的（例如使用者自訂新增的）才即時抓取
    const promises = targets.map(async (target) => {
        const snapshotRow = snapshotMap[target.symbol];
        const res = snapshotRow
            ? mergeSnapshotRow(target, snapshotRow)
            : await fetchStockData(target, { forceFresh: true });
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
    if (lastBadge) {
        let text = `更新 ${stamp}`;
        if (snapshotGeneratedAt) {
            const snapDate = new Date(snapshotGeneratedAt);
            const snapStamp = `${snapDate.getMonth() + 1}/${pad(snapDate.getDate())} ${pad(snapDate.getHours())}:${pad(snapDate.getMinutes())}`;
            text += `（快照 ${snapStamp}）`;
        }
        lastBadge.textContent = text;
        lastBadge.style.display = 'inline-block';
    }
}

// 監聽 settings.js 發出的重新載入事件（避免循環依賴）
document.addEventListener('stock:reload', () => loadData(true));

// 首次開頁尊重使用者設定的預設模式，不強制即時抓取（避免一開頁就卡在代理逾時）
window.onload = () => loadData(false);

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
window.toggleAttention   = toggleAttention;
window.toggleMemoPanel   = toggleMemoPanel;
window.closeMemoDrawer   = closeMemoDrawer;
window.switchMemoTab     = switchMemoTab;


