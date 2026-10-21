# INFO//DESK 個人資訊看板

繁體中文、香港時間、日/月/年。相同 HTML/CSS/JavaScript 同時支援 GitHub Pages 純靜態網頁及 Chrome Manifest V3 新分頁擴充功能。不需要本機代理或後端。

## 發佈檔案

只上載以下 14 個檔案，不要拖入整個工作資料夾、設定截圖、測試輸出、憑證或瀏覽器資料。

| 檔案 | 用途 |
| --- | --- |
| .gitignore | 只容許已審核檔案加入 Git |
| .nojekyll | 關閉 Jekyll 處理 |
| index.html | 共用主頁、iPhone 主畫面設定 |
| styles.css | 深色格子介面、手機單欄及安全邊界 |
| config.js | 路線、股票、新聞及公開 Gmail Client ID |
| app.js | 資料讀取、登入及提示佇列 |
| background.js | 擴充功能 WhatsApp 標題未讀提示 |
| manifest.json | Chrome MV3 設定，不是網站 manifest |
| site.webmanifest | 網站主畫面設定 |
| icon.svg | 網站圖示 |
| apple-touch-icon.png | iPhone 180 × 180 圖示，沒有個人 metadata |
| README.md | 本說明 |
| market-calendar.js | 2026／2027 港交所及 NYSE 交易日曆、時區及倒數 |
| broadcast.js | 電視台式輪播、側欄、新聞條及本頁觀測線（不另取數據） |

## 電視台式版面

電腦主板每 15 秒輪換，可用底部分頁手動切換或暫停；香港時間星期一至五 07:00–09:30 及 17:30–20:00 固定交通。手機寬度小於 768px 時所有板塊單欄直排，不自動輪換。下方新聞條每 10 秒更新，每四條穿插市場數據。突發提示仍為優先佇列，每條 10 秒。

