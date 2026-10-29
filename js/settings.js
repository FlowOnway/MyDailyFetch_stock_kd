// ============================================================
// settings.js — 設定 Modal CRUD + 匯出/匯入
// ============================================================
import { RULE_OPTIONS, DOT_COUNT, DEFAULT_TARGETS, DEFAULT_CATEGORIES, deriveStep, deriveApiSymbol } from './config.js';
import {
    targets, setTargets, saveTargets,
    categories, setCategories, getCategory, withMissingCategories, parseCategories,
} from './state.js';
import { escapeHtml, escapeAttr, ruleDetailHtml } from './ui.js';
import { fetchYahooData } from './api.js';
import { getAllMemos, importMemos } from './memo.js';

let editingSymbol = null;
let editingCategory = null;
let pendingDeleteCategory = null;

// Sortable 由 index.html 以全域 script 載入；載入失敗時仍可用鍵盤調整
const SORT_OPTIONS = {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sort-ghost',
    chosenClass: 'sort-chosen',
};
const targetSortables = [];
const categorySortables = [];
let sortKeyboardBound = false;

function destroySortables(list) {
    list.splice(0).forEach(s => s.destroy());
}

function dragHandle(label) {
    return `<button type="button" class="drag-handle" aria-label="${escapeHtml(label)}（拖曳或按上下方向鍵）" title="拖曳調整順序">⋮⋮</button>`;
}

// 只重排該類別的標的，填回它在 targets 中原本佔用的位置，其他類別相對順序不變
function commitTargetOrder(container) {
    const category = container.dataset.cat;
    const orderedSymbols = [...container.children].map(el => el.dataset.sym);
    const slots = [];
    targets.forEach((t, i) => { if (t.category === category) slots.push(i); });
    const bySymbol = new Map(targets.map(t => [t.symbol, t]));
    if (orderedSymbols.length !== slots.length || orderedSymbols.some(s => !bySymbol.has(s))) return;

    const next = targets.slice();
    orderedSymbols.forEach((sym, k) => { next[slots[k]] = bySymbol.get(sym); });
    setTargets(next);
}

function commitCategoryOrder(list) {
    const names = [...list.querySelectorAll(':scope > .cat-item')].map(el => el.dataset.name);
    const ordered = names.map(getCategory);
    if (ordered.length !== categories.length || ordered.some(c => !c)) return;
    setCategories(ordered);
    populateCategorySelect();
    renderSettingsList();
}

function bindSortKeyboard() {
    if (sortKeyboardBound) return;
    sortKeyboardBound = true;
    document.getElementById('tabTargets').addEventListener('keydown', onHandleKeydown);
    document.getElementById('tabCategories').addEventListener('keydown', onHandleKeydown);
}

function onHandleKeydown(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    e.preventDefault();

    const item = handle.closest('.cat-item, .set-item[data-sym]');
    const up = e.key === 'ArrowUp';
    const sibling = up ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    const container = item.parentElement;
    container.insertBefore(up ? item : sibling, up ? sibling : item);

    if (item.classList.contains('cat-item')) {
        commitCategoryOrder(container);
        // 類別列表未重繪，把焦點還給原把手
        item.querySelector('.drag-handle').focus();
    } else {
        commitTargetOrder(container);
        handle.focus();
    }
}
let symbolLookupTimer = null;
let symbolLookupSeq = 0;
let symbolLookupBound = false;

function buildLookupCandidates(symbol) {
    if (!symbol) return [];
    if (symbol.startsWith('^')) return [symbol];
    if (symbol.includes('.')) return [symbol];
    return [`${symbol}.TW`, `${symbol}.TWO`, symbol];
}

// 回傳第一個成功回應的 { name, apiSymbol }；全部失敗時回傳 { name: '', apiSymbol: null }
async function lookupSymbol(symbol) {
    const candidates = buildLookupCandidates(symbol);
    for (const candidate of candidates) {
        try {
            const parsed = await fetchYahooData(candidate, { forceFresh: false });
            const result = parsed?.chart?.result?.[0];
            const meta = result?.meta || {};
            const name = meta.longName || meta.shortName || '';
            if (name) return { name, apiSymbol: candidate };
        } catch (_) {
            // 忽略單一候選失敗，繼續嘗試下一個
        }
    }
    return { name: '', apiSymbol: null };
}

