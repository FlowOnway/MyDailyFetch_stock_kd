# 每日投資檢查（DailyFetch Stock KD）

純前端的 KD 指標儀表板：開啟網頁即時抓取你關注的指數、ETF 與個股行情，計算 9 日 KD 值、偵測黃金／死亡交叉，並依各類別的規則給出「買進／賣出／觀望」建議。

沒有建置步驟，沒有後端，所有設定都存在瀏覽器的 `localStorage`。

## 功能

- **即時行情與 KD**：從 Yahoo Finance 取得日 K 資料，計算 9 日 KD；顯示股價、K 值、KD 交叉狀態、高低檔位置與更新時間。
- **KD 交叉偵測**：以過去 4 個交易日的收盤資料偵測，並以盤中即時 K/D 驗證訊號是否仍有效。
- **依類別給建議**：每個類別綁定一組建議規則（指數、台灣市值型、國際市值型、債券、短線個股），K 值 20～80 之間一律顯示「觀望」。
- **類別摺疊**：點類別標題列可收起或展開；右上角「單一展開」開關開啟時，一次只能展開一個類別，關閉後還原成開啟前的展開狀態。
- **標的與類別管理**：新增、編輯、刪除標的與類別，可拖曳調整順序（支援觸控與鍵盤）。
- **關注星號**：標記重點標的。
- **投資筆記**：每個標的可寫 Markdown 筆記，支援自動儲存。
- **備份**：設定視窗可匯出／匯入 JSON；`data/` 內有範例備份檔。
- **響應式**：手機寬度下表格自動轉為卡片排版。

## 快速開始

ES module 在 `file://` 下會被瀏覽器擋，需透過本機 HTTP 伺服器開啟：

```bash
python3 -m http.server 8000
# 或
npx serve .
```

再開啟 `http://localhost:8000`。

> Markdown 筆記預覽（marked）與拖曳排序（SortableJS）從 CDN 載入，需要網路連線。

## 資料來源與代理

瀏覽器直接呼叫 Yahoo Finance 會被 CORS 擋下，因此請求會經過代理，順序見 [js/config.js](js/config.js) 的 `PROXY_GENERATORS`：

1. 自行部署的 Cloudflare Worker（[cloudflare-worker/worker.js](cloudflare-worker/worker.js)，僅轉發 Yahoo Finance 的 `query1`／`query2.finance.yahoo.com`）。
2. 公開 CORS 代理（codetabs、allorigins）作為備援，不穩定，可能隨時失效。

代理回傳 401/403 時，該代理會在本次瀏覽中被略過。

資料有約 15–20 分鐘的延遲，這是免費 API 的限制。

### 部署自己的 Worker

1. 登入 Cloudflare Dashboard → Workers & Pages → Create Worker。
2. 貼上 [cloudflare-worker/worker.js](cloudflare-worker/worker.js) 並 Deploy。
3. 把 [js/config.js](js/config.js) 中 `cloudflare_worker` 的網址換成你的 Worker URL。

## 建議規則

每個類別的 `step` 決定規則，定義在 [js/config.js](js/config.js) 的 `RULE_OPTIONS`，邏輯在 [js/indicators.js](js/indicators.js) 的 `analyzeData`。兩處需保持一致。

| step | 規則 | KD 交叉 |
| --- | --- | --- |
| 0 | 指數（建議指向對應 ETF） | 偵測並影響建議 |
| 1 | 台灣市值型 | 會偵測並顯示，但不影響建議 |
| 2 | 國際市值型 | 偵測顯示，不影響建議 |
| 3 | 債券 | 偵測顯示，不影響建議 |
| 4 | 短線個股 | 偵測並決定買賣比例 |

## 專案結構

```
index.html              頁面與設定視窗
css/main.css            樣式
js/
  main.js               進入點：loadData、類別摺疊、全域函式綁定
  api.js                抓取 Yahoo 資料（代理、重試）
  indicators.js         KD 計算、交叉偵測、建議規則
  config.js             預設標的／類別、規則說明、代理清單
  state.js              標的與類別狀態、localStorage 讀寫
  settings.js           設定視窗（標的／類別管理、匯入匯出、排序）
  memo.js, ui.js        投資筆記與表格渲染
cloudflare-worker/      CORS 代理 Worker
data/                   範例備份檔
doc/architecture.mmd    資料流程圖
test_cross.mjs          KD 交叉偵測的快速驗證（邏輯為 api.js 的獨立副本）
```

## 測試

```bash
node test_cross.mjs
```

## 部署

推送到 `main` 後，[GitHub Actions](.github/workflows/deploy.yml) 會把整個 repo 根目錄部署到 GitHub Pages。

## 免責聲明

本工具僅供個人參考，不構成投資建議。數據有延遲，請自行判斷並承擔風險。
