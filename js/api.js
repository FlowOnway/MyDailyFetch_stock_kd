// ============================================================
// api.js — Yahoo Finance 資料獲取層
// ============================================================
import { PROXY_GENERATORS } from './config.js';
import { calculateKD, analyzeData } from './indicators.js';

// 記憶當前穩定運作的代理伺服器索引
let currentProxyIndex = 0;

// 一般載入允許短秒級快取，手動刷新可強制繞過
const CACHE_WINDOW_MS = 60000;

function buildCacheKey(forceFresh = false) {
    if (forceFresh) return Date.now();
    return Math.floor(Date.now() / CACHE_WINDOW_MS);
}

function formatLocalDate(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getMonth() + 1}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function fetchYahooData(symbol, options = {}) {
    const { forceFresh = false } = options;

    // 一般情況採短秒級快取；強制刷新時改為毫秒鍵，盡量取最新
    const cacheKey = buildCacheKey(forceFresh);

    const endpoints = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo&_=${cacheKey}`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo&_=${cacheKey}`,
    ];

    let lastError;

    for (let endpoint of endpoints) {
        for (let attempt = 0; attempt < PROXY_GENERATORS.length; attempt++) {
            // 優先使用上次成功運作的代理器 (Sticky Proxy 機制)
            let proxyIndex = (currentProxyIndex + attempt) % PROXY_GENERATORS.length;
            let proxy = PROXY_GENERATORS[proxyIndex];
            let proxyUrl = proxy.build(endpoint, cacheKey);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 18000);

                let response;
                try {
                    response = await fetch(proxyUrl, {
                        signal: controller.signal,
                        headers: { 'Accept': 'application/json' },
                        cache: 'no-store',
                    });
                } catch (fetchErr) {
                    throw new Error(`NETWORK_ERROR (${fetchErr.name || fetchErr.message})`);
                } finally {
                    clearTimeout(timeoutId);
                }

                if (response.status === 404) throw new Error('NOT_FOUND');

                let text = await response.text();

                // 針對 allorigins /get 的特例解析
                if (proxy.id === 'allorigins_get') {
                    let jsonWrap;
                    try {
                        jsonWrap = JSON.parse(text);
                    } catch (e) {
                        throw new Error('INVALID_PROXY_JSON');
                    }
                    if (jsonWrap.status && jsonWrap.status.http_code === 404) throw new Error('NOT_FOUND');
                    text = jsonWrap.contents || '';
                }

                // 過濾非預期的純文字錯誤或 HTML（被阻擋或 Rate Limit）
                if (!text || text.trim().startsWith('<') || text.includes('Too Many Requests') || text.startsWith('Edge:')) {
                    throw new Error('PROXY_BLOCKED_OR_RATE_LIMIT');
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    throw new Error('INVALID_YAHOO_JSON');
                }

                if (data && data.chart && data.chart.result) {
                    currentProxyIndex = proxyIndex; // 成功，記住此代理
                    return data;
                } else {
                    throw new Error('INVALID_YAHOO_FORMAT');
                }
            } catch (e) {
                lastError = e;
                console.warn(`[嘗試 ${proxy.id} 失敗]: ${e.message}`);

                if (e.message === 'NOT_FOUND') {
                    throw e; // 標的真的不存在，直接拋出
                }

                // 失敗後稍等 1.5 秒再試下一個代理
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    }
    throw lastError || new Error('All endpoints and proxies failed');
}

