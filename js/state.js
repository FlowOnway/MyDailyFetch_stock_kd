// ============================================================
// state.js — targets 狀態 + localStorage 讀寫
// ============================================================
import { STORAGE_KEY, DEFAULT_TARGETS, DEFAULT_INDEX_TARGETS, CATEGORIES_STORAGE_KEY, DEFAULT_CATEGORIES, DOT_COUNT } from './config.js';

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

// 只接受合法的類別項目，避免壞掉的 localStorage 資料影響渲染
function sanitizeCategories(list) {
    if (!Array.isArray(list)) return null;
    const seen = new Set();
    const result = [];
    for (const c of list) {
        const name = typeof c?.name === 'string' ? c.name.trim() : '';
        if (!name || seen.has(name)) continue;
        seen.add(name);
        result.push({
            name,
            step: Number.isInteger(c.step) ? c.step : 4,
            dot: Number.isInteger(c.dot) ? ((c.dot % DOT_COUNT) + DOT_COUNT) % DOT_COUNT : result.length % DOT_COUNT,
        });
    }
    return result.length ? result : null;
}

// 補齊 targets 使用、但類別清單中不存在的類別（舊資料、匯入檔）
export function withMissingCategories(list, targetList) {
    const result = list.map(c => ({ ...c }));
    for (const t of targetList) {
        if (result.some(c => c.name === t.category)) continue;
        result.push({
            name: t.category,
            step: Number.isInteger(t.step) ? t.step : 4,
            dot: result.length % DOT_COUNT,
        });
    }
    return result;
}

export function parseCategories(raw) {
    return sanitizeCategories(raw);
}

function loadCategories() {
    let base = null;
    try {
        base = sanitizeCategories(JSON.parse(localStorage.getItem(CATEGORIES_STORAGE_KEY)));
    } catch (e) {
        console.warn('讀取類別清單失敗，改用預設類別', e);
    }
    return withMissingCategories(base || DEFAULT_CATEGORIES, targets);
}

export let categories = loadCategories();

export function setCategories(newCategories) {
    categories = newCategories;
}

export function getCategory(name) {
    return categories.find(c => c.name === name) || null;
}

export function categoryDotClass(name) {
    return `dot-${getCategory(name)?.dot ?? 1}`;
}

// ── 類別摺疊（摺疊狀態不持久化，只記住「單一展開」開關）──
const ACCORDION_KEY = 'stockAccordionMode';

export const collapsedCats = new Set();

function loadAccordionMode() {
    try { return localStorage.getItem(ACCORDION_KEY) === '1'; } catch (e) { return false; }
}

export let accordionMode = loadAccordionMode();

export function setAccordionMode(on) {
    accordionMode = on;
    try { localStorage.setItem(ACCORDION_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
}

export function saveTargets() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
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