async function resolveApiSymbol(symbol) {
    const { apiSymbol } = await lookupSymbol(symbol);
    return apiSymbol || deriveApiSymbol(symbol);
}

async function runAutoFillName(symbol) {
    const symbolInput = document.getElementById('inputSymbol');
    const nameInput = document.getElementById('inputName');
    const errEl = document.getElementById('formError');
    if (!symbolInput || !nameInput || !errEl) return;
    if (!symbol) return;

    const currentSeq = ++symbolLookupSeq;
    const shouldOverwrite = !nameInput.value.trim() || nameInput.dataset.autofilled === '1';
    if (!shouldOverwrite) return;

    const { name: foundName } = await lookupSymbol(symbol);
    if (currentSeq !== symbolLookupSeq) return;

    const latestSymbol = symbolInput.value.trim().toUpperCase();
    if (latestSymbol !== symbol) return;

    if (foundName) {
        nameInput.value = foundName;
        nameInput.dataset.autofilled = '1';
        if (errEl.dataset.lookupMsg === '1') {
            errEl.style.display = 'none';
            errEl.dataset.lookupMsg = '0';
        }
    }
}

function queueAutoFillName() {
    const symbolInput = document.getElementById('inputSymbol');
    if (!symbolInput) return;

    const normalized = symbolInput.value.trim().toUpperCase();
    symbolInput.value = normalized;

    if (symbolLookupTimer) clearTimeout(symbolLookupTimer);
    if (!normalized) return;
    symbolLookupTimer = setTimeout(() => {
        runAutoFillName(normalized);
    }, 450);
}

function bindAutoFillEvents() {
    if (symbolLookupBound) return;
    const symbolInput = document.getElementById('inputSymbol');
    const nameInput = document.getElementById('inputName');
    if (!symbolInput || !nameInput) return;

    symbolInput.addEventListener('input', queueAutoFillName);
    symbolInput.addEventListener('blur', () => {
        if (symbolLookupTimer) clearTimeout(symbolLookupTimer);
        const normalized = symbolInput.value.trim().toUpperCase();
        symbolInput.value = normalized;
        runAutoFillName(normalized);
    });

    nameInput.addEventListener('input', () => {
        nameInput.dataset.autofilled = '0';
    });

    symbolLookupBound = true;
}

// 通知 main.js 重新載入資料（避免循環依賴）
function requestReload() {
    document.dispatchEvent(new CustomEvent('stock:reload'));
}

export function openSettings() {
    bindAutoFillEvents();
    bindSortKeyboard();
    document.getElementById('settingsModal').style.display = 'flex';
    populateRuleSelect();
    renderCategoryList();
    populateCategorySelect();
    renderSettingsList();
    switchSettingsTab('targets');
}

export function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
    cancelEdit();
    cancelCategoryEdit();
}

export function switchSettingsTab(tab) {
    for (const name of ['targets', 'categories']) {
        const active = name === tab;
        const suffix = name === 'targets' ? 'Targets' : 'Categories';
        const btn = document.getElementById(`tabBtn${suffix}`);
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
        document.getElementById(`tab${suffix}`).hidden = !active;
    }
}

function updateTabCounts() {
    document.getElementById('tabCountTargets').textContent = targets.length;
    document.getElementById('tabCountCategories').textContent = categories.length;
}

// 從群組標題的「＋」直接帶入類別開始新增標的
export function addTargetToCategory(name) {
    cancelEdit();
    document.getElementById('inputCategory').value = name;
    document.getElementById('inputSymbol').focus();
}