export async function fetchStockData(item, options = {}) {
    const { forceFresh = false } = options;
    const fetchedAt = formatLocalDate(new Date());

    try {
        let parsed;
        try {
            parsed = await fetchYahooData(item.apiSymbol, { forceFresh });
        } catch (error) {
            if (error.message === 'NOT_FOUND') {
                // 嘗試另一個交易所後綴（.TW ↔ .TWO 互換）
                let fallbackSymbol = null;
                if (item.apiSymbol.endsWith('.TW')) {
                    fallbackSymbol = `${item.symbol}.TWO`;
                } else if (item.apiSymbol.includes('.TWO')) {
                    fallbackSymbol = `${item.symbol}.TW`;
                }
                if (fallbackSymbol) {
                    parsed = await fetchYahooData(fallbackSymbol, { forceFresh });
                } else {
                    throw error;
                }
            } else {
                throw error;
            }
        }

        const result = parsed.chart.result[0];
        const quotes = result.indicators.quote[0];
        const meta = result.meta || {};

        // ── 即時股價：優先使用 meta.regularMarketPrice（盤中即時更新）
        // quotes.close 的最後一筆在盤中仍是昨日收盤，只有盤後才更新
        const metaPrice = (typeof meta.regularMarketPrice === 'number') ? meta.regularMarketPrice : null;
        const validCloses = quotes.close.filter(v => v !== null);
        const fallbackPrice = validCloses.length > 0 ? validCloses[validCloses.length - 1] : null;
        const currentPrice = metaPrice ?? fallbackPrice ?? 'N/A';
        const formattedPrice = currentPrice !== 'N/A'
            ? currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : 'N/A';

        // ── 盤中補丁：將最後一根 K 棒的 high/low/close 更新為今日盤中即時數據
        // 這樣 KD 計算才會反映今日的成交價，而非只用昨日收盤
        const highs  = [...quotes.high];
        const lows   = [...quotes.low];
        const closes = [...quotes.close];
        if (metaPrice !== null) {
            const lastIdx = closes.length - 1;
            // 以今日盤中 high/low/close 覆蓋（meta 欄位在盤中會即時更新）
            if (typeof meta.regularMarketDayHigh === 'number') highs[lastIdx]  = meta.regularMarketDayHigh;
            if (typeof meta.regularMarketDayLow  === 'number') lows[lastIdx]   = meta.regularMarketDayLow;
            closes[lastIdx] = metaPrice;
        }

        // ── KD 計算分兩組，各有不同用途 ──────────────────────────────
        // [1] kdData（盤中版）：補入今日即時 high/low/close，用於顯示 K 值
        //     → 使用者能看到今天 K 值走到哪，即時反映盤中走勢
        const kdData = calculateKD(highs, lows, closes);

        // [2] kdDataClosed（收盤版）：僅用原始 quotes（已確認的收盤資料），用於判斷 KD 交叉
        //     → 交叉訊號以「昨日收盤」為基準，一整天穩定不跳動
        //     → 符合日 KD 技術分析的正統定義（日 K 棒需到收盤才算確認）
        const kdDataClosed = calculateKD(quotes.high, quotes.low, quotes.close);

        // 找最後一個有效的 K 值（盤中版，讓使用者看到今日即時 K 位置）
        let kVal = NaN;
        for (let i = kdData.length - 1; i >= 0; i--) {
            if (Number.isFinite(kdData[i].k)) { kVal = kdData[i].k; break; }
        }
        let kdCross = '無';
        let remark = '';

        if (item.step !== 1) {
            // ── KD 交叉偵測：使用 kdDataClosed（收盤確認版）────────────────
            // 優點：訊號在一整個交易日內保持穩定，不因盤中波動而忽現忽消
            // 回溯 10 根 K 棒（約 2 週），讓訊號有足夠的有效期限
            const EPS = 1e-6;
            const lookbackBars = 10;
            const startIdx = Math.max(1, kdDataClosed.length - lookbackBars);

            for (let i = kdDataClosed.length - 1; i >= startIdx; i--) {
                const p = kdDataClosed[i - 1];
                const c = kdDataClosed[i];
                if (!p || !c) continue;
                if (!Number.isFinite(p.k) || !Number.isFinite(p.d) || !Number.isFinite(c.k) || !Number.isFinite(c.d)) continue;

                const prevKBelowD = p.k < p.d + EPS;
                const prevKAboveD = p.k > p.d - EPS;
                const currKAboveD = c.k > c.d + EPS;
                const currKBelowD = c.k < c.d - EPS;

                // 黃金交叉：K 由下往上穿越 D，且穿越時 K <= 50（排除高位震盪假訊號）
                if (prevKBelowD && currKAboveD && c.k <= 50) {
                    kdCross = '黃金交叉';
                    break;
                }
                // 死亡交叉：K 由上往下穿越 D，且穿越時 K >= 50（排除低位震盪假訊號）
                if (prevKAboveD && currKBelowD && c.k >= 50) {
                    kdCross = '死亡交叉';
                    break;
                }
            }

            // ── 現況一致性驗證 ──────────────────────────────────────────
            // 過去 10 根內找到的交叉，必須和「目前的 K/D 關係」一致才有效。
            // 情境：死亡交叉發生後，K 強力反彈重新穿越 D 上方 →
            //       因為反彈時 K > 50 被高位過濾擋掉，黃金交叉未被記錄，
            //       但死亡交叉訊號已實質失效，不應繼續顯示。
            if (kdCross !== '無') {
                let latestClosed = null;
                for (let i = kdDataClosed.length - 1; i >= 0; i--) {
                    if (Number.isFinite(kdDataClosed[i].k)) { latestClosed = kdDataClosed[i]; break; }
                }
                if (latestClosed) {
                    const kNowAboveD = latestClosed.k > latestClosed.d + EPS;
                    const kNowBelowD = latestClosed.k < latestClosed.d - EPS;
                    // 死亡交叉但 K 已反向回到 D 上方 → 訊號失效
                    if (kdCross === '死亡交叉' && kNowAboveD) kdCross = '無';
                    // 黃金交叉但 K 已反向跌回 D 下方 → 訊號失效
                    if (kdCross === '黃金交叉' && kNowBelowD) kdCross = '無';
                }
            }
        } else {
            kdCross = '—';
        }

        const analysis = analyzeData(item.step, kVal, kdCross);

        // ── 更新時間：優先使用 meta.regularMarketTime（即時交易時間），
        // result.timestamp 最後一筆只是今日日 K 棒的開盤時間，精確度不足
        const sourceEpoch = (typeof meta.regularMarketTime === 'number')
            ? meta.regularMarketTime
            : Array.isArray(result.timestamp)
                ? result.timestamp.filter(v => Number.isFinite(v)).at(-1)
                : null;
        const sourceTime = sourceEpoch
            ? formatLocalDate(new Date(sourceEpoch * 1000))
            : fetchedAt;

        return {
            ...item,
            price: formattedPrice,
            kVal: kVal.toFixed(2),
            kdCross,
            location: analysis.location,
            advice: analysis.advice,
            remark,
            updateTime: sourceTime,
            fetchedAt,
            status: 'success',
        };
    } catch (error) {
        console.warn(`獲取 ${item.symbol} 失敗:`, error.message || error);

        return {
            ...item,
            price: 'N/A',
            kVal: 'N/A',
            kdCross: 'N/A',
            location: 'N/A',
            advice: '請你自行查詢',
            remark: '網路或伺服器阻擋',
            updateTime: fetchedAt,
            fetchedAt,
            status: 'error',
        };
    }
}
