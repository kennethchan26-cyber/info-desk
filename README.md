# INFO//DESK 個人資訊看板

## 23/10/2026 長橋行情快照

市場板、六大指數、20 隻自選股／ETF、納指熱力圖及 ticker 優先讀長橋；新增盈富 2800。新增市場溫度、榜單、資金流、財經日曆、A/H 及異動輪播。公開快照由本機產生，憑證不會進入網頁。

完整架構、來源限制、更新頻率、排程安裝／暫停及 20 分鐘後備規則見 [LONGBRIDGE.md](LONGBRIDGE.md)。以下較舊章節中的 Yahoo 來源敘述，現為後備來源；Frankfurter 外匯、其他資料及非即日圖表來源不變。

中／EN 即時切換並記住選擇，預設繁體中文。中文日/月/年，英文例如 21 Oct 2026，均用香港 24 小時制。相同 HTML/CSS/JavaScript 同時支援 GitHub Pages 純靜態網頁及 Chrome Manifest V3 新分頁擴充功能。不需要本機代理或後端。


## 22/10/2026 右下角時鐘、綠色預告、納指熱力圖及輪換右欄

- 電腦／TV 的時間及精簡天氣移至底部右邊，獨立佔位，不遮住水平跑馬燈；顯示時分、日/月及 HKT。TV 時鐘64px（1080高畫布）。手機普通版的頂部時鐘不變。
- 三級提示：紅色天氣「突發」 > 黃色「最新」 > 綠色巴士「預告」。較高級可中斷低級，之後恢復佇列，聲音／桌面通知不重複。每條仍10秒及300ms水平擦入；首次成功載入靜默、收起Gmail仍不提示。
- 在 `config.js` 改 `BUS_PREVIEW_MINUTES`（預設12）；各條 `TRANSIT` 路線的 `previewAlert:false` 可獨立停用。以約11至12.5分鐘的觀測帶觸發一次，避免30秒查詢錯過門檻。API沒有共同可靠車輛ID，程式按連續下一班紀錄、到站時間漂移及班次更替作最佳努力去重，不能保證取消／大幅延誤時辨認同一輛車。
- TV 上格：最快到站 → 六大指數 → 港股升跌幅絕對值最大3隻 → 美股最大3隻 → 熱搜前3；下格：6種外幣 → 三天預報 → 熱力圖縮圖 → 港美股交易倒數 → CNBC最新一條。各10秒、下格起步錯開5秒，300ms水平擦入；沒有上下捲動。上格有天氣警告時鎖定警告，否則有3分鐘內巴士時鎖定到站板；事件解除才恢復。清單及週期集中 `TV_RAIL` 設定。
- 主畫面新增第11頁熱力圖；美股交易時段開啟看板時優先此頁，其後沿原有15秒輪播，通勤交通鎖定優先。桌面／手機點方格沿用即日／5日／1個月／1年大圖；手機增加全闊熱力圖。TV方格文字26px，放不下只留顏色。

### 熱力圖來源、範圍及限制