export function renderSettingsList() {
    updateTabCounts();
    const list = document.getElementById('settingsList');
    destroySortables(targetSortables);
    if (targets.length === 0) {
        list.innerHTML = '<div style="padding:32px 22px;text-align:center;color:var(--text-dim);font-size:13px;">尚無任何標的，請從下方新增</div>';
        return;
    }
    list.innerHTML = categories.map((c) => {
        const items = targets.filter(t => t.category === c.name);
        if (items.length === 0) return '';
        const name = escapeHtml(c.name);
        const header = `<div class="set-group">
            <span class="dot dot-${c.dot}" style="flex-shrink:0;"></span>
            <span class="set-group-name">${name}</span>
            <span class="set-group-count">${items.length}</span>
            <button data-name="${name}" onclick="addTargetToCategory(this.dataset.name)" class="btn btn-ghost set-group-add" aria-label="新增標的到 ${name}">＋ 新增</button>
        </div>`;
        const rows = items.map(t => `<div class="set-item" data-sym="${escapeAttr(t.symbol)}">
            <div class="set-item-info">
                ${dragHandle(`調整 ${t.name} 的順序`)}
                <span class="set-item-name">${escapeHtml(t.name)}</span>
                <span class="code-tag">${escapeHtml(t.symbol)}</span>
            </div>
            <div class="set-item-btns">
                <button data-sym="${escapeAttr(t.symbol)}" onclick="editTarget(this.dataset.sym)" class="btn btn-ghost" style="padding:4px 10px;font-size:12px;">編輯</button>
                <button data-sym="${escapeAttr(t.symbol)}" onclick="deleteTarget(this.dataset.sym)" class="btn btn-danger" style="padding:4px 10px;font-size:12px;">刪除</button>
            </div>
        </div>`).join('');
        return header + `<div class="set-sortable" data-cat="${name}">${rows}</div>`;
    }).join('');

    if (typeof Sortable === 'undefined') return;
    list.querySelectorAll('.set-sortable').forEach((el) => {
        targetSortables.push(new Sortable(el, {
            ...SORT_OPTIONS,
            onEnd: () => commitTargetOrder(el),
        }));
    });
}

export function editTarget(symbol) {
    const target = targets.find(t => t.symbol === symbol);
    if (!target) return;
    editingSymbol = symbol;
    document.getElementById('inputSymbol').value = target.symbol;
    const nameInput = document.getElementById('inputName');
    nameInput.value = target.name;
    nameInput.dataset.autofilled = '0';
    document.getElementById('inputCategory').value = target.category;
    document.getElementById('formTitle').textContent = `✏ 編輯：${target.name}`;
    document.getElementById('submitBtn').textContent = '更新';
    document.getElementById('cancelEditBtn').style.display = '';
    document.getElementById('formError').style.display = 'none';
    document.getElementById('inputSymbol').focus();
}

export function cancelEdit() {
    editingSymbol = null;
    symbolLookupSeq++;
    if (symbolLookupTimer) clearTimeout(symbolLookupTimer);
    document.getElementById('inputSymbol').value = '';
    document.getElementById('inputName').value = '';
    document.getElementById('inputName').dataset.autofilled = '0';
    document.getElementById('inputCategory').value = defaultCategoryName();
    document.getElementById('formTitle').textContent = '新增標的';
    document.getElementById('submitBtn').textContent = '新增';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('formError').style.display = 'none';
}

export function deleteTarget(symbol) {
    setTargets(targets.filter(t => t.symbol !== symbol));
    renderSettingsList();
    renderCategoryList();
}

// ── 類別管理 ────────────────────────────────────────────────

function defaultCategoryName() {
    return getCategory('台灣市值型 ETF')?.name ?? categories[0]?.name ?? '';
}

function nextDot() {
    const used = new Set(categories.map(c => c.dot));
    for (let i = 0; i < DOT_COUNT; i++) if (!used.has(i)) return i;
    return categories.length % DOT_COUNT;
}

function showCategoryError(msg) {
    const el = document.getElementById('catFormError');
    el.textContent = msg;
    el.style.display = '';
}

