// ============================================================
// indicators.js — 純計算函式（無 DOM 依賴）
// ============================================================

// KD 計算函數 (9日)
// 初始化以第一根有效 RSV 作為 K/D 起點，避免從 50 暖機造成假交叉
export function calculateKD(highs, lows, closes, period = 9) {
    let k = null, d = null;
    let result = [];

    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1 || closes[i] === null) {
            result.push({ k: NaN, d: NaN });
            continue;
        }

        let currentHighs = highs.slice(i - period + 1, i + 1).filter(v => v !== null);
        let currentLows = lows.slice(i - period + 1, i + 1).filter(v => v !== null);

        if (currentHighs.length === 0 || currentLows.length === 0) {
            result.push({ k: k ?? NaN, d: d ?? NaN });
            continue;
        }

        let hh = Math.max(...currentHighs);
        let ll = Math.min(...currentLows);
        let close = closes[i];

        // hh === ll 時（平盤無波動）RSV 定為 50，不沿用 k 值
        let rsv = (hh === ll) ? 50 : ((close - ll) / (hh - ll)) * 100;

        if (k === null) {
            // 以第一根真實 RSV 初始化，不從任意的 50 起算
            k = rsv;
            d = rsv;
        } else {
            k = (2 / 3) * k + (1 / 3) * rsv;
            d = (2 / 3) * d + (1 / 3) * k;
        }

        result.push({ k, d });
    }
    return result;
}

// ── 日 K 資料修復 ─────────────────────────────────────────────
// Yahoo 日 K 偶爾有兩種瑕疵，都會讓 KD 與其他看盤軟體對不上：
// 1. 缺漏：交易日整根 K 棒是 null → 程式會略過該日，K/D 少更新一次
// 2. 假 K 棒：休市日多出一根「開高低收皆等於前收、成交量 0」的 K 棒 → K/D 多更新一次
// 日內資料用來補缺漏（高、低為整日極值；收盤取最後一筆，約略少了尾盤集合競價）

// 缺漏只會補近期，日內資料本身也只涵蓋近一個月
export const GAP_LOOKBACK_DAYS = 28;

function localDateKey(epochSec, gmtoffset) {
    return new Date((epochSec + gmtoffset) * 1000).toISOString().slice(0, 10);
}

// 近期（非最後一根）是否有收盤為 null 的 K 棒，用來決定要不要多抓日內資料
export function hasRecentMissingBars(result, lookbackDays = GAP_LOOKBACK_DAYS) {
    const ts = result.timestamp || [];
    const close = result.indicators.quote[0].close || [];
    if (ts.length < 2) return false;
    const cutoff = ts[ts.length - 1] - lookbackDays * 86400;
    for (let i = 0; i < ts.length - 1; i++) {
        if (close[i] == null && ts[i] >= cutoff) return true;
    }
    return false;
}

// 缺漏的是否正好是最新一根的前一天（此時可用 range=1d 的 chartPreviousClose 取得官方收盤價）
export function isPrevBarMissing(result) {
    const close = result.indicators.quote[0].close || [];
    return close.length >= 2 && close[close.length - 2] == null;
}

function aggregateIntradayByDate(intradayResult) {
    const byDate = {};
    if (!intradayResult || !Array.isArray(intradayResult.timestamp)) return byDate;
    const q = intradayResult.indicators.quote[0];
    const off = intradayResult.meta?.gmtoffset ?? 0;
    intradayResult.timestamp.forEach((t, i) => {
        if (q.close[i] == null || q.high[i] == null || q.low[i] == null) return;
        const key = localDateKey(t, off);
        const b = byDate[key] ??= { h: -Infinity, l: Infinity, c: null };
        b.h = Math.max(b.h, q.high[i]);
        b.l = Math.min(b.l, q.low[i]);
        b.c = q.close[i];
    });
    return byDate;
}

// 回傳修復後的 { high, low, close }；最後一根（今日）一律保留，交給盤中補丁處理
// prevClose：最新一根前一天的官方收盤價，僅在前一天缺漏時用來取代日內最後一筆（少了尾盤集合競價）
export function repairDailyBars(result, intradayResult = null, prevClose = null) {
    const q = result.indicators.quote[0];
    const ts = result.timestamp || [];
    const off = result.meta?.gmtoffset ?? 0;
    const intraday = aggregateIntradayByDate(intradayResult);
    const out = { high: [], low: [], close: [] };
    const n = q.close.length;

    let lastClose = null;
    for (let i = 0; i < n; i++) {
        let h = q.high[i], l = q.low[i], c = q.close[i];

        if (i < n - 1 && c == null && Number.isFinite(ts[i])) {
            const a = intraday[localDateKey(ts[i], off)];
            if (a) {
                h = a.h; l = a.l; c = a.c;
                if (i === n - 2 && Number.isFinite(prevClose) && prevClose > 0) {
                    c = prevClose;
                    h = Math.max(h, c);
                    l = Math.min(l, c);
                }
            }
        }

        const isPhantom = i < n - 1 && c != null && q.volume?.[i] === 0
            && q.open?.[i] === c && h === c && l === c && lastClose === c;
        if (isPhantom) continue;

        out.high.push(h);
        out.low.push(l);
        out.close.push(c);
        if (c != null) lastClose = c;
    }
    return out;
}

// K 值方向：最新一根有效 K（盤中版含今日即時值）對比前一根有效 K（前一交易日收盤）
// 前一根之前的 K 在盤中版與收盤版相同，所以只需傳入盤中版 KD；資料不足時回傳 null
// |變化| 小於 flatThreshold 視為持平，避免 K 在小範圍內跳動造成箭頭閃爍
export function calcKTrend(kdData, flatThreshold = 0.5) {
    let nowIdx = -1;
    for (let i = kdData.length - 1; i >= 0; i--) {
        if (Number.isFinite(kdData[i].k)) { nowIdx = i; break; }
    }
    if (nowIdx < 0) return null;

    let prevIdx = -1;
    for (let i = nowIdx - 1; i >= 0; i--) {
        if (Number.isFinite(kdData[i].k)) { prevIdx = i; break; }
    }
    if (prevIdx < 0) return null;

    const prev = kdData[prevIdx].k;
    const delta = kdData[nowIdx].k - prev;
    const trend = Math.abs(delta) < flatThreshold ? 'flat' : delta > 0 ? 'up' : 'down';
    return { trend, delta, prev };
}

// 判斷邏輯
export function analyzeData(step, k, kdCross) {
    let location = '中性';
    if (k < 20) location = '低點';
    if (k > 80) location = '高點';

    let advice = '觀望';

    switch (step) {
        case 0:
            if (k < 20) advice = kdCross === '黃金交叉' ? '可買進對應 ETF（黃金交叉）' : '低檔，可分批買進對應 ETF';
            else if (k > 80) advice = kdCross === '死亡交叉' ? '可賣出對應 ETF（死亡交叉）' : '高檔，可分批賣出對應 ETF';
            break;
        case 1:
            if (k < 20) advice = '買進台灣市值型 ETF';
            else if (k > 80) advice = '賣出台灣市值型 ETF';
            break;
        case 2:
        case 3:
            if (k < 20) advice = '可買進';
            else if (k > 80) advice = '可賣出';
            break;
        case 4:
            if (k < 20) {
                advice = kdCross === '黃金交叉' ? '全買' : '部分買進(1/2資金)';
            } else if (k > 80) {
                advice = kdCross === '死亡交叉' ? '全賣' : '部分賣出(1/2股票)';
            }
            break;
    }

    return { location, advice };
}
