// ============================================================
// indicators.js — 純計算函式（無 DOM 依賴）
// ============================================================

// KD 計算函數 (9日)
export function calculateKD(highs, lows, closes, period = 9) {
    let k = 50, d = 50;
    let result = [];

    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1 || closes[i] === null) {
            result.push({ k: 50, d: 50 });
            continue;
        }

        let currentHighs = highs.slice(i - period + 1, i + 1).filter(v => v !== null);
        let currentLows = lows.slice(i - period + 1, i + 1).filter(v => v !== null);

        if (currentHighs.length === 0 || currentLows.length === 0) {
            result.push({ k: k, d: d });
            continue;
        }

        let hh = Math.max(...currentHighs);
        let ll = Math.min(...currentLows);
        let close = closes[i];

        let rsv = (hh === ll) ? k : ((close - ll) / (hh - ll)) * 100;
        k = (2 / 3) * k + (1 / 3) * rsv;
        d = (2 / 3) * d + (1 / 3) * k;

        result.push({ k: k, d: d });
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
