// ============================================================
// api.js — Yahoo Finance 資料獲取層
// ============================================================
import { PROXY_GENERATORS } from './config.js';
import { calculateKD, analyzeData } from './indicators.js';

// 記憶當前穩定運作的代理伺服器索引
let currentProxyIndex = 0;

export async function fetchYahooData(symbol) {
    // 改用「5分鐘級別」的快取鍵，讓免費代理伺服器可利用快取回應
    const cacheKey = Math.floor(new Date().getTime() / 300000);

    const endpoints = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo&_=${cacheKey}`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo&_=${cacheKey}`,
    ];

    let lastError;

    for (let endpoint of endpoints) {
        for (let attempt = 0; attempt < PROXY_GENERATORS.length; attempt++) {
            // 優先使用上次成功運作的代理器 (Sticky Proxy 機制)
            let proxyIndex = (currentProxyIndex + attempt) % PROXY_GENERATORS.length;
            let proxy = PROXY_GENERATORS[proxyIndex];
            let proxyUrl = proxy.build(endpoint);

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

export async function fetchStockData(item) {
    try {
        let parsed;
        try {
            parsed = await fetchYahooData(item.apiSymbol);
        } catch (error) {
            if (error.message === 'NOT_FOUND' && item.apiSymbol.includes('.TWO')) {
                parsed = await fetchYahooData(`${item.symbol}.TW`);
            } else {
                throw error;
            }
        }

        const result = parsed.chart.result[0];
        const quotes = result.indicators.quote[0];

        // 取得最新股價
        const validCloses = quotes.close.filter(v => v !== null);
        const currentPrice = validCloses.length > 0 ? validCloses[validCloses.length - 1] : 'N/A';
        const formattedPrice = currentPrice !== 'N/A'
            ? currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : 'N/A';

        const kdData = calculateKD(quotes.high, quotes.low, quotes.close);
        const last = kdData[kdData.length - 1];
        const prev = kdData[kdData.length - 2];

        let kVal = last.k;
        let kdCross = '無';
        let remark = '';

        if (item.step !== 1) {
            // 近似判斷法邏輯
            if (prev) {
                const kUp = last.k > prev.k;
                const kDown = last.k < prev.k;
                const dDownOrFlat = last.d <= prev.d;
                const dUpOrFlat = last.d >= prev.d;

                if (last.k > last.d && kUp && dDownOrFlat) {
                    kdCross = '黃金交叉';
                } else if (last.k < last.d && kDown && dUpOrFlat) {
                    kdCross = '死亡交叉';
                }
            }
            remark = 'KD狀態採近似判斷';
        } else {
            kdCross = '—';
        }

        const analysis = analyzeData(item.step, kVal, kdCross);

        const now = new Date();
        const _pad = n => String(n).padStart(2, '0');
        const updateTime = `${now.getMonth() + 1}/${_pad(now.getDate())} ${_pad(now.getHours())}:${_pad(now.getMinutes())}`;

        return {
            ...item,
            price: formattedPrice,
            kVal: kVal.toFixed(2),
            kdCross,
            location: analysis.location,
            advice: analysis.advice,
            remark,
            updateTime,
            status: 'success',
        };
    } catch (error) {
        console.warn(`獲取 ${item.symbol} 失敗:`, error.message || error);

        const now = new Date();
        const _pad = n => String(n).padStart(2, '0');
        const updateTime = `${now.getMonth() + 1}/${_pad(now.getDate())} ${_pad(now.getHours())}:${_pad(now.getMinutes())}`;

        return {
            ...item,
            price: 'N/A',
            kVal: 'N/A',
            kdCross: 'N/A',
            location: 'N/A',
            advice: '請你自行查詢',
            remark: '網路或伺服器阻擋',
            updateTime,
            status: 'error',
        };
    }
}
