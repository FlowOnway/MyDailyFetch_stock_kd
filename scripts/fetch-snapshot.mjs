// ============================================================
// scripts/fetch-snapshot.mjs — GitHub Actions 排程用：伺服器端直連 Yahoo（無 CORS 限制，不需代理）
// 用法：node scripts/fetch-snapshot.mjs
// ============================================================
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TARGETS } from '../js/config.js';
import { buildAnalysisFromYahooData, buildErrorResult, formatLocalDate } from '../js/api.js';

const OUT_PATH = fileURLToPath(new URL('../data/latest.json', import.meta.url));

// 直連 Yahoo，不經代理；伺服器端沒有瀏覽器 CORS 限制
async function fetchYahooDirect(symbol) {
    const cacheKey = Date.now();
    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo&_=${cacheKey}`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo&_=${cacheKey}`,
    ];
    let lastError;
    for (const url of urls) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                });
                if (response.status === 404) throw new Error('NOT_FOUND');
                if (!response.ok) throw new Error(`HTTP_${response.status}`);
                const data = await response.json();
                if (data?.chart?.result) return data;
                throw new Error('INVALID_YAHOO_FORMAT');
            } catch (err) {
                lastError = err;
                if (err.message === 'NOT_FOUND') throw err;
                await new Promise(r => setTimeout(r, 800));
            } finally {
                clearTimeout(timeoutId);
            }
        }
    }
    throw lastError || new Error('ALL_ATTEMPTS_FAILED');
}

async function fetchOne(item) {
    const fetchedAt = formatLocalDate(new Date());
    try {
        let parsed;
        try {
            parsed = await fetchYahooDirect(item.apiSymbol);
        } catch (error) {
            if (error.message === 'NOT_FOUND') {
                let fallbackSymbol = null;
                if (item.apiSymbol.endsWith('.TW')) fallbackSymbol = `${item.symbol}.TWO`;
                else if (item.apiSymbol.includes('.TWO')) fallbackSymbol = `${item.symbol}.TW`;
                if (fallbackSymbol) parsed = await fetchYahooDirect(fallbackSymbol);
                else throw error;
            } else {
                throw error;
            }
        }
        const row = buildAnalysisFromYahooData(item, parsed, fetchedAt);
        return { ...row, snapshotStatus: 'ok' };
    } catch (error) {
        console.warn(`[fetch-snapshot] 抓取 ${item.symbol} 失敗:`, error.message || error);
        return { failed: true, fetchedAt, error };
    }
}

async function loadPreviousSnapshot() {
    try {
        const raw = await readFile(OUT_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        const map = {};
        (parsed.items || []).forEach(row => { map[row.symbol] = row; });
        return map;
    } catch (_) {
        return {}; // 第一次執行，還沒有舊快照
    }
}

async function main() {
    const previous = await loadPreviousSnapshot();
    const results = [];

    for (const item of DEFAULT_TARGETS) {
        const outcome = await fetchOne(item);
        if (!outcome.failed) {
            results.push(outcome);
        } else {
            // 這次抓取失敗：優先沿用上一次成功的資料，並明確標記為「舊資料」，讓前端能提示使用者
            const prevRow = previous[item.symbol];
            if (prevRow && prevRow.status === 'success') {
                results.push({ ...prevRow, snapshotStatus: 'stale' });
            } else {
                results.push({ ...buildErrorResult(item, outcome.fetchedAt, '排程抓取失敗'), snapshotStatus: 'error' });
            }
        }
        // 稍微間隔，降低被 Yahoo 限流的風險
        await new Promise(r => setTimeout(r, 300));
    }

    const snapshot = {
        generatedAt: new Date().toISOString(),
        items: results,
    };
    await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');

    const okCount = results.filter(r => r.snapshotStatus === 'ok').length;
    const staleCount = results.filter(r => r.snapshotStatus === 'stale').length;
    const errorCount = results.filter(r => r.snapshotStatus === 'error').length;
    console.log(`[fetch-snapshot] 完成：成功 ${okCount}、沿用舊資料 ${staleCount}、失敗 ${errorCount}（共 ${results.length} 筆），已寫入 data/latest.json`);
}

main().catch(err => {
    console.error('[fetch-snapshot] 執行失敗:', err);
    process.exit(1);
});
