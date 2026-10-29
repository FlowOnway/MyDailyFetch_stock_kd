// ============================================================
// config.js — 靜態常數與預設資料（無依賴）
// ============================================================

export const STORAGE_KEY = 'stockTargets';

export const INDEX_CATEGORY = '全球主要指數';

// 歐洲採 STOXX Europe 600（Yahoo 代號 ^STOXX）；Yahoo 無 MSCI Europe 指數，故不備援
export const DEFAULT_INDEX_TARGETS = [
    { category: INDEX_CATEGORY, name: 'S&P 500 指數', symbol: '^GSPC', apiSymbol: '^GSPC', step: 0 },
    { category: INDEX_CATEGORY, name: '台灣大盤(加權指數)', symbol: '^TWII', apiSymbol: '^TWII', step: 0 },
    { category: INDEX_CATEGORY, name: '日經 225 指數', symbol: '^N225', apiSymbol: '^N225', step: 0 },
    { category: INDEX_CATEGORY, name: 'STOXX Europe 600 指數', symbol: '^STOXX', apiSymbol: '^STOXX', step: 0 },
];

export const DEFAULT_TARGETS = [
    ...DEFAULT_INDEX_TARGETS,
    { category: '國際市值型 ETF', name: '元大 S&P500', symbol: '00646', apiSymbol: '00646.TW', step: 2 },
    { category: '國際市值型 ETF', name: '富邦歐洲', symbol: '00709', apiSymbol: '00709.TW', step: 2 },
    { category: '國際市值型 ETF', name: '元大日經', symbol: '00661', apiSymbol: '00661.TW', step: 2 },
    { category: '國際市值型 ETF', name: '國泰新興市場', symbol: '00736', apiSymbol: '00736.TW', step: 2 },
    { category: '美債券 ETF', name: '元大美債1-3年', symbol: '00719B', apiSymbol: '00719B.TWO', step: 3 },
    { category: '美債券 ETF', name: '國泰US短期公債', symbol: '00865B', apiSymbol: '00865B.TW', step: 3 },
    { category: '短線操作（個股）', name: '台積電', symbol: '2330', apiSymbol: '2330.TW', step: 4 },
    { category: '短線操作（個股）', name: '鴻海', symbol: '2317', apiSymbol: '2317.TW', step: 4 },
    { category: '短線操作（個股）', name: '廣達', symbol: '2382', apiSymbol: '2382.TW', step: 4 },
    { category: '短線操作（個股）', name: '緯創', symbol: '3231', apiSymbol: '3231.TW', step: 4 },
    { category: '短線操作（個股）', name: '茂順', symbol: '9942', apiSymbol: '9942.TW', step: 4 },
];

export const CATEGORY_STEP_MAP = {
    [INDEX_CATEGORY]: 0,
    '台灣市值型 ETF': 1,
    '國際市值型 ETF': 2,
    '美債券 ETF': 3,
    '短線操作（個股）': 4,
};

export const CATEGORY_DOT = {
    [INDEX_CATEGORY]:   'dot-0',
    '台灣市值型 ETF':   'dot-1',
    '國際市值型 ETF':   'dot-2',
    '美債券 ETF':       'dot-3',
    '短線操作（個股）': 'dot-4',
};

// 代理伺服器清單（依可靠度排序；sticky proxy 機制會記住上次成功的）
// 第一順位：自行部署的 Cloudflare Worker（穩定、免費、無 CORS 限制）
// 部署完成後將下方的 PLACEHOLDER 換成你的 Worker URL，例如：
//   https://yahoo-proxy.你的帳號.workers.dev
// 其餘代理保留作備援，Worker 上線後幾乎不會用到
export const PROXY_GENERATORS = [
    { id: 'cloudflare_worker', build: (url, cb) => `https://yahoo-fin-proxy.wilscmp.workers.dev?url=${encodeURIComponent(url)}&_=${cb}` },
    { id: 'codetabs',          build: (url, cb) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}&cacheBust=${cb}` },
    { id: 'allorigins_raw',    build: (url, cb) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&cacheBust=${cb}` },
    { id: 'allorigins_get',    build: (url, cb) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&cacheBust=${cb}` },
];

export function deriveStep(category) {
    return CATEGORY_STEP_MAP[category] ?? 4;
}

export function deriveApiSymbol(symbol) {
    return symbol.startsWith('^') ? symbol : `${symbol}.TW`;
}
