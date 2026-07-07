// test_cross.mjs — 快速驗證 KD 交叉偵測邏輯是否正確
// 用法：node test_cross.mjs

const EPS = 1e-6;

function detectCross(kdDataClosed) {
    let kdCross = '無';
    const lookbackBars = 10;
    const startIdx = Math.max(1, kdDataClosed.length - lookbackBars);

    for (let i = kdDataClosed.length - 1; i >= startIdx; i--) {
        const p = kdDataClosed[i - 1];
        const c = kdDataClosed[i];
        if (!p || !c) continue;
        if (!Number.isFinite(p.k) || !Number.isFinite(p.d) || !Number.isFinite(c.k) || !Number.isFinite(c.d)) continue;

        // ✅ 修正後：EPS 方向正確
        const prevKBelowD = p.k < p.d - EPS;   // K 在 D 明確下方
        const prevKAboveD = p.k > p.d + EPS;   // K 在 D 明確上方
        const currKAboveD = c.k > c.d + EPS;
        const currKBelowD = c.k < c.d - EPS;

        if (prevKBelowD && currKAboveD && c.k <= 50) { kdCross = '黃金交叉'; break; }
        if (prevKAboveD && currKBelowD && c.k >= 50) { kdCross = '死亡交叉'; break; }
    }

    // 現況一致性驗證
    if (kdCross !== '無') {
        let latestClosed = null;
        for (let i = kdDataClosed.length - 1; i >= 0; i--) {
            if (Number.isFinite(kdDataClosed[i].k)) { latestClosed = kdDataClosed[i]; break; }
        }
        if (latestClosed) {
            const kNowAboveD = latestClosed.k > latestClosed.d + EPS;
            const kNowBelowD = latestClosed.k < latestClosed.d - EPS;
            if (kdCross === '死亡交叉' && kNowAboveD) kdCross = '無';
            if (kdCross === '黃金交叉' && kNowBelowD) kdCross = '無';
        }
    }
    return kdCross;
}

function detectCrossBuggy(kdDataClosed) {
    let kdCross = '無';
    const lookbackBars = 10;
    const startIdx = Math.max(1, kdDataClosed.length - lookbackBars);

    for (let i = kdDataClosed.length - 1; i >= startIdx; i--) {
        const p = kdDataClosed[i - 1];
        const c = kdDataClosed[i];
        if (!p || !c) continue;
        if (!Number.isFinite(p.k) || !Number.isFinite(p.d) || !Number.isFinite(c.k) || !Number.isFinite(c.d)) continue;

        // ❌ 原本的 bug：EPS 方向錯誤，幾乎恆為 true
        const prevKBelowD = p.k < p.d + EPS;
        const prevKAboveD = p.k > p.d - EPS;
        const currKAboveD = c.k > c.d + EPS;
        const currKBelowD = c.k < c.d - EPS;

        if (prevKBelowD && currKAboveD && c.k <= 50) { kdCross = '黃金交叉'; break; }
        if (prevKAboveD && currKBelowD && c.k >= 50) { kdCross = '死亡交叉'; break; }
    }
    return kdCross;
}

// ─── 測試案例 ───────────────────────────────────────────────────────────────

let pass = 0, fail = 0;

function test(name, data, expected) {
    const result = detectCross(data);
    const buggy  = detectCrossBuggy(data);
    const ok = result === expected;
    console.log(`${ok ? '✅' : '❌'} ${name}`);
    console.log(`   修正後: ${result} | 預期: ${expected} | 原本 bug: ${buggy}`);
    if (ok) pass++; else fail++;
}

// 案例 1：K 在低位（<50）由下往上穿越 D → 黃金交叉
test('低位黃金交叉（應觸發）', [
    { k: NaN, d: NaN },
    { k: 20,  d: 30  },   // prev: K < D
    { k: 40,  d: 35  },   // curr: K > D, K <= 50 ✓
], '黃金交叉');

// 案例 2：K 在高位（>50）由上往下穿越 D → 死亡交叉
test('高位死亡交叉（應觸發）', [
    { k: NaN, d: NaN },
    { k: 70,  d: 60  },   // prev: K > D
    { k: 55,  d: 60  },   // curr: K < D, K >= 50 ✓
], '死亡交叉');

// 案例 3：K 和 D 完全平行，沒有穿越
test('平行無交叉（應為「無」）', [
    { k: NaN, d: NaN },
    { k: 40,  d: 50  },   // K < D
    { k: 45,  d: 55  },   // K < D 仍然
], '無');

// 案例 4：高位的 K 下穿 D，但 K < 50，不應算死亡交叉
test('低位下穿非死亡交叉（應為「無」）', [
    { k: NaN, d: NaN },
    { k: 30,  d: 25  },   // prev: K > D（低位）
    { k: 20,  d: 28  },   // curr: K < D, K < 50 → 不是死亡交叉
], '無');

// 案例 5：低位的 K 上穿 D，但 K > 50，不應算黃金交叉
test('高位上穿非黃金交叉（應為「無」）', [
    { k: NaN, d: NaN },
    { k: 55,  d: 60  },   // prev: K < D（高位）
    { k: 65,  d: 60  },   // curr: K > D, K > 50 → 不是黃金交叉
], '無');

// 案例 6：K 幾乎等於 D（差距 < EPS），不應誤觸發
test('K ≈ D 不觸發（應為「無」）', [
    { k: NaN, d: NaN },
    { k: 40.0000001, d: 40.0 },  // prev: K 只比 D 高一點點（< EPS）
    { k: 40.0,       d: 40.0000001 }, // curr: K 比 D 低一點點（< EPS）
], '無');

// 案例 7：死亡交叉後 K 又反彈回 D 上 → 訊號應失效
test('死亡交叉訊號失效（應為「無」）', [
    { k: NaN, d: NaN },
    { k: 70,  d: 60  },   // prev: K > D → 死亡交叉條件 1
    { k: 55,  d: 62  },   // 死亡交叉發生（K<D, K>=50）
    { k: 65,  d: 60  },   // curr 最新: K 已反彈回 D 上方 → 失效
], '無');

// ─── 結果 ────────────────────────────────────────────────────────────────────
console.log(`\n結果：${pass} 通過 / ${fail} 失敗`);
if (fail > 0) process.exit(1);
