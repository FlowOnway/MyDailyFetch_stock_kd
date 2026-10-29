// ============================================================
// main.js — 進入點：loadData + bootstrap + 全域函式綁定
// ============================================================
import { RULE_OPTIONS } from './config.js';
import { targets, categories, toggleAttention, categoryDotClass, collapsedCats, accordionMode, setAccordionMode } from './state.js';
import { fetchStockData } from './api.js';
import { renderRow, renderSkeletonRow, escapeHtml, ruleHelpHtml, toggleMemoPanel, closeMemoDrawer, switchMemoTab } from './ui.js';
import {
    openSettings, closeSettings, renderSettingsList,
    editTarget, cancelEdit, deleteTarget, submitTargetForm,
    editCategory, cancelCategoryEdit, submitCategoryForm,
    deleteCategory, confirmDeleteCategory, cancelDeleteCategory,
    switchSettingsTab, addTargetToCategory,
    saveSettings, exportTargets, importTargets,
    toggleDefaultsPanel, mergeDefaults, replaceWithDefaults,
} from './settings.js';

// 依 collapsedCats 同步所有標題列與資料列的顯示狀態
function applyCollapse() {
    document.querySelectorAll('#dataTable .cat-group-row').forEach(tr => {
        const collapsed = collapsedCats.has(tr.dataset.cat);
        tr.classList.toggle('cat-collapsed', collapsed);
        tr.setAttribute('aria-expanded', String(!collapsed));
    });
    document.querySelectorAll('#dataTable tr[data-cat]:not(.cat-group-row)').forEach(tr => {
        tr.classList.toggle('cat-hidden', collapsedCats.has(tr.dataset.cat));
    });
}

// 開啟單一展開前的摺疊狀態，關閉開關時還原
let preAccordionCollapsed = null;

// 單一展開模式：只保留第一個展開的類別
function enforceSingleOpen(catNames) {
    const firstOpen = catNames.find(name => !collapsedCats.has(name));
    catNames.forEach(name => { if (name !== firstOpen) collapsedCats.add(name); });
}

function syncAccordionSwitch() {
    const sw = document.getElementById('accordionSwitch');
    if (sw) sw.setAttribute('aria-checked', String(accordionMode));
}

function toggleCategory(name) {
    if (collapsedCats.has(name)) {
        if (accordionMode) {
            document.querySelectorAll('#dataTable .cat-group-row').forEach(tr => collapsedCats.add(tr.dataset.cat));
        }
        collapsedCats.delete(name);
    } else {
        collapsedCats.add(name);
    }
    applyCollapse();
}

function toggleAccordionMode() {
    setAccordionMode(!accordionMode);
    syncAccordionSwitch();
    if (accordionMode) {
        preAccordionCollapsed = new Set(collapsedCats);
        enforceSingleOpen([...document.querySelectorAll('#dataTable .cat-group-row')].map(tr => tr.dataset.cat));
    } else if (preAccordionCollapsed) {
        collapsedCats.clear();
        preAccordionCollapsed.forEach(name => collapsedCats.add(name));
        preAccordionCollapsed = null;
    }
    applyCollapse();
}

