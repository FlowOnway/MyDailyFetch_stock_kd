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
