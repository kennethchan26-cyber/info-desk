# INFO//DESK LITE — iPad mini / iOS 9

網址：https://kennethchan26-cyber.github.io/info-desk/lite.html

這是獨立頁面，不載入主站任何 JS、CSS、字體、PWA service worker 或登入功能。
使用 ES5、XMLHttpRequest、系統字體及 table/display:table 排版；無編譯、polyfill、module、Grid 或 CSS 變數。
主站及 Chrome 擴充功能的 HTML/JS/CSS、設定及功能保持不變。

## iPad 使用

1. Safari 打開上述網址，等資料載入；橫放使用。
2. 分享 → 加入主畫面；名稱可用「INFO DESK Lite」。此頁有獨立全屏 meta，不更改主站圖示。
3. 巴士每頁 5 條、外匯每頁 7 種，每 10 秒直接換頁，沒有滑動動畫。
4. 按「連線狀態」查看該裝置哪些來源能直接連線。
5. 如舊 iOS 不能直連 API，可用 `/lite.html?static=1` 只讀同源 JSON。
   這個模式的資料約每 5 分鐘產生一次，並非即時到站；超過 3 分鐘的巴士資料顯示「—」。
6. 每 6 小時自動重新載入；需保持螢幕開啟。iOS 9 不支援 Screen Wake Lock，本頁不聲稱能阻止自動鎖定。

## 更新頻率及來源

| 區塊 | 直連來源 | 瀏覽器查詢 | 同源後備與注意事項 |
|---|---|---|---|
| 時鐘 | 裝置時鐘 + UTC+8，不依賴 Intl | 每秒 | 所有數據失敗仍運行；裝置日期需正確 |
| 沙田氣溫、天氣狀況 | `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc` | 60 秒 | HKO 同源快照；觀測更新頻率由天文台決定；濕度是天文台站，並非沙田實測 |
| 九巴 | `https://data.etabus.gov.hk/v1/transport/kmb/eta/{stop}/{route}/{service}` | 30 秒，最多 3 個並行請求 | 同源快照只在取得後 3 分鐘內顯示；保留營辦商、方向及真實 ETA |
| 城巴 | `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/{stop}/{route}` | 30 秒 | 680 合併兩家；其中一家失敗會標明部分營辦商 |
| 專線小巴 | `https://data.etagmb.gov.hk/eta/route-stop/{routeId}/{routeSeq}/{stopSeq}` | 30 秒 | 路線、站點及方向從原 `config.js` 投影；不是另維護一套清單 |
| 恒指、標普 500、納指 | 既有 `data` 分支公開 Longbridge `market.json` | 60 秒 | Actions 重用同一快照；超過 20 分鐘或缺失改查 Yahoo chart API，仍無資料則保留原時間或顯示 — |
| 13 種外幣兌港元 | `https://api.frankfurter.dev/v2/rates?base=HKD&quotes=USD,CNY,JPY,GBP,EUR,AUD,CAD,SGD,TWD,KRW,THB,CHF,NZD` | 60 秒 | 每日市場中間參考價；每 1 外幣兌 HKD，JPY/KRW 每 100；4 位小數 |
| 同源後備 | `data/lite.json` | 30 秒（同時服務巴士後備；一般區塊仍有 60 秒更新計時） | Actions 約每 5 分鐘生成；排隊和 Pages/CDN 可再延遲，不承諾 30 秒或 60 秒的新鮮度 |

所有網絡、JSON、渲染入口均有獨立錯誤處理。來源失敗不會停止時鐘或其他區塊。
直連來源失敗後該主機暫停 5 分鐘再試，避免舊裝置不停重試 TLS 失敗。
瀏覽器只快取公開快照，沒有 Gmail、token、密碼、API key 或私人登入資料。
舊巴士 ETA 不會重設成現在時間、不會補造下一班；市場超過 20 分鐘、天氣/外匯取得時間超過 2 小時會顯示 —。

## GitHub Actions / Pages

`.github/workflows/lite-pages.yml` 以 `main` 的原始靜態檔案製作 Pages artifact，額外產生 `data/lite.json`。
Pages 的 Build and deployment → Source 需用 GitHub Actions。主站來源檔案逐 byte 保留；不是重新編譯主站。
排程為每小時第 2、7、12……57 分鐘，沒有每次快照 commit，沒有 Git 歷史膨脹，也不更改既有 Longbridge `data` 分支或 Windows 排程。
只用 GitHub 提供的短期部署權限，不需要 Repository Secrets 或 Longbridge 憑證。
原始資料來源即使失敗仍保留舊快照原時間；部署版本仍可載入介面。
停用：repo → Actions →「INFO DESK Pages and Lite snapshot」→ Disable workflow。已部署頁面仍存在，但同源快照停止更新；官方直連仍會嘗試。
公開 repo 如 60 天沒有活動，GitHub 可能停用 cron，屆時需重新啟用；5 分鐘排程也可能排隊延遲。

更改巴士／幣種後仍只修改原 `config.js`。Actions 重新執行 `publisher/lite-config.cjs` 匯出非機密設定；本機預覽可執行 `node publisher/lite-config.cjs lite-config.json`。

## 相容性驗證界線

- ES5 使用 Acorn `ecmaVersion:5` 靜態解析，另檢查禁用的現代 API/CSS。
- 現代 WebKit 截圖可檢查版面及 XHR/CORS，但 **不等於 Safari 9 或 iOS 9 TLS 實機測試**。
- 沒有這部 iPad 的 Safari 遠端測試連線，不能聲稱逐一已證實 iOS 9 直連成功。
- 同源模式消除第三方 API 的裝置端 TLS/CORS 依賴，但仍要求 iPad 能打開 GitHub Pages 本身；用戶已回報主站外框能載入。
- 若 API 直連不通且同源快照已超過 3 分鐘，巴士留白是刻意的資料安全限制，不能用 GitHub Actions 最短 5 分鐘排程達成 30 秒即時 ETA。

官方限制：[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、[Actions schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。
