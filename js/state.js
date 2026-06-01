// ============================================================
// state.js — targets 狀態 + localStorage 讀寫
// ============================================================
import { STORAGE_KEY, DEFAULT_TARGETS } from './config.js';

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