- 已核實 [TradingView Stock Heatmap](https://www.tradingview.com/widget-docs/widgets/heatmaps/stock-heatmap/) 支援 `NASDAQ100`。舊版隔離iframe沒有可可靠設定所有內部文字至少26px的介面，因此採用原生SVG treemap，保留本看板的大圖彈窗及字級規則；不抓取TradingView iframe行情。
- **101個股票證券／約100家公司**，包含Alphabet兩個類別；不是只取15隻自選股。成分及面積參考 [Invesco QQQ官方持倉](https://www.invesco.com/qqq-etf/en/about.html)，快照日期 **21/10/2026**，排除現金與衍生工具，股票比重合計99.856955%。`nasdaq100.js` 保留名字、比重及日期；不是即時市值或精確即時NDX權重。行業為本看板的寬分類，不聲稱是官方ICB/GICS分類。新增／刪除成分時須更新此快照。
- 原始快照：`https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclasses/QQQ/holdings/fund?idType=ticker&interval=monthly&productType=ETF`。API無跨域授權，故把公開快照隨靜態網站發佈，不需要本機服務。
- 升跌取既有 **Yahoo Finance Spark** regular-session報價；網頁透過原有 **Jina Reader**，擴充功能直接Yahoo。頂部「納指」沿用現有納斯達克綜合指數 `^IXIC`，圖塊為Nasdaq100成分，不把兩個指數混稱。上／下數目只計成功取得資料的股票，另列有效覆蓋數。
- **每60秒一輪**，先重用自選股重疊的12隻，再將其餘89隻以每批最多20隻、相隔10秒，共5批讀取；首輪約40–60秒逐步填滿。來源失敗保留最後資料，灰色表示平收或缺資料；收市使用來源最後regular-session資料並標「收市」。滑鼠／圖表可核對來源時間。
- 60秒是檢查週期，**不是即時報價保證**；Yahoo及Jina可能快取／延遲，沒有可保證的固定延遲分鐘數。Jina無key [官方額度20請求／分鐘／IP](https://jina.ai/reader/)，與原有新聞、圖表及其他分頁共用；額外5批亦計入。429時熱力圖至少等2分鐘再試；原有來源頻率不變，流量繁忙時可能仍用快取。Yahoo Spark無正式穩定免費SLA，20為沿用的客戶端批量上限。

## 22/10/2026 提示分級、分鐘圖表及 TV 動態更新

- 只有天氣警告發出／改變使用紅色「突發／BREAKING」；巴士、Gmail、新聞、熱搜、開收市、市場異動及原有 WhatsApp 提示使用黃色「最新／LATEST」。天氣可優先中斷黃色提示，黃色之後繼續排隊，維持10秒及300ms水平擦入；首次載入及收起Gmail的靜默規則不變。
- 最快到站顯示三條不同路線，按每條第一班排序；有第二班預測時顯示「下一班」，無資料不虛構。TV下一班文字至少26px。
- TV恢復0.5秒紅綠底／數字閃色，保留所有市場數字；底部MARKETS使用連續、等速、向左的水平跑馬燈（30px），只有上下捲動禁止。
- 詳細圖表加入右側價格刻度、淡格線、帶數值的前收虛線、高低位標記、成交量、整點香港時間標記；港股上午／下午分開的面積線，不跨午休連線。電腦可用十字線查看時間、價格及來源成交量。圖表標頭的現價與升跌採同一分鐘圖表資料，避免報價與走勢快取時間不同而互相矛盾。

## AirPlay 大字版、13 條路線及即日圖表

- 開啟 `https://kennethchan26-cyber.github.io/info-desk/?tv=1` 或按頂部 **TV**。選擇記在本瀏覽器，網址參數優先。
- **返回普通版：** TV模式右上角的「返回普通版」（英文：BACK TO NORMAL）平時隱藏；移動滑鼠或手機／iPad輕觸螢幕便顯示，最後一次操作後3秒隱藏，不改變原有版面。按下按鈕或電腦按 **Esc** 即退出，同時把網址改為`?tv=0`及記住普通版；重新整理或下次開啟不帶`tv`參數的網址仍是普通版。直接開啟`?tv=0`亦可退出。若特意再次開啟`?tv=1`，仍以網址為準進入TV模式。按鈕字體至少32px（1080高畫布），小螢幕點擊範圍至少44個實際CSS像素。
- TV 畫布高1080，闊度依裝置可見螢幕比例計算（包括2778×1284）；按比例填滿，不固定16:9。上下10.8邏輯像素、左右畫布闊度1%的安全距離，不加瀏海／Home indicator安全區。旋轉及Safari工具列改變會重算。電視／AirPlay本身若維持手機的超闊比例，仍可能產生硬件黑邊，網頁不能控制接收器的縮放。
- TV不作上下捲動；沒有自動上下捲動、滑輪／觸控／方向鍵捲動。內容以完整卡片分頁，右上顯示1/2等，每8秒換頁，以300毫秒水平擦入；底部行情保留水平跑馬燈。
- TV右欄維持兩個等高板，現按上方清單獨立輪換；最快到站獨立於一般版的地區／固定次序選擇。精簡天氣在底部時鐘左邊；警告慢閃，每10分鐘讀取天氣。
- 主畫面每15秒依次輪播：01交易倒數與六指數 → 02港股自選 → 03美股自選 → 04十三種外幣 → 05全部巴士路線 → 06天氣與三天預報 → 07本地／國際／美股頭條 → 08香港熱搜 → 09指數走勢 → 10焦點股走勢。右上顯示主頁及內容分頁碼。TV每頁最多6隻股票、6種外幣、6條路線、3則新聞；高度不足會再減少整卡數量，不切去半張卡。焦點股8秒換股，交易中的市場優先。
- 長列表不縮成半張卡片、不用省略號截去內容；超長新聞拆成續頁並保留連結。分頁進度在輪播回來時接續，所有美股、外匯及新聞均有機會展示，不會永遠停留在頭兩頁。
- 香港時間平日07:00–09:30及17:30–20:00固定顯示交通；交通若需分頁仍每8秒換頁。時段結束恢復主畫面輪播。背景暫停TV展示工作，回前台恢復。
- TV平時隱藏所有按鈕（包括TV、中／EN），只有操作時短暫顯示右上角返回按鈕；來源、資料日期及次要副題維持隱藏，只保留整體最後更新。可見文字最低26px、主要數字至少56px、板標題至少36px、新聞至少32px（以1080高計）。新版本等主頁／分頁切換時自動套用；普通版仍由使用者按更新。
- 支援時使用Screen Wake Lock；TV按鈕綠點代表已取得，不支援或系統拒絕則靜默略過。實際iOS低電量／鎖屏／AirPlay行為由裝置決定。[API說明](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- 一般電腦版同樣取消上下捲動，主板現使用11頁及300ms水平擦入；普通版右欄仍按組分頁，每8秒橫向換頁，訊息展開後獨立一頁。手機仍正常整頁上下瀏覽，列出全部已篩選路線，沒有數據板內自動捲動。Gmail唯讀及不快取個人資料的限制維持不變。

### 路線設定與官方核對

所有設定在`config.js`的`TRANSIT`。新增地區只需填`region`，篩選按鈕會自動生成；英文自訂地區可自行填英文名稱。每30秒讀取及排序，少於1分鐘差距保留原次序，顯示分鐘及香港時間。超過60分鐘／沒有預測的路線在最後；沒有預測不等同API失敗。

|路線|營辦商|最終車站名稱|車站ID|API方向／目的地|地區|
|---|---|---|---|---|---|
|804|專線小巴|大圍站交匯處外巴士灣|20001582|路線2010275、方向2、站序5／廣源|沙田|
|65K|專線小巴|㘭背灣街近金豪工業大廈第二座|20001505|路線2009081、方向1、站序6／火炭站循環|沙田|
|69X|專線小巴|駱克道近景隆街|20006944|路線2000511、方向2、站序1／數碼港|港島|
|680|九巴＋城巴|帝逸酒店(ST534)／歷奇單車場,小瀝源路|2223D64E9ED2E1A7／003082|九巴O、服務1／城巴I；金鐘東|沙田|
|30X|城巴|數碼港三座,數碼港道|002393|O／金鐘東|港島|
|281E|九巴|奧運站(MK656)|9DA7325E4238402B|O、服務1／廣源|九龍|
|682|城巴（非聯營）|歷奇單車場,小瀝源路|003082|I、站序19／柴灣東|沙田|
|281A|九巴|小瀝源(綠怡雅苑)(ST603)|75D57F5A5891A1C2|O、服務1／九龍站|沙田|
|49X|九巴|小瀝源(綠怡雅苑)(ST604)|51D13DDB8EBA98AF|O、服務1／青衣碼頭|沙田|
|83X|九巴|小瀝源(綠怡雅苑)(ST604)|51D13DDB8EBA98AF|O、服務1／觀塘碼頭|沙田|
|86|九巴|廣源邨廣柏樓(ST600)|260B43921BAFD8CB|O、服務1／美孚|沙田|
|83K|九巴|廣源邨廣柏樓(ST601)|7E3C2CA5ABEC8416|O、服務1／沙田市中心循環|沙田|
|83S|九巴|廣源邨廣柏樓(ST601)|7E3C2CA5ABEC8416|O、服務1／沙田市中心|沙田|

21/10/2026約21:47 HKT逐條以官方路線／車站列表及ETA核對：13條路線、14個營辦商ETA查詢均HTTP200；其中9條有60分鐘內預測。65K、30X、281E、83S當時無有效班次；680的九巴暫無、城巴有2班，正常合併。不能把空班次宣稱為即將有車。682是城巴獨營。

### 圖表數據、更新及限制

- 六大指數及19隻自選股（港股4、美股15）的列表小圖、指數頁及焦點大圖使用Yahoo Finance即日1分鐘數據，由本地開源[Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs) 5.2.0繪製。Spark只提供close；可見的大圖另用同一Yahoo的v8 chart取得1分鐘OHLCV。若供應商回傳5分鐘，以實際granularity為準，不偽造1分鐘。時間軸全為香港時間，最多4個整點標記；前收市灰色虛線、最新一點及價格標籤、紅綠細線及漸變填充。休市展示來源最後交易日並標收市。
- 圖表每60秒一輪，25個代號分20＋5，首次延後12秒，每批錯開24秒（每分鐘2次圖表請求），與原有2次報價請求分開。一般版點股份可切即日／5日（5分鐘）／1個月／1年（日線）；額外期間只在點擊時讀取並快取。回傳429後等5分鐘，不逐股猛烈重試。
- 可見詳細圖表每60秒檢查更新，每1.5秒最多啟動一個OHLCV請求，單看板最多8個／滾動60秒；隱藏圖表不新增請求，超額順延。日內通常是1分鐘，5日仍是5分鐘，月／年是日線。這是客戶端節流，不是供應商保證；多人／多分頁共用Jina額度仍可能限流。缺少或全零成交量會標示「來源未提供成交量」，不以價格變動捏造成交量。實測香港三個指數無有效成交量，美股指數及AAPL等有有效柱狀資料。
- 網頁用原有Jina公開轉讀，擴充功能優先直接Yahoo。Yahoo未提供這個免費介面的合約SLA或固定官方頻率額度；既有Spark實測每批最多20代號。Jina Reader無key官方額度為[每IP約20 RPM](https://jina.ai/reader/)，與新聞、其他看板分頁及同IP使用共用；因此不是每個看板獨享20次。來源／轉讀可能快取、延遲、限流；60秒查詢不是60秒內最新行情保證，不供交易決策。
- 單一圖表沒有分鐘數據時，一般電腦／手機使用[TradingView免費小工具](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/demos/basic-area-chart/)作替代，放在只有腳本與開新頁權限、沒有same-origin權限的sandbox iframe。第三方文字大小及交易所延遲由供應者控制。[小工具數據說明](https://www.tradingview.com/widget-docs/faq/data/)。**TV為守26px最低字級，不能嵌入不可控制小字的小工具，改顯示大字「暫時未能取得數據」**；其餘圖表繼續正常。原生25個代號的即日數據已成功實測。
- 新增圖表資產一併離線快取，行情只作匿名公開快取；Gmail及憑證不會送到行情轉讀或圖表iframe。

## 21/10/2026 PWA、訊息收起及新聞更新

- Gmail／WhatsApp 分別記住展開狀態，首次預設收起。Gmail 收起會取消5分鐘計時器、取消進行中的請求、停止新郵件提示；不載入 Google 登入元件。展開時若授權過期，只顯示唯讀連接按鈕，不發突發提示。重新展開的第一批郵件只建立新基線。
- 頂部快捷列：電腦在新分頁開 Gmail、WhatsApp Web、Threads；iPhone 嘗試 Gmail／WhatsApp App scheme，未開啟時回到網頁。Threads 用 HTTPS Universal Link，由 iOS／安裝狀態決定是否開 App；未能在實體 iPhone 保證所有 App 跳轉。
- 交通預設按下一班到站排序，只在30秒資料更新時調位；不足60秒差距沿用先前次序，手機調位400毫秒滑動；桌面／TV不作垂直調位動畫。無資料在最後。「固定次序」恢復 config.js 路線順序。路線及車站已擴充至上述13條。
- 下方標題及突發橫額高度由86px縮至73px（手機82px→70px）；手機標題字不小於13px。內容按可用視窗高度預留固定底欄空間，桌面／TV交通及右欄改為水平分頁，手機整頁上下瀏覽。
- 美股新聞為四個 CNBC 官方 RSS 合併、去重後最新10條，每5分鐘更新；英文標題保持原文，加入下方「美股」輪播。手機接在國際新聞後。
- 中文本地新聞合併港台、now及有線；按標題去重。篩選選擇記存在瀏覽器，灰色來源按鈕表示該來源本次失敗。英文仍用港台英文 RSS。
- PWA 使用 **app.webmanifest**；原 **manifest.json** 仍只屬 Chrome 擴充功能。site.webmanifest 留作舊連結相容，不再由主頁引用。

### 安裝、離線及更新

1. Chrome 打開正式網址，按快捷列「安裝」，再確認瀏覽器的安裝對話框。若沒有提示，可用 Chrome 選單 →「投放、儲存及分享」→「安裝網頁為應用程式」。
2. 第一次須連網載入。Service Worker 預存介面、程式、圖示及一個本地英文字體；Google 字體亦預熱快取，下載失敗時用本地／系統字體。
3. 公開數據採網絡優先；失敗用本瀏覽器上次成功資料，標示原來取得時間。完全離線顯示「離線中」，只有部分來源失敗則顯示「部分來源未連線」。交通快取只供參考，不代表仍有該班車。
4. **Gmail 內容、OAuth 元件、憑證不進入 Service Worker／Cache Storage。** Gmail 存取權杖仍按原設計只存本機 localStorage；擴充功能／瀏覽器本身或其他已安裝外掛的權限不由本程式控制。
5. 新版本完成下載後，頂部顯示「有新版本，按此更新」。一般版按下才切換及重新載入；TV模式在下次換頁時自動切換。每次開啟及每15分鐘檢查版本。
6. 瀏覽器清除網站資料、儲存空間回收或尚未成功載入的來源，都可能沒有離線副本。未先連網打開的語言版本也可能沒有該語言天氣／新聞快取。
7. PWA 沒有伺服器推播；鎖屏、背景或關頁後不保證更新。桌面提示仍須開著看板。

### iPhone 更換舊主畫面圖示

1. 長按舊 INFO//DESK 圖示 →「移除書籤」或「刪除 App」→確認移除舊主畫面入口。**不用在 Safari 清除網站資料。**
2. 用 **Safari** 開啟 https://kennethchan26-cyber.github.io/info-desk/ ，等待資料及新圖示載入。
3. 按「分享」→「加入主畫面」，名稱用 INFO//DESK；如有「以網頁 App 開啟」，保持啟用 →「加入」。
4. 從新圖示開啟，會使用獨立視窗、黑色半透明狀態列及瀏海／底部安全區域。Gmail 如需重新授權，展開 Gmail 再按連接即可。

### 新聞實際來源及時效

所有時間均依文章發布時間排序；下列「檢查週期」不是保證發布延遲。Google 搜尋 RSS 有搜尋索引延遲，Jina Reader 亦可能快取／限流；不繞過來源封鎖。僅供個人非商業閱讀，連回原文。

| 來源 | 實際 RSS／既有列表網址 | 檢查週期／約略時效 |
| --- | --- | --- |
| CNBC Top News | https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114 | 5分鐘；RSS宣告TTL60分鐘，可能數分鐘至約1小時或更久 |
| CNBC Investing | https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069 | 同上 |
| CNBC Economy | https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258 | 同上 |
| CNBC Asia-Pacific | https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19832390 | 同上 |
| now（Google News搜尋） | https://news.google.com/rss/search?q=site%3Anews.now.com&hl=zh-HK&gl=HK&ceid=HK%3Azh-Hant | 60秒；索引延遲可由數分鐘至數小時，無保證 |
| 有線（Google News搜尋） | https://news.google.com/rss/search?q=site%3Ai-cable.com&hl=zh-HK&gl=HK&ceid=HK%3Azh-Hant | 同上 |
| 港台中文本地（保留原列表，非RSS） | https://news.rthk.hk/rthk/ch/latest-news/local.htm | 60秒；Reader快照可能延遲，常見數分鐘至更久 |
| 港台中文國際（列表） | https://news.rthk.hk/rthk/ch/latest-news/world-news.htm | 同上 |
| 港台中文財經（列表） | https://news.rthk.hk/rthk/ch/latest-news/finance.htm | 同上 |
| 港台英文香港 | https://rthk.hk/rthk/news/rss/e_expressnews_elocal.xml | 60秒；Reader轉讀，可能數分鐘或更久 |
| 港台英文國際 | https://rthk.hk/rthk/news/rss/e_expressnews_einternational.xml | 同上 |
| 港台英文財經 | https://rthk.hk/rthk/news/rss/e_expressnews_efinance.xml | 同上 |

CNBC 直接跨域讀取（來源容許 CORS）；其餘新聞沿用 https://r.jina.ai/ 加原網址的方式。now 官方新聞網域為 news.now.com；有線為 www.i-cable.com，Google 的 site:i-cable.com 同時涵蓋該子網域。以上免費來源不需要新增 API key。

本次本機實測（21/10/2026 約19:42 HKT）：CNBC四個RSS均HTTP200並合併顯示10條；now及有線均已在看板成功顯示來源標籤，港台中文及英文香港亦成功。Google News原RSS各有100條；now最新文章約15分鐘前、有線約5分鐘前，這是文章年齡，不是量度出的索引延遲。Reader曾短暫封鎖／HTTP429，恢復後毋須改來源即可讀取；英文國際／財經曾有一源失敗但其餘新聞仍顯示。免費來源不能保證每次成功。

## 發佈檔案

只上載以下 40 個檔案，不要拖入整個工作資料夾、設定截圖、測試輸出、憑證或瀏覽器資料。

| 檔案 | 用途 |
| --- | --- |
| .gitignore | 只容許已審核檔案加入 Git |
| .nojekyll | 關閉 Jekyll 處理 |
| index.html | 共用主頁、iPhone 主畫面設定 |
| styles.css | 深色格子介面、手機單欄及安全邊界 |
| tv.js / tv.css / tv-panels.js | TV 模式記憶、自適應畫布及Screen Wake Lock |
| display.js / display.css | 地區篩選、桌面水平分頁、頂部天氣及TV大字規則 |
| charts.js / charts.css | 分批歷史走勢、圖表及大圖彈窗 |
| chart-widget.html / chart-widget.js | sandbox隔離的備用圖表 |
| lightweight-charts.standalone.production.js | 本地圖表程式庫5.2.0 |
| LIGHTWEIGHT-CHARTS-LICENSE.txt / LIGHTWEIGHT-CHARTS-NOTICE.txt | 圖表庫Apache2.0授權及版權 |
| config.js | 路線、股票、新聞及公開 Gmail Client ID |
| app.js | 資料讀取、登入及提示佇列 |
| background.js | 擴充功能 WhatsApp 標題未讀提示 |
| manifest.json | Chrome MV3 設定，不是網站 manifest |
| site.webmanifest | 舊主畫面連結相容設定；主頁改用 app.webmanifest |
| icon.svg | 網站圖示 |
| apple-touch-icon.png | iPhone 180 × 180 圖示，沒有個人 metadata |
| README.md | 本說明 |
| market-calendar.js | 2026／2027 港交所及 NYSE 交易日曆、時區及倒數 |
| broadcast.js | 電視台式輪播、側欄、新聞條及圖表掛載 |
| signals.js | 香港熱搜 RSS、Coinbase 公開 WebSocket、重連及新熱搜提示 |
| i18n.js | 中英介面切換、日期格式及偏好記憶 |
| forex.js | 外幣兌港元換算、前一參考日升跌及批量查詢 |
| public-data.js | 嚴格限制的公開數據 network-first 快取 |
| transit-order.js | 到站時間排序及60秒穩定區間 |
| news-extra.js | CNBC、now／有線、去重及來源篩選 |
| pwa.js / sw.js | 安裝、版本提示、離線介面與字體快取 |
| app.webmanifest | PWA 獨立視窗設定 |
| icon-192.png / icon-512.png / icon-maskable-512.png | PWA 圖示 |
| barlow-condensed.woff2 / FONT-LICENSE.txt | 本地英文字體及 SIL OFL 授權 |

## 雙語、外匯與可收起加密貨幣

- 橙色名稱標籤配紫紅／紫藍背景、漸變外框；升跌仍用綠紅，突發仍為紅色。
- 外匯合併為 13 種外幣兌港元：USD、CNY、JPY、GBP、EUR、AUD、CAD、SGD、TWD、KRW、THB、CHF、NZD。JPY／KRW 每 100 單位，其餘每 1 單位，顯示 4 位小數。
- [Frankfurter v2](https://frankfurter.dev/) 每次一個批量請求讀取全部貨幣最近 21 日官方參考價，選最新兩個有效日期，以未四捨五入的倒數計算升跌。使用預設綜合市場中間參考價，不是銀行買賣牌價。每 60 秒檢查，但來源每日更新，升跌為前一參考日比較，不代表即時日內行情。畫面逐項列出參考日期；前一日缺資料不會假設零升跌。無 API key、無每日／每月配額，仍可能觸發反濫用限流。
- 加密貨幣預設收起，只顯示標題及箭嘴；選擇存在本機瀏覽器。收起立即停止 WebSocket、心跳及重試，展開才連線；不出現在主畫面輪播或跑馬燈。手機放在新聞之後最底。
- 天氣英文版直接使用天文台 lang=en；十三條路線的英文目的地及站名已按營辦商官方路線／車站列表核對，列於 config.js 的 destinationEn／stopNameEn。ETA 備註使用 API 的英文欄位。
- 英文新聞使用 [港台官方英文 RSS](https://news.rthk.hk/rthk/en/rss.htm)：[本地](https://rthk.hk/rthk/news/rss/e_expressnews_elocal.xml)、[國際](https://rthk.hk/rthk/news/rss/e_expressnews_einternational.xml)、[財經](https://rthk.hk/rthk/news/rss/e_expressnews_efinance.xml)。沿用 Jina Reader，英文 RSS 用 browser/markdown 模式並避開舊快取，保留標題、連結、原文時間。讀取失敗獨立顯示錯誤，不以中文新聞冒充英文新聞。
- Gmail 寄件人／標題及香港熱搜字眼／相關文章維持原文，不翻譯個人內容。切換語言不觸發登入、也不把語言變化視為新消息。語言及展開偏好分別以 dashboard_language、dashboard_crypto_open 儲存在瀏覽器。

## 保留的美股、熱搜及即時數字

- 自選美股 15 隻：AAPL、MSFT、NVDA、TSLA、AMZN、GOOGL、META、AVGO、AMD、TSM、NFLX、JPM、BRK.B、COST、PLTR。BRK.B 對應 Yahoo 代號 BRK-B。
- Yahoo Spark 批量 endpoint 每次最多 20 個代號（超過會回傳 Bad Request）。港股 7 項＋美股 18 項＝25 項，每 60 秒分兩批讀取；不以逐股重試擴大請求量。網頁仍經原有 Jina Reader，擴充功能直接讀 Yahoo。免費非合約行情介面可能變動、限流或延遲，批量並不保證即時或永不限流。
- [香港熱搜 RSS](https://trends.google.com/trending/rss?geo=HK) 每 15 分鐘更新，依 RSS 原順序顯示首 10 位，並非按搜尋量自行排名。搜尋量為 Google 概約值；新聞連結取自同一 RSS。沿用 Jina Reader，使用 browser/text 模式保留 Google RSS 的附加欄位。讀取失敗只影響熱搜。首次成功不提示；之後只有新出現且位列前 3 位的字眼會提示。
- Threads 使用官方 HTTPS Universal Link：已安裝 App 時由手機系統決定是否開啟 App，否則開網頁；不讀 Threads 資料。實際開啟行為受 Safari、安裝狀態及用戶預設影響。
- BTC-USD、ETH-USD、SOL-USD 使用 [Coinbase Exchange 公開 ticker 串流](https://docs.cdp.coinbase.com/exchange/websocket-feed/channels)，不需要 key 或登入；升跌為 24 小時，不是股票的即日升跌。每筆行情只更新已展開的加密貨幣板。
- WebSocket 斷線顯示「重新連線中」，採用約 1、2、4 秒遞增至 30 秒的重試等待（另加少量隨機延遲）。Heartbeat 超過 20 秒沒有資料亦會重連；關頁會停止，恢復網絡會重連。手機鎖屏或背景可能暫停，不保證背景即時更新。
- 指數、自選股、外匯及加密貨幣改動時，格子及價格紅／綠閃動 0.5 秒再恢復白字；首次資料不閃。外匯仍是每日參考價，沒有變動時不會製造假跳動。
- 電腦／TV主板共十頁，次序見頂部；手機沿用單欄閱讀順序並加入兩個圖表區。手機外匯在市場之後，熱搜在新聞之前，加密貨幣最後。Gmail 權限及交易日曆未更改；中文新聞增加 now 及有線。

## 電視台式版面

電腦主板每 15 秒輪換，可用底部分頁手動切換或暫停；香港時間星期一至五 07:00–09:30 及 17:30–20:00 固定交通。手機寬度小於 768px 時所有板塊單欄直排，不自動輪換。下方新聞條每 10 秒更新，每四條穿插市場數據。突發提示仍為優先佇列，每條 10 秒。

日曆在 market-calendar.js；[港交所 2026 通告](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf)、[2027 通告](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2026/ce_SEHK_CT_077_2026.pdf)、[NYSE 交易日曆](https://www.nyse.com/trade/hours-calendars)。包含週末、休市日、港股半日市及 NYSE 13:00 提早收市；紐約時區由 Intl 自動處理夏令時間。港股倒數以持續交易 16:00（半日 12:00）結束為準，不含收市競價。只覆蓋 2026–2027，不把未知年度或臨時停市當作已確認交易日。開頁第一刻不發提示；睡眠／背景恢復亦不補播錯過的開收市提示。

走勢線已改為來源的完整分鐘數據，細節見頂部圖表說明。英數使用 Barlow Condensed，中文使用 Noto Sans TC（Google Fonts；不能載入時自動使用系統字款）。沒有使用任何其他媒體的名稱、標誌或專用字款。

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

現在支援 PWA 及 Service Worker 離線開啟；沒有背景推播或伺服器。iPhone 切到背景、鎖屏或關頁後，更新及提示可能暫停。桌面通知只供支援的電腦瀏覽器、看板仍開啟時使用。

## Chrome 擴充功能

1. 保留現有擴充功能資料夾的位置，不要移動。
2. 地址列開啟 chrome://extensions，開發人員模式 → 載入未封裝項目，選包含 manifest.json 的資料夾。
3. 更新頁面程式後開新分頁可取得新版本；如改動 manifest/background，需在擴充功能管理頁重新載入。
4. 如 Chrome 問是否保留新分頁變更，按保留。
5. 看板底部顯示 extension ID 及 Gmail Redirect URI，登記到 Google Web Client。若移動資料夾導致 ID 改變，需重新登記。
6. WhatsApp 只讀分頁標題數字，不讀訊息、不注入 WhatsApp 頁面；網頁版沒有未讀提示能力。

## 更新、提示與錯誤

- 交通每 30 秒；天氣每 10 分鐘；股票、圖表、外匯、本地及國際新聞每 60 秒；CNBC 每 5 分鐘；Gmail 只在展開且授權有效時每 5 分鐘。上次查詢未完成時不重複排隊。
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
| 30X、682 | 城巴 ETA | 預計到站，可能不足 3 班 |
| 281E、281A、49X、83X、86、83K、83S | 九巴 ETA | 官方預測，可能沒有班次，非API失敗 |
| Gmail | Gmail API | 唯讀、只在展開時每 5 分鐘查詢，不離線快取 |
| 港股／美股 | Yahoo Finance spark 批量報價；網頁經 Jina Reader | 每批最多 20 個代號；現有 25 項每次分 2 批。報價及快照可延遲，非交易用途 |
| 外匯 | Frankfurter v2／多個中央銀行及官方來源 | 每日綜合市場中間參考價，較前一參考日，非銀行即時買賣價；每 60 秒查詢 |
| 香港新聞 | 港台本地分類＋Google News 的 now／有線搜尋 RSS，經 Jina Reader | 原文發布時間排序、標題去重、來源篩選；英文仍為港台 |
| 國際／財經 | 港台國際及財經分類，經 Jina Reader | 合併去重、由新到舊；部分來源失敗會標示 |
| 香港熱搜 | Google Trends 香港 RSS，經 Jina Reader | 每 15 分鐘查詢，首 10 個字眼及概約搜尋量；並非逐秒排行 |
| BTC／ETH／SOL | Coinbase Exchange 公開 WebSocket ticker | 美元成交價即時串流；升跌百分比以 24 小時開盤價計算，並非全市場綜合價 |

Jina Reader 只收到公開市場／新聞網址，會如一般網站收到連線 IP，不會收到 Gmail 權杖或郵件。免費公開服務可快取、限流或暫停；若停用，須另選容許跨域的來源。本程式不會自動傳送私人資料到其他代理。

資源使用相對路徑，可置於專案子路徑。純靜態寄存仍需連接外部 API，但不依賴原來電腦開機。
