// test_repair.mjs — 驗證日 K 資料修復（補缺漏、移除假 K 棒）
// 用法：node test_repair.mjs
import { repairDailyBars, hasRecentMissingBars, isPrevBarMissing } from './js/indicators.js';

const DAY = 86400;
const T0 = Date.UTC(2026, 9, 20, 1, 0) / 1000; // 當地 09:00（gmtoffset 8h）
const ts = n => Array.from({ length: n }, (_, i) => T0 + i * DAY);

function daily({ open, high, low, close, volume }) {
    return {
        meta: { gmtoffset: 28800 },
        timestamp: ts(close.length),
        indicators: { quote: [{ open, high, low, close, volume }] },
    };
}

function intradayFor(dayIndex, h, l, c) {
    const base = T0 + dayIndex * DAY;
    return {
        meta: { gmtoffset: 28800 },
        timestamp: [base, base + 300, base + 600],
        indicators: { quote: [{ high: [h - 1, h, h - 1], low: [l + 1, l + 1, l], close: [h - 1, l + 1, c] }] },
    };
}

let pass = 0, fail = 0;
function check(name, actual, expected) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    ok ? pass++ : fail++;
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : `\n   實際: ${JSON.stringify(actual)}\n   預期: ${JSON.stringify(expected)}`}`);
}

// 缺漏：倒數第二根為 null，用日內資料補高低，收盤用 prevClose
{
    const r = daily({
        open: [10, 11, null, 12], high: [11, 12, null, 13], low: [9, 10, null, 11],
        close: [10, 11, null, 12], volume: [1, 1, null, 1],
    });
    const intraday = intradayFor(2, 12, 10, 11.5);
    check('偵測到近期缺漏', hasRecentMissingBars(r), true);
    check('偵測到前一天缺漏', isPrevBarMissing(r), true);
    const noPrev = repairDailyBars(r, intraday);
    check('缺漏補值：收盤取日內最後一筆', [noPrev.high[2], noPrev.low[2], noPrev.close[2]], [12, 10, 11.5]);
    const withPrev = repairDailyBars(r, intraday, 11.8);
    check('缺漏補值：前一天改用官方前收盤', withPrev.close[2], 11.8);
    check('無日內資料時維持 null（沿用略過行為）', repairDailyBars(r).close[2], null);
}

// 假 K 棒：開高低收皆等於前收且成交量 0 → 移除
{
    const r = daily({
        open: [10, 11, 11, 12], high: [11, 12, 11, 13], low: [9, 10, 11, 11],
        close: [10, 11, 11, 12], volume: [5, 5, 0, 5],
    });
    check('移除休市日假 K 棒', repairDailyBars(r).close, [10, 11, 12]);
}

// 指數成交量常為 0，但開高低收不同，不可誤刪
{
    const r = daily({
        open: [10, 11, 12], high: [11, 12, 13], low: [9, 10, 11],
        close: [10, 11, 12], volume: [0, 0, 0],
    });
    check('成交量為 0 的正常 K 棒不誤刪', repairDailyBars(r).close, [10, 11, 12]);
}

// 最後一根（今日）即使為平盤、成交量 0 也保留
{
    const r = daily({
        open: [10, 11], high: [11, 11], low: [9, 11], close: [11, 11], volume: [5, 0],
    });
    check('最後一根不移除', repairDailyBars(r).close, [11, 11]);
}

console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
process.exit(fail ? 1 : 0);
