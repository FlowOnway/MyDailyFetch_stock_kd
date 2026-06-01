// ============================================================
// config.js — 靜態常數與預設資料（無依賴）
// ============================================================

export const STORAGE_KEY = 'stockTargets';

export const DEFAULT_TARGETS = [
    { category: '台灣市值型 ETF', name: '台灣大盤(加權指數)', symbol: '^TWII', apiSymbol: '^TWII', step: 1 },
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
    '台灣市值型 ETF': 1,
    '國際市值型 ETF': 2,
    '美債券 ETF': 3,
    '短線操作（個股）': 4,
};

export const CATEGORY_DOT = {
    '台灣市值型 ETF':   'dot-1',
    '國際市值型 ETF':   'dot-2',
    '美債券 ETF':       'dot-3',
    '短線操作（個股）': 'dot-4',
};

// 代理伺服器清單（依可靠度排序；sticky proxy 機制會記住上次成功的）
export const PROXY_GENERATORS = [
    { id: 'corsproxy_io',   build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
    { id: 'allorigins_raw', build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
    { id: 'allorigins_get', build: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` },
    { id: 'codetabs',       build: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
];

export function deriveStep(category) {
    return CATEGORY_STEP_MAP[category] || 4;
}

export function deriveApiSymbol(symbol) {
    return symbol.startsWith('^') ? symbol : `${symbol}.TW`;
}
