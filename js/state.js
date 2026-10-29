// ============================================================
// state.js — targets 狀態 + localStorage 讀寫
// ============================================================
import { STORAGE_KEY, DEFAULT_TARGETS, DEFAULT_INDEX_TARGETS } from './config.js';

const INDEX_MIGRATED_KEY = 'stockTargetsIndexMigrated';

// 一次性遷移：舊的 localStorage 清單沒有指數列，補在最上方（使用者之後刪除不會再被補回）
function migrateIndexTargets(list) {
    if (localStorage.getItem(INDEX_MIGRATED_KEY)) return list;
    const indexSymbols = new Set(DEFAULT_INDEX_TARGETS.map(t => t.symbol));
    const rest = list.filter(t => !indexSymbols.has(t.symbol));
    const merged = [...JSON.parse(JSON.stringify(DEFAULT_INDEX_TARGETS)), ...rest];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    localStorage.setItem(INDEX_MIGRATED_KEY, '1');
    return merged;
}

function loadTargets() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return migrateIndexTargets(JSON.parse(saved));
    } catch (e) {
        console.warn('讀取 localStorage 失敗，使用預設標的', e);
    }
    try { localStorage.setItem(INDEX_MIGRATED_KEY, '1'); } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_TARGETS));
}

export let targets = loadTargets();

export function saveTargets() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
}

export function setTargets(newTargets) {
    targets = newTargets;
}

export function toggleAttention(symbol) {
    const target = targets.find(t => t.symbol === symbol);
    if (target) {
        target.isAttention = !target.isAttention;
        saveTargets();
        // 觸發重新渲染
        document.dispatchEvent(new Event('stock:reload'));
    }
}
