// ============================================================
// ui.js — 渲染層（badge 產生、table row 等）
// ============================================================

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
}

export function getYahooLink(symbol) {
    const encodeSym = symbol === '^TWII' ? '%5ETWII' : symbol;
    return `https://tw.stock.yahoo.com/quote/${encodeSym}/technical-analysis`;
}

function kBarColor(k) {
    if (k < 20) return '#3fb950';
    if (k > 80) return '#f85149';
    return '#d29922';
}

function locationBadge(loc) {
    if (loc === '低點') return `<span class="badge bdg-low">低點</span>`;
    if (loc === '高點') return `<span class="badge bdg-high">高點</span>`;
    if (loc === '中性') return `<span class="badge bdg-mid">中性</span>`;
    return `<span style="color:var(--text-dim);">—</span>`;
}

function kdBadge(kd) {
    if (kd === '黃金交叉') return `<span class="badge bdg-gold">↗ 黃金交叉</span>`;
    if (kd === '死亡交叉') return `<span class="badge bdg-dead">↘ 死亡交叉</span>`;
    if (kd === '無')       return `<span class="badge bdg-none">無</span>`;
    return `<span style="color:var(--text-dim);">${escapeHtml(kd)}</span>`;
}

function adviceHtml(advice, status) {
    if (status === 'error') return `<span class="adv-err">無法取得</span>`;
    const isBuy  = advice.includes('買');
    const isSell = advice.includes('賣');
    if (isBuy)  return `<span class="adv-buy">▲ ${escapeHtml(advice)}</span>`;
    if (isSell) return `<span class="adv-sell">▼ ${escapeHtml(advice)}</span>`;
    return `<span class="adv-hold">— ${escapeHtml(advice)}</span>`;
}

export function renderRow(row) {
    const tr = document.createElement('tr');
    tr.className = 'data-row row-in';
    tr.id = `row-${row.symbol}`;
    // data-advice: used by mobile CSS card left-border colour
    const _isBuy  = row.status !== 'error' && row.advice.includes('買');
    const _isSell = row.status !== 'error' && row.advice.includes('賣');
    tr.dataset.advice = _isBuy ? 'buy' : _isSell ? 'sell' : 'hold';

    const kNum = parseFloat(row.kVal);
    const kCellHtml = !isNaN(kNum)
        ? `<div class="k-cell">
               <span class="k-label">K</span>
               <div class="k-track"><div class="k-fill" style="width:${Math.min(100, Math.max(0, kNum)).toFixed(1)}%;background:${kBarColor(kNum)};"></div></div>
               <span class="k-val">${row.kVal}</span>
           </div>`
        : `<span style="color:var(--text-dim);">—</span>`;

    const sourceTime = row.updateTime || '';
    const fetchedAt = row.fetchedAt || '';
    const showFetchedLine = fetchedAt && fetchedAt !== sourceTime;
    const updateCell = `<div class="update-wrap">
            <span class="ts update-source" title="資料來源時間">源 ${escapeHtml(sourceTime)}</span>
            <span class="ts update-fetch" style="display:${showFetchedLine ? 'inline' : 'none'};" title="本次抓取時間">抓 ${escapeHtml(fetchedAt)}</span>
        </div>`;

    tr.innerHTML = `
        <td><a href="${getYahooLink(row.symbol)}" target="_blank" rel="noopener" class="stock-link">${escapeHtml(row.name)}</a></td>
        <td><span class="code-tag">${escapeHtml(row.symbol)}</span></td>
        <td><span class="price-val" style="color:${row.status === 'error' ? 'var(--text-dim)' : 'var(--text-primary)'};">${escapeHtml(row.price)}</span></td>
        <td>${kCellHtml}</td>
        <td>${kdBadge(row.kdCross)}</td>
        <td>${locationBadge(row.location)}</td>
        <td>${adviceHtml(row.advice, row.status)}</td>
        <td>${updateCell}</td>
    `;
    return tr;
}

export function renderSkeletonRow() {
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.innerHTML = `
        <td><span class="skel" style="width:88px;height:13px;"></span></td>
        <td><span class="skel" style="width:52px;height:20px;border-radius:4px;"></span></td>
        <td><span class="skel" style="width:60px;height:13px;"></span></td>
        <td><span class="skel" style="width:64px;height:4px;border-radius:2px;"></span></td>
        <td><span class="skel" style="width:76px;height:20px;border-radius:20px;"></span></td>
        <td><span class="skel" style="width:44px;height:20px;border-radius:20px;"></span></td>
        <td><span class="skel" style="width:80px;height:13px;"></span></td>
        <td><span class="skel" style="width:72px;height:11px;"></span></td>
    `;
    return tr;
}
