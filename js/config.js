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
    { category: '國際市值型 ETF', name: '復華 S&P 500 成長', symbol: '00924', apiSymbol: '00924.TW', step: 2 },
    { category: '國際市值型 ETF', name: '元大 S&P500', symbol: '00646', apiSymbol: '00646.TW', step: 2 },
    { category: '國際市值型 ETF', name: '國泰北美科技', symbol: '00770', apiSymbol: '00770.TW', step: 2 },
    { category: '美債券 ETF', name: '元大美債1-3年', symbol: '00719B', apiSymbol: '00719B.TWO', step: 3 },
    { category: '美債券 ETF', name: '國泰US短期公債', symbol: '00865B', apiSymbol: '00865B.TW', step: 3 },
    { category: '短線操作（個股）', name: '台積電', symbol: '2330', apiSymbol: '2330.TW', step: 4 },
    { category: '短線操作（個股）', name: '鴻海', symbol: '2317', apiSymbol: '2317.TW', step: 4 },
    { category: '短線操作（個股）', name: '廣達', symbol: '2382', apiSymbol: '2382.TW', step: 4 },
    { category: '短線操作（個股）', name: '緯創', symbol: '3231', apiSymbol: '3231.TW', step: 4 },
    { category: '其他-回本後賣出轉成ETF', name: 'Pegatron Corporation', symbol: '4938', apiSymbol: '4938.TW', step: 4 },
    { category: '美債券 ETF', name: '中信美國公債0-1', symbol: '00864B', apiSymbol: '00864B.TWO', step: 3 },
    { category: '其他-回本後賣出轉成ETF', name: 'Sinyi Realty Inc.', symbol: '9940', apiSymbol: '9940.TW', step: 4 },
    { category: '其他-回本後賣出轉成ETF', name: '茂順', symbol: '9942', apiSymbol: '9942.TW', step: 4 },
    { category: '其他-回本後賣出轉成ETF', name: 'Compal Electronics, Inc.', symbol: '2324', apiSymbol: '2324.TW', step: 4 },
    { category: '短線操作（個股）', name: '國泰費城半導體', symbol: '00830', apiSymbol: '00830.TW', step: 4 },
    { category: '國際市值型 ETF', name: '元大日經', symbol: '00661', apiSymbol: '00661.TW', step: 2 },
    { category: '短線操作（個股）', name: '富邦台灣中小', symbol: '00733', apiSymbol: '00733.TW', step: 4 },
    { category: '短線操作（個股）', name: '富世達', symbol: '6805', apiSymbol: '6805.TW', step: 4 },
    { category: '國際市值型 ETF', name: '富邦歐洲', symbol: '00709', apiSymbol: '00709.TW', step: 2 },
    { category: '台灣市值型 ETF', name: '元大台灣50', symbol: '0050', apiSymbol: '0050.TW', step: 1 },
    { category: '台灣高股息 ETF', name: '元大高股息', symbol: '0056', apiSymbol: '0056.TW', step: 2 },
    { category: '台灣市值型 ETF', name: '富邦台50', symbol: '006208', apiSymbol: '006208.TW', step: 1 },
    { category: '台灣市值型 ETF', name: '(高息)群益台灣精選高息', symbol: '00919', apiSymbol: '00919.TW', step: 1 },
    { category: '台灣高股息 ETF', name: '元大高息低波', symbol: '00713', apiSymbol: '00713.TW', step: 2 },
    { category: '台灣高股息 ETF', name: '國泰永續高股息', symbol: '00878', apiSymbol: '00878.TW', step: 2 },
];

export const CATEGORIES_STORAGE_KEY = 'stockCategories';

// step = 建議規則編號（見 RULE_OPTIONS / indicators.js analyzeData）；dot = 圓點色 dot-0 ~ dot-4
export const DEFAULT_CATEGORIES = [
    { name: INDEX_CATEGORY,      step: 0, dot: 0 },
    { name: '台灣市值型 ETF',    step: 1, dot: 1 },
    { name: '國際市值型 ETF',    step: 2, dot: 2 },
    { name: '美債券 ETF',        step: 3, dot: 3 },
    { name: '短線操作（個股）',  step: 4, dot: 4 },
    { name: '其他-回本後賣出轉成ETF', step: 4, dot: 0 },
    { name: '台灣高股息 ETF',    step: 2, dot: 1 },
];

export const DOT_COUNT = 5;

// 類別「建議規則」；說明文字同時用於頁尾與類別管理表單，需與 indicators.js analyzeData 保持一致
// K 值介於 20～80 時所有規則一律顯示「觀望」
export const RULE_OPTIONS = [
    {
        step: 0, label: '指數',
        target: '大盤或指數（本身無法直接買賣，建議會指向「對應 ETF」）',
        cross: '會偵測，且影響建議文字',
        low: '黃金交叉→「可買進對應 ETF」；無交叉→「低檔，可分批買進對應 ETF」',
        high: '死亡交叉→「可賣出對應 ETF」；無交叉→「高檔，可分批賣出對應 ETF」',
    },
    {
        step: 1, label: '台灣市值型',
        target: '台灣市值型 ETF（如 0050），直接買賣',
        cross: '會偵測並顯示，但不影響建議',
        low: '「買進台灣市值型 ETF」',
        high: '「賣出台灣市值型 ETF」',
    },
    {
        step: 2, label: '國際市值型',
        target: '國際型 ETF，直接買賣',
        cross: '會偵測並顯示，但不影響建議',
        low: '「可買進」',
        high: '「可賣出」',
    },
    {
        step: 3, label: '債券',
        target: '債券 ETF，直接買賣',
        cross: '會偵測並顯示，但不影響建議',
        low: '「可買進」',
        high: '「可賣出」',
    },
    {
        step: 4, label: '短線個股',
        target: '個股短線操作',
        cross: '會偵測，且決定買賣比例',
        low: '黃金交叉→「全買」；無交叉→「部分買進(1/2資金)」',
        high: '死亡交叉→「全賣」；無交叉→「部分賣出(1/2股票)」',
    },
];

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

// 僅供舊版匯入檔（無 step 且無 categories）依預設類別名稱推導
export function deriveStep(category) {
    return DEFAULT_CATEGORIES.find(c => c.name === category)?.step ?? 4;
}

export function deriveApiSymbol(symbol) {
    return symbol.startsWith('^') ? symbol : `${symbol}.TW`;
}
