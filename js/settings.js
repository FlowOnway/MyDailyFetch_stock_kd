// ============================================================
// settings.js — 設定 Modal CRUD + 匯出/匯入
// ============================================================
import { CATEGORY_DOT, deriveStep, deriveApiSymbol } from './config.js';
import { targets, setTargets, saveTargets } from './state.js';
import { escapeHtml, escapeAttr } from './ui.js';
import { fetchYahooData } from './api.js';
import { getAllMemos, importMemos } from './memo.js';

let editingSymbol = null;
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
    document.getElementById('settingsModal').style.display = 'flex';
    renderSettingsList();
}

export function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
    cancelEdit();
}

export function renderSettingsList() {
    const list = document.getElementById('settingsList');
    if (targets.length === 0) {
        list.innerHTML = '<div style="padding:32px 22px;text-align:center;color:var(--text-dim);font-size:13px;">尚無任何標的，請從下方新增</div>';
        return;
    }
    list.innerHTML = targets.map((t) => {
        const dotCls = CATEGORY_DOT[t.category] || 'dot-1';
        return `<div class="set-item">
            <div class="set-item-info">
                <span class="dot ${dotCls}" style="flex-shrink:0;"></span>
                <span class="set-item-name">${escapeHtml(t.name)}</span>
                <span class="code-tag">${escapeHtml(t.symbol)}</span>
                <span class="set-item-cat">${escapeHtml(t.category)}</span>
            </div>
            <div class="set-item-btns">
                <button data-sym="${escapeAttr(t.symbol)}" onclick="editTarget(this.dataset.sym)" class="btn btn-ghost" style="padding:4px 10px;font-size:12px;">編輯</button>
                <button data-sym="${escapeAttr(t.symbol)}" onclick="deleteTarget(this.dataset.sym)" class="btn btn-danger" style="padding:4px 10px;font-size:12px;">刪除</button>
            </div>
        </div>`;
    }).join('');
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
    document.getElementById('inputCategory').value = '台灣市值型 ETF';
    document.getElementById('formTitle').textContent = '新增標的';
    document.getElementById('submitBtn').textContent = '新增';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('formError').style.display = 'none';
}

export function deleteTarget(symbol) {
    setTargets(targets.filter(t => t.symbol !== symbol));
    renderSettingsList();
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
        step: deriveStep(category),
    };

    if (editingSymbol) {
        const idx = targets.findIndex(t => t.symbol === editingSymbol);
        if (idx !== -1) targets[idx] = newTarget;
    } else {
        targets.push(newTarget);
    }

    cancelEdit();
    renderSettingsList();
    errEl.style.display = 'none';
}

export function saveSettings() {
    saveTargets();
    closeSettings();
    requestReload();
}

export function exportTargets() {
    const exportData = {
        targets: targets,
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
            if (Array.isArray(raw)) {
                // 舊格式：純陣列
                data = raw;
            } else if (raw && Array.isArray(raw.targets)) {
                // 新格式
                data = raw.targets;
                importedMemos = raw.memos || null;
            } else {
                throw new Error('格式不正確，需為陣列或包含 targets 欄位的物件');
            }

            if (data.length === 0) throw new Error('標的清單為空');
            for (const item of data) {
                if (!item.symbol || !item.name || !item.category) throw new Error('缺少必要欄位（symbol、name、category）');
                // 相容舊版匯出（補齊自動推導欄位）
                if (!item.step)      item.step      = deriveStep(item.category);
                if (!item.apiSymbol) item.apiSymbol = deriveApiSymbol(item.symbol);
            }
            setTargets(data);
            saveTargets();

            // 匯入筆記（合併模式，不會清除未在匯入檔中的筆記）
            if (importedMemos) {
                importMemos(importedMemos, 'merge');
            }

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
