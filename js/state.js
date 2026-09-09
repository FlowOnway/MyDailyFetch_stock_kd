// ============================================================
// state.js — targets 狀態 + localStorage 讀寫
// ============================================================
import { STORAGE_KEY, DEFAULT_TARGETS, APP_SETTINGS_KEY, DEFAULT_APP_SETTINGS } from './config.js';

function loadTargets() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('讀取 localStorage 失敗，使用預設標的', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_TARGETS));
}

export let targets = loadTargets();

export function saveTargets() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
}

export function setTargets(newTargets) {
    targets = newTargets;
}

function loadAppSettings() {
    try {
        const saved = localStorage.getItem(APP_SETTINGS_KEY);
        if (saved) return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
        console.warn('讀取設定失敗，使用預設設定', e);
    }
    return { ...DEFAULT_APP_SETTINGS };
}

export let appSettings = loadAppSettings();

export function saveAppSettings() {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings));
}

export function setAppSettings(patch) {
    appSettings = { ...appSettings, ...patch };
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
