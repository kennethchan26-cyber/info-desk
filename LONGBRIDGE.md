# INFO//DESK 長橋行情

版本：23/10/2026 10:10 HKT。只讀公開行情，沒有交易、落單、資產或持倉功能。

## 改動前與改動後

| 內容 | 原有來源 | 新版來源 / 更新 |
|---|---|---|
| 港美股、六大指數 | Yahoo Spark；網頁經 Jina、擴充功能直接讀取；60 秒 | 長橋 CLI 批量報價 → 公開 market.json；前端每 60 秒檢查 |
| 納指熱力圖 | 相同 Yahoo 報價；QQQ 權重快照 | 同一份長橋報價；權重檔保持原樣 |
| 即日走勢 | Yahoo 1 分鐘資料 / TradingView 備用 | 26 組長橋 1 分鐘走勢，每約 5 分鐘收集；缺資料仍回 Yahoo / TradingView |
| 5 日、1 個月、1 年圖 | Yahoo / TradingView | 保留原有來源，圖下標示來源 |
| 外幣兌港元 | Frankfurter v2 每日中間參考價，每 60 秒檢查 | 保留；實測長橋 `exchange-rate` 回傳空清單 |
| 底部 ticker | 讀取股價、外匯板 | 同上，不額外請求報價 |

確保包含 700.HK、2800.HK、PLTR.US、NVDA.US。六大長橋代號：HSI.HK、HSCEI.HK、HSTECH.HK、.DJI.US、.SPX.US、.IXIC.US。前端沿用 Yahoo 代號作內部識別，由 config.js 對照。

## 發佈、頻率及延遲

- `main`：只放介面程式；本次更新一次 Pages，不逐分鐘重建。
- `data`：只有公開 `market.json`，每次建立無父 commit 的新快照，再以 `--force-with-lease` 更新此分支；不強推 main。
- 首次引導快照由已連接 GitHub 服務建立，暫時以原 main commit 為父；本機 GitHub CLI 授權後，第一次腳本推送會改成上述無父快照。授權未完成前排程保持停用，不會假裝持續更新。
- 長橋報價收集約每 2 分鐘；美股盤前／盤後／夜盤亦視為活躍時段。沿用 HKEX / NYSE 2026–2027 日曆及紐約時區。全部休市時約每 15 分鐘。
- 工作排程器每分鐘喚醒檢查，未到時間即退出。慢速請求會令實際間距略長；重疊執行會被忽略。
- 前端每分鐘讀 raw.githubusercontent.com，以分鐘 query 減少舊 CDN 快照。正常約 2–5 分鐘新鮮度，但 GitHub raw 快取及網絡沒有時效保證。
- 單一可達 commit 不代表 GitHub 即時刪除舊物件；伺服器垃圾回收及保留政策仍可能暫佔空間。不是無限容量資料庫。
- 原始行情延遲另外取決於長橋權限。官方說明：Basic 港股 BMP 約 15 分鐘延遲，HK OpenAPI LV1 另需權限；美股 LV1 依授權。畫面不保證所有報價零延遲。
- CLI 普通報價沒有成交時間欄位，因此顯示「取得」時間而非冒稱成交時間；日內圖使用來源分鐘時間。普通交易時段價格與盤前／盤後／夜盤分開，日變動不混算。
- 115 個代號分成 100 + 15 批；最多 2 個 CLI 同時運行。圖表約 5 分鐘、溫度／資金流／日曆／A-H／榜單約 15 分鐘、異動約 2 分鐘。若某項失敗，不刷新該項成功時間。

## 新增輪播頁

1. 港美股市場溫度、估值分數、情緒分數，與 A/H 折溢價（2318、3968）。分數不是 P/E，A/H 顯示來源定義 H 股較 A 股折溢價及來源日期。
2. 港美股選股器升／跌榜各 5 隻：**前收市資料，不是即時全市場排行榜**。成交額焦點只涵蓋本看板已追蹤股份，明確標示範圍。
3. 全部自選股資金流：大單流入減大單流出，HKD / USD 分開；不是用戶個人資金或持倉。
4. 今日起未來 7 日：全部自選股相關業績／派息事件、重要美國經濟數據及部分其他市場事件。保留來源英文內容，不杜撰日期。
5. 市場異動；TV 右側新增異動及溫度輪播。天氣／巴士優先鎖定規則不變。

全部屬展示數據，不是投資建議。

## 憑證與安全

- Longbridge CLI 自己使用預設本機登入位置；腳本**不讀、不搬、不印出**該檔。
- GitHub CLI 使用本機登入儲存；沒有把 token 寫入 Python、JavaScript、JSON、Git remote 或排程參數。
- 只准 `quote / intraday / market-temp / market-status / capital / anomaly / ah-premium / finance-calendar / screener` 命令，另限制不可 `--filter positions/watchlist`，不讀用戶帳戶名單。
- stdout/stderr 原文不寫 log。健康檔只列成功／錯誤分類、時間、涵蓋數量及公開 commit SHA。
- `.gitignore` 白名單排除 market.json、本機健康檔、登入憑證及測試檔。公開 data 分支以欄位白名單輸出。
- 本功能按使用者明確要求公開行情。看板程式沒有替使用者取得再分發授權。

## 本機操作

需 Windows、Python 3.14、Node、Git、Longbridge CLI 及 GitHub CLI；後兩者先在本機完成登入。專案目錄執行：

```powershell
py -3.14 publisher/collect.py                 # 只收集、檢查本機 market.json
py -3.14 publisher/collect.py --publish       # 收集及發佈 data 分支
powershell -File publisher/install-task.ps1  # 安裝當前使用者排程
powershell -File publisher/control-task.ps1 -Action Pause
powershell -File publisher/control-task.ps1 -Action Resume
powershell -File publisher/control-task.ps1 -Action Status
```

工作排程器名稱：`INFO-DESK Longbridge Market Publisher`。也可直接在工作排程器右鍵「停用」。排程只在使用者已登入 Windows 時運行，鎖定螢幕可運行，登出不可；不儲存 Windows 密碼、不改電源設定。

本機 `LOCALAPPDATA/INFO-DESK/publisher/health.json` 記錄最近成功／失敗分類；`market.json` 為最近公開快照；`data-git` 為專用行情分支倉庫。

電腦休眠／關機／斷網後：公開網站仍開到。快照或個別報價超過 **20 分鐘**，自動改用 Yahoo；外匯一直用 Frankfurter。新增長橋分析過期時顯示未能取得數據，不假裝有新資料。原有來源也失敗則依原有錯誤／離線處理；沒有來源能保證永不斷線。

要完全停用：先停排程，再把 config.js 的 `LONGBRIDGE.ENABLED` 設 `false` 並發佈介面。可保留 data 分支，前端不再使用。移除新增頁可從 tv-panels.js 的 market-pulse 頁加入位置停用，不必改其他區塊。

## 官方參考

- [Longbridge CLI](https://open.longbridge.com/docs/cli)
- [行情權限及代號](https://open.longbridge.com/docs/quote/overview)
- [GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