日曆在 market-calendar.js；[港交所 2026 通告](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf)、[2027 通告](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2026/ce_SEHK_CT_077_2026.pdf)、[NYSE 交易日曆](https://www.nyse.com/trade/hours-calendars)。包含週末、休市日、港股半日市及 NYSE 13:00 提早收市；紐約時區由 Intl 自動處理夏令時間。港股倒數以持續交易 16:00（半日 12:00）結束為準，不含收市競價。只覆蓋 2026–2027，不把未知年度或臨時停市當作已確認交易日。開頁第一刻不發提示；睡眠／背景恢復亦不補播錯過的開收市提示。

走勢線只累積本頁實際收到的報價，第二筆不同時間報價到達後才繪圖，不代表完整日內歷史。英數使用 Barlow Condensed，中文使用 Noto Sans TC（Google Fonts；不能載入時自動使用系統字款）。沒有使用任何其他媒體的名稱、標誌或專用字款。

## GitHub Pages 發佈

1. 若未有帳戶，前往 [GitHub](https://github.com/) 選 Sign up，自行填寫電郵、密碼、使用者名稱及完成驗證；不要把密碼交給其他人。
2. 登入後選 New repository，名稱 info-desk，可見度 Public。公開倉庫的原始碼及提交紀錄可被其他人查看。
3. 選 Add file → Upload files，只選上述清單的檔案，提交到 main。
4. Settings → Pages → Source 選 Deploy from a branch；Branch 選 main，Folder 選 /(root)，Save。
5. 等候部署完成，使用 Pages 頁面顯示的 HTTPS 網址，格式是 https://你的帳戶.github.io/info-desk/ 。
6. 日後同樣上載修改過的公開檔案到 main；不要上載截圖、登入資料或整個瀏覽器設定。

參考：[GitHub 官方 Pages 發佈來源設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 已有 Google Cloud 項目：啟用網頁 Gmail

1. 開啟 [Google Cloud](https://console.cloud.google.com/)，選擇原有 Info Desk 項目。
2. Google Auth Platform → Clients，開啟 config.js 所填 Client ID 對應的 Web application 用戶端。
3. 在 Authorized JavaScript origins 新增 https://你的帳戶.github.io ，不要加 /info-desk/ 路徑；保留原有本機開發來源及其他既有來源。
4. 保留 Authorized redirect URIs 內擴充功能的 chromiumapp.org/oauth2 完整網址，不要用新網址取代它。
5. 儲存後可能需要等候設定生效。如出現 origin_mismatch，核對協定、帳戶主機及 Client ID。
6. 網頁及擴充功能可共用同一個 Web Client，或在 config.js 分別填入各自的公開 ID。不可把 Client Secret 放進公開程式。
7. 在正式網址按「連接 Gmail（唯讀）」，自行選帳戶及查看授權內容。只要求 gmail.readonly，不要求寄信、修改或刪除權限。

## 首次建立 Google Cloud 項目

1. 新增專案 → 名稱 Info Desk。
2. APIs & Services → Library → Gmail API → Enable。
3. Google Auth Platform → Branding：應用程式名稱 Info Desk，自行填寫支援及開發者聯絡電郵。聯絡資料只放 Google Console，不寫進原始碼。
4. Audience：External、Testing，將自己的 Google 帳戶加入 Test users；只供列出的測試使用者授權。
5. Data Access：只加入 https://www.googleapis.com/auth/gmail.readonly 。
6. Clients → Create client → Web application，網頁 origin 及擴充功能 redirect 依上一節設定。
7. 複製公開 Client ID 到 config.js；不要下載或提交包含 Client Secret 的 JSON。

## Gmail 私隱與限制

- Gmail 請求直接傳送到 Google，登入權杖不經新聞／市場轉讀服務，不會寫進 GitHub。
- 權杖暫存在該瀏覽器本機儲存區。不同裝置、Safari、主畫面 App 與擴充功能可能需要各自登入，不會自動同步。
- 同一 GitHub Pages 帳戶下各專案共用 origin；請勿在同一 origin 寄存不可信任程式。
- 權杖過期後需再次按連接，沒有 Client Secret 或後端自動續期。
- 預先載入 Google 官方登入元件，按鈕直接觸發登入視窗。若仍被封鎖，按提示在 Safari 打開正式網址重試，不需要更改系統安全設定。
- 「中斷連接」移除本機權杖並嘗試向 Google 撤銷授權；網絡失敗時可到 Google 帳戶的第三方存取權限手動撤銷。
- 未連接時不載入任何個人郵件；公開訪客不會看到你的郵件。

參考：[Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)、[登入錯誤說明](https://developers.google.com/identity/oauth2/web/guides/error)。

## iPhone 加入主畫面

1. 用 Safari 打開正式 GitHub Pages 網址，確認天氣及交通載入。
2. 按分享圖示 → 加入主畫面；部分版本放在分享選單更多項目內。
3. 名稱可填「資訊看板」。如有「以網頁 App 開啟」，保持開啟，再按加入。
4. 從新圖示開啟。已設定 apple-touch-icon、標題、獨立顯示及瀏海／Home indicator 留白。
5. Gmail 如未連接，須在該環境分別授權。WhatsApp 按鈕會嘗試開啟已安裝的 WhatsApp App。

這是連網網頁，不是離線 App；沒有 service worker、背景推播或伺服器。iPhone 切到背景、鎖屏或關頁後，更新及提示可能暫停。桌面通知只供支援的電腦瀏覽器、看板仍開啟時使用。

## Chrome 擴充功能

1. 保留現有擴充功能資料夾的位置，不要移動。
2. 地址列開啟 chrome://extensions，開發人員模式 → 載入未封裝項目，選包含 manifest.json 的資料夾。
3. 更新頁面程式後開新分頁可取得新版本；如改動 manifest/background，需在擴充功能管理頁重新載入。
4. 如 Chrome 問是否保留新分頁變更，按保留。
5. 看板底部顯示 extension ID 及 Gmail Redirect URI，登記到 Google Web Client。若移動資料夾導致 ID 改變，需重新登記。
6. WhatsApp 只讀分頁標題數字，不讀訊息、不注入 WhatsApp 頁面；網頁版沒有未讀提示能力。

## 更新、提示與錯誤

- 交通每 30 秒；天氣、股票、外匯、新聞每 60 秒；Gmail 每 5 分鐘。上次查詢未完成時不重複排隊。
- 「最後更新」是本頁最近成功取得資料的時間，各區塊有獨立時間；不代表來源即時。
- 每次開啟時，各來源第一筆成功資料只建立基線，不發出歷史提示。
- 警告變化、新郵件、新新聞、WhatsApp 未讀增加、恒指／道指突破 2% 門檻、下一班車進入 3 分鐘範圍會提示。
- 優先順序：警告、通訊、交通、市場、新聞。每條 10 秒，可按 × 關閉。「測試提示」可驗證佇列及聲音。
- 聲音受瀏覽器自動播放政策限制；先操作頁面且沒有靜音時才可能播放。
- 失敗只在受影響區塊／個別股票顯示「暫時未能取得數據」。

## 數據來源

| 區塊 | 來源 | 時效／限制 |
| --- | --- | --- |
| 天氣 | 香港天文台 Open Data | 準即時；數碼港附近用黃竹坑站，濕度只能使用 API 提供的天文台站並明示 |
| 804、65K、69X | 運輸署專線小巴 ETA | 預計到站，可能不足 3 班 |
| 680 | 九巴及城巴 ETA | 分別查詢合併；沒有某公司班次不等於 API 失敗 |
| 30X | 城巴 ETA | 預計到站，可能不足 3 班 |
| Gmail | Gmail API | 唯讀、每 5 分鐘查詢 |
| 港股／美股 | Yahoo Finance chart；網頁經 Jina Reader | 報價及快照可延遲，列明日期時間，非交易用途 |
| 外匯 | Frankfurter／歐洲央行 | 每日參考價，不是銀行即時買賣價 |
| 香港新聞 | 港台本地分類，經 Jina Reader | 原文發布時間排序，快照可快取 |
| 國際／財經 | 港台國際及財經分類，經 Jina Reader | 合併去重、由新到舊；部分來源失敗會標示 |

Jina Reader 只收到公開市場／新聞網址，會如一般網站收到連線 IP，不會收到 Gmail 權杖或郵件。免費公開服務可快取、限流或暫停；若停用，須另選容許跨域的來源。本程式不會自動傳送私人資料到其他代理。

資源使用相對路徑，可置於專案子路徑。純靜態寄存仍需連接外部 API，但不依賴原來電腦開機。
