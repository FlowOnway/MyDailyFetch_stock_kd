// ============================================================
// settings.js — 設定 Modal CRUD + 匯出/匯入
// ============================================================
import { CATEGORY_DOT, deriveStep, deriveApiSymbol } from './config.js';
import { targets, setTargets, saveTargets } from './state.js';
import { escapeHtml, escapeAttr } from './ui.js';

let editingSymbol = null;

// 通知 main.js 重新載入資料（避免循環依賴）
function requestReload() {
    document.dispatchEvent(new CustomEvent('stock:reload'));
}

export function openSettings() {
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
    document.getElementById('inputName').value = target.name;
    document.getElementById('inputCategory').value = target.category;
    document.getElementById('formTitle').textContent = `✏ 編輯：${target.name}`;
    document.getElementById('submitBtn').textContent = '更新';
    document.getElementById('cancelEditBtn').style.display = '';
    document.getElementById('formError').style.display = 'none';
    document.getElementById('inputSymbol').focus();
}

export function cancelEdit() {
    editingSymbol = null;
    document.getElementById('inputSymbol').value = '';
    document.getElementById('inputName').value = '';
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

export function submitTargetForm() {
    const symbol   = document.getElementById('inputSymbol').value.trim().toUpperCase();
    const name     = document.getElementById('inputName').value.trim();
    const category = document.getElementById('inputCategory').value;
    const errEl    = document.getElementById('formError');

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

    const newTarget = {
        category,
        name,
        symbol,
        apiSymbol: deriveApiSymbol(symbol),
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
    const json = JSON.stringify(targets, null, 2);
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
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data) || data.length === 0) throw new Error('格式不正確，需為非空陣列');
            for (const item of data) {
                if (!item.symbol || !item.name || !item.category) throw new Error('缺少必要欄位（symbol、name、category）');
                // 相容舊版匯出（補齊自動推導欄位）
                if (!item.step)      item.step      = deriveStep(item.category);
                if (!item.apiSymbol) item.apiSymbol = deriveApiSymbol(item.symbol);
            }
            setTargets(data);
            saveTargets();
            renderSettingsList();
            alert(`✅ 匯入成功，共載入 ${data.length} 筆標的`);
            requestReload();
        } catch (err) {
            alert(`❌ 匯入失敗：${err.message}`);
        }
        // 重設 input，讓同一檔案可再次觸發 onchange
        event.target.value = '';
    };
    reader.readAsText(file);
}