function populateCategorySelect(preferred) {
    const sel = document.getElementById('inputCategory');
    const current = preferred ?? sel.value;
    sel.innerHTML = categories
        .map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`)
        .join('');
    sel.value = getCategory(current) ? current : defaultCategoryName();
}

function updateRuleHint() {
    const sel = document.getElementById('inputCatRule');
    const rule = RULE_OPTIONS.find(r => String(r.step) === sel.value);
    document.getElementById('catRuleHint').innerHTML = rule ? ruleDetailHtml(rule) : '';
}

function populateRuleSelect() {
    const sel = document.getElementById('inputCatRule');
    if (!sel.options.length) {
        sel.innerHTML = RULE_OPTIONS
            .map(r => `<option value="${r.step}">${escapeHtml(r.label)}</option>`)
            .join('');
        sel.value = '4';
        sel.addEventListener('change', updateRuleHint);
    }
    updateRuleHint();
}

function refreshCategoryViews(preferredCategory) {
    renderCategoryList();
    populateCategorySelect(preferredCategory);
    renderSettingsList();
}

export function renderCategoryList() {
    updateTabCounts();
    const list = document.getElementById('categoryList');
    destroySortables(categorySortables);
    list.innerHTML = categories.map((c) => {
        const count = targets.filter(t => t.category === c.name).length;
        const rule = RULE_OPTIONS.find(r => r.step === c.step)?.label ?? `規則 ${c.step}`;
        const name = escapeHtml(c.name);
        const row = `<div class="set-item">
            <div class="set-item-info">
                ${dragHandle(`調整類別 ${c.name} 的順序`)}
                <span class="dot dot-${c.dot}" style="flex-shrink:0;"></span>
                <span class="set-item-name">${name}</span>
                <span class="set-item-cat">${escapeHtml(rule)}・${count} 檔</span>
            </div>
            <div class="set-item-btns">
                <button data-name="${name}" onclick="editCategory(this.dataset.name)" class="btn btn-ghost" style="padding:4px 10px;font-size:12px;">編輯</button>
                <button data-name="${name}" onclick="deleteCategory(this.dataset.name)" class="btn btn-danger" style="padding:4px 10px;font-size:12px;">刪除</button>
            </div>
        </div>`;
        if (pendingDeleteCategory !== c.name) return `<div class="cat-item" data-name="${name}">${row}</div>`;

        const options = categories
            .filter(o => o.name !== c.name)
            .map(o => `<option value="${escapeHtml(o.name)}">${escapeHtml(o.name)}</option>`)
            .join('');
        return `<div class="cat-item" data-name="${name}">${row}<div class="cat-move">
            <span>「${name}」底下有 ${count} 檔標的，移到：</span>
            <select id="catMoveTo" class="form-sel">${options}</select>
            <button data-name="${name}" onclick="confirmDeleteCategory(this.dataset.name)" class="btn btn-danger" style="padding:4px 10px;font-size:12px;">移動並刪除</button>
            <button onclick="cancelDeleteCategory()" class="btn btn-ghost" style="padding:4px 10px;font-size:12px;">取消</button>
        </div></div>`;
    }).join('');

    if (typeof Sortable === 'undefined') return;
    categorySortables.push(new Sortable(list, {
        ...SORT_OPTIONS,
        draggable: '.cat-item',
        onEnd: () => commitCategoryOrder(list),
    }));
}

export function editCategory(name) {
    const cat = getCategory(name);
    if (!cat) return;
    editingCategory = name;
    pendingDeleteCategory = null;
    document.getElementById('inputCatName').value = cat.name;
    document.getElementById('inputCatRule').value = String(cat.step);
    updateRuleHint();
    document.getElementById('catFormTitle').textContent = `✏ 編輯類別：${cat.name}`;
    document.getElementById('catSubmitBtn').textContent = '更新';
    document.getElementById('catCancelBtn').style.display = '';
    document.getElementById('catFormError').style.display = 'none';
    renderCategoryList();
    document.getElementById('inputCatName').focus();
}

export function cancelCategoryEdit() {
    editingCategory = null;
    document.getElementById('inputCatName').value = '';
    document.getElementById('inputCatRule').value = '4';
    updateRuleHint();
    document.getElementById('catFormTitle').textContent = '新增類別';
    document.getElementById('catSubmitBtn').textContent = '新增';
    document.getElementById('catCancelBtn').style.display = 'none';
    document.getElementById('catFormError').style.display = 'none';
}

export function submitCategoryForm() {
    const name = document.getElementById('inputCatName').value.trim();
    const step = Number(document.getElementById('inputCatRule').value);

    if (!name) return showCategoryError('請輸入類別名稱');
    if (categories.some(c => c.name === name && c.name !== editingCategory)) {
        return showCategoryError(`類別「${name}」已存在`);
    }

    const selectedBefore = document.getElementById('inputCategory').value;
    let preferred = selectedBefore;

    if (editingCategory) {
        const oldName = editingCategory;
        setCategories(categories.map(c => (c.name === oldName ? { ...c, name, step } : c)));
        targets.forEach((t) => {
            if (t.category === oldName) {
                t.category = name;
                t.step = step;
            }
        });
        if (selectedBefore === oldName) preferred = name;
    } else {
        setCategories([...categories, { name, step, dot: nextDot() }]);
        preferred = name;
    }

    pendingDeleteCategory = null;
    cancelCategoryEdit();
    refreshCategoryViews(preferred);
}

export function deleteCategory(name) {
    if (categories.length <= 1) return showCategoryError('至少需保留一個類別');

    const count = targets.filter(t => t.category === name).length;
    document.getElementById('catFormError').style.display = 'none';
    if (count > 0) {
        pendingDeleteCategory = name;
        renderCategoryList();
        return;
    }

    setCategories(categories.filter(c => c.name !== name));
    if (editingCategory === name) cancelCategoryEdit();
    refreshCategoryViews();
}

export function cancelDeleteCategory() {
    pendingDeleteCategory = null;
    renderCategoryList();
}

export function confirmDeleteCategory(name) {
    const destName = document.getElementById('catMoveTo')?.value;
    const dest = getCategory(destName);
    if (!dest || dest.name === name) return;

    targets.forEach((t) => {
        if (t.category === name) {
            t.category = dest.name;
            t.step = dest.step;
        }
    });
    const selectedBefore = document.getElementById('inputCategory').value;
    setCategories(categories.filter(c => c.name !== name));
    pendingDeleteCategory = null;
    if (editingCategory === name) cancelCategoryEdit();
    refreshCategoryViews(selectedBefore === name ? dest.name : selectedBefore);
}

export async function submitTargetForm() {
    const symbol   = document.getElementById('inputSymbol').value.trim().toUpperCase();
    const name     = document.getElementById('inputName').value.trim();
    const category = document.getElementById('inputCategory').value;
    const errEl    = document.getElementById('formError');
    const submitBtn = document.getElementById('submitBtn');

    if (!symbol || !name) {
        errEl.textContent = '請填寫代號與名稱';
        errEl.style.display = '';
        return;
    }

    // 新增模式：檢查重複代號
    if (!editingSymbol && targets.some(t => t.symbol === symbol)) {
        errEl.textContent = `代號「${symbol}」已存在，請勿重複新增`;
        errEl.style.display = '';
        return;
    }

    // 解析正確的 apiSymbol（同時試 .TW / .TWO，避免債券 ETF 用錯後綴）
    const prevBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '驗證中…';
    const resolvedApiSymbol = await resolveApiSymbol(symbol);
    submitBtn.disabled = false;
    submitBtn.textContent = prevBtnText;

    const newTarget = {
        category,
        name,
        symbol,
        apiSymbol: resolvedApiSymbol,
        step: getCategory(category)?.step ?? deriveStep(category),
    };

    if (editingSymbol) {
        const idx = targets.findIndex(t => t.symbol === editingSymbol);
        if (idx !== -1) targets[idx] = newTarget;
    } else {
        targets.push(newTarget);
    }

    cancelEdit();
    renderSettingsList();
    renderCategoryList();
    errEl.style.display = 'none';
}

export function saveSettings() {
    saveTargets();
    closeSettings();
    requestReload();
}

// ── 預設標的（合併／取代）──────────────────────────────────

const clone = (x) => JSON.parse(JSON.stringify(x));

export function toggleDefaultsPanel() {
    const panel = document.getElementById('defaultsPanel');
    panel.hidden = !panel.hidden;
    document.getElementById('defaultsStatus').textContent = '';
}

function afterDefaultsApplied(message) {
    cancelEdit();
    cancelCategoryEdit();
    pendingDeleteCategory = null;
    renderCategoryList();
    populateCategorySelect();
    renderSettingsList();
    document.getElementById('defaultsStatus').textContent = `${message}，請按「儲存並關閉」才會生效`;
}

export function mergeDefaults() {
    const have = new Set(targets.map(t => t.symbol));
    const missing = DEFAULT_TARGETS.filter(t => !have.has(t.symbol));
    if (missing.length === 0) {
        document.getElementById('defaultsStatus').textContent = '目前已包含所有預設標的，沒有需要補上的項目';
        return;
    }

    const nextCategories = categories.map(c => ({ ...c }));
    for (const dc of DEFAULT_CATEGORIES) {
        const needed = missing.some(t => t.category === dc.name);
        if (needed && !nextCategories.some(c => c.name === dc.name)) nextCategories.push({ ...dc });
    }

    // 沿用使用者既有類別的建議規則，確保同一類別的 step 一致
    const added = clone(missing).map((t) => {
        const cat = nextCategories.find(c => c.name === t.category);
        return cat ? { ...t, step: cat.step } : t;
    });
    setTargets([...targets, ...added]);
    setCategories(nextCategories);
    afterDefaultsApplied(`已補上 ${added.length} 檔預設標的`);
}

export function replaceWithDefaults() {
    if (!confirm('這會以預設清單覆蓋目前所有標的與類別（筆記會保留，但星號標記與自訂排序會消失）。確定要取代嗎？')) return;
    setTargets(clone(DEFAULT_TARGETS));
    setCategories(clone(DEFAULT_CATEGORIES));
    afterDefaultsApplied(`已改為預設清單（${DEFAULT_TARGETS.length} 檔）`);
}

export function exportTargets() {
    const exportData = {
        targets: targets,
        categories: categories,
        memos: getAllMemos(),
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-targets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importTargets(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const raw = JSON.parse(e.target.result);

            // 相容新格式 { targets: [...], memos: {...} } 與舊格式 […]
            let data;
            let importedMemos = null;
            let importedCategories = null;
            if (Array.isArray(raw)) {
                // 舊格式：純陣列
                data = raw;
            } else if (raw && Array.isArray(raw.targets)) {
                // 新格式
                data = raw.targets;
                importedMemos = raw.memos || null;
                importedCategories = parseCategories(raw.categories);
            } else {
                throw new Error('格式不正確，需為陣列或包含 targets 欄位的物件');
            }

            if (data.length === 0) throw new Error('標的清單為空');
            for (const item of data) {
                if (!item.symbol || !item.name || !item.category) throw new Error('缺少必要欄位（symbol、name、category）');
            }

            // 匯入檔有類別清單就取代，否則沿用目前的，再補上標的用到的新類別
            const nextCategories = withMissingCategories(importedCategories || categories, data);
            for (const item of data) {
                // 相容舊版匯出（補齊自動推導欄位）
                if (item.step == null) item.step    = nextCategories.find(c => c.name === item.category)?.step ?? deriveStep(item.category);
                if (!item.apiSymbol) item.apiSymbol = deriveApiSymbol(item.symbol);
            }
            setTargets(data);
            setCategories(nextCategories);
            saveTargets();

            // 匯入筆記（合併模式，不會清除未在匯入檔中的筆記）
            if (importedMemos) {
                importMemos(importedMemos, 'merge');
            }

            cancelCategoryEdit();
            renderCategoryList();
            populateCategorySelect();
            renderSettingsList();
            const memoCount = importedMemos ? Object.keys(importedMemos).length : 0;
            const memoMsg = memoCount > 0 ? `，含 ${memoCount} 筆筆記` : '';
            alert(`✅ 匯入成功，共載入 ${data.length} 筆標的${memoMsg}`);
            requestReload();
        } catch (err) {
            alert(`❌ 匯入失敗：${err.message}`);
        }
        // 重設 input，讓同一檔案可再次觸發 onchange
        event.target.value = '';
    };
    reader.readAsText(file);
}