async function loadData(forceFresh = false) {
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
    progLabel.textContent = '正在即時抓取最新資料…';
    progPct.textContent = '0%';

    // Group targets by category (依類別清單順序，與設定視窗一致)
    const grouped = {};
    targets.forEach(t => {
        (grouped[t.category] ||= []).push(t);
    });
    const catOrder = categories.map(c => c.name).filter(name => grouped[name]);
    if (accordionMode) {
        preAccordionCollapsed ??= new Set(collapsedCats);
        enforceSingleOpen(catOrder);
    }

    // Build skeleton rows — one group-header + N skeleton rows per category
    tableBody.innerHTML = '';
    const skeletonMap = {};
    catOrder.forEach(cat => {
        const dotCls = categoryDotClass(cat);
        const headerTr = document.createElement('tr');
        headerTr.className = 'cat-group-row';
        headerTr.dataset.cat = cat;
        headerTr.tabIndex = 0;
        headerTr.setAttribute('role', 'button');
        headerTr.innerHTML = `<td colspan="8"><div class="cat-group-inner"><svg class="cat-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg><span class="dot ${dotCls}"></span>${escapeHtml(cat)}</div></td>`;
        tableBody.appendChild(headerTr);

        grouped[cat].forEach(t => {
            const skelTr = renderSkeletonRow();
            skelTr.id = `row-${t.symbol}`;
            skelTr.dataset.cat = cat;
            tableBody.appendChild(skelTr);
            skeletonMap[t.symbol] = skelTr;
        });
    });
    applyCollapse();

    let loadedCount = 0;
    const totalCount = targets.length;

    // 所有標的統一走即時抓取（透過 Cloudflare Worker 代理）
    const promises = targets.map(async (target) => {
        const res = await fetchStockData(target, { forceFresh });
        loadedCount++;

        const pct = Math.round((loadedCount / totalCount) * 100);
        progBar.style.width = pct + '%';
        progPct.textContent = pct + '%';
        progLabel.textContent = `已完成 ${loadedCount} / ${totalCount}`;

        const newTr = renderRow(res);
        newTr.dataset.cat = target.category;
        newTr.classList.toggle('cat-hidden', collapsedCats.has(target.category));
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
        lastBadge.textContent = `更新 ${stamp}`;
        lastBadge.style.display = 'inline-block';
    }
}

// 頁尾「建議規則」說明與類別管理共用 RULE_OPTIONS
function renderRuleHelp() {
    const html = ruleHelpHtml(RULE_OPTIONS);
    document.querySelectorAll('.rule-help-content').forEach((el) => { el.innerHTML = html; });
}

// 監聽 settings.js 發出的重新載入事件（避免循環依賴）
document.addEventListener('stock:reload', () => loadData(true));

document.addEventListener('click', (e) => {
    const header = e.target.closest('#dataTable .cat-group-row');
    if (header) toggleCategory(header.dataset.cat);
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const header = e.target.closest?.('#dataTable .cat-group-row');
    if (!header) return;
    e.preventDefault();
    toggleCategory(header.dataset.cat);
});

// 首次開頁直接即時抓取
window.onload = () => {
    syncAccordionSwitch();
    renderRuleHelp();
    loadData(false);
};

// ── 全域函式綁定（供 HTML onclick 使用）──────────────────────
window.loadData          = loadData;
window.openSettings      = openSettings;
window.closeSettings     = closeSettings;
window.renderSettingsList = renderSettingsList;
window.editTarget        = editTarget;
window.cancelEdit        = cancelEdit;
window.deleteTarget      = deleteTarget;
window.submitTargetForm  = submitTargetForm;
window.editCategory      = editCategory;
window.cancelCategoryEdit = cancelCategoryEdit;
window.submitCategoryForm = submitCategoryForm;
window.deleteCategory    = deleteCategory;
window.confirmDeleteCategory = confirmDeleteCategory;
window.cancelDeleteCategory  = cancelDeleteCategory;
window.switchSettingsTab = switchSettingsTab;
window.addTargetToCategory = addTargetToCategory;
window.saveSettings      = saveSettings;
window.exportTargets     = exportTargets;
window.importTargets     = importTargets;
window.toggleAttention   = toggleAttention;
window.toggleMemoPanel   = toggleMemoPanel;
window.closeMemoDrawer   = closeMemoDrawer;
window.switchMemoTab     = switchMemoTab;
window.toggleAccordionMode = toggleAccordionMode;
window.toggleDefaultsPanel = toggleDefaultsPanel;
window.mergeDefaults     = mergeDefaults;
window.replaceWithDefaults = replaceWithDefaults;
