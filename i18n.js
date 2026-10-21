"use strict";
// Interface-only translation. Personal mail, news and trending terms are never translated.
window.InfoDeskI18n = (() => {
  let language='tc',revision=0;
  try{language=localStorage.getItem('dashboard_language')==='en'?'en':'tc'}catch{}
  const words={
    '交通 30 秒；天氣、股票、外匯、本地及國際新聞 60 秒；美股新聞 5 分鐘；Gmail 只在展開時每 5 分鐘；熱搜 15 分鐘。加密貨幣收起時停線。公開數據離線時顯示上次資料，Gmail 不快取。手機背景或關頁後不保證更新，沒有背景推播。':'Transport 30s; weather, stocks, FX, local and world news 60s; CNBC 5min; Gmail 5min only while expanded; trends 15min. Crypto disconnects when collapsed. Public data use the last saved copy offline; Gmail is never cached. No guaranteed background updates or push.',
    '快捷列':'QUICK LINKS','安裝':'INSTALL','有新版本，按此更新':'NEW VERSION — CLICK TO UPDATE','快取':'CACHED',
    '按到站排序':'ARRIVAL ORDER','固定次序':'FIXED ORDER','暫無班次':'NO UPCOMING SERVICE',
    '美股新聞':'US MARKET NEWS','官方 RSS · 英文原文':'OFFICIAL RSS · ORIGINAL ENGLISH',
    '全部':'ALL','有線':'i-CABLE','其他':'OTHER','此來源暫時未能取得數據':'This source is temporarily unavailable',
    'Safari：分享 → 加入主畫面':'Safari: Share → Add to Home Screen',
    'Chrome：選單 → 投放、儲存及分享 → 安裝網頁為應用程式':'Chrome: Menu → Cast, save and share → Install page as app',
    '離線介面未能儲存；請保持網絡連線並重新整理。':'Offline interface could not be saved; stay online and reload.',
    '港股':'HK MARKET','美股':'US MARKET','下一事件':'NEXT EVENT','午休':'LUNCH BREAK','午市開市':'AFTERNOON OPEN','開市':'OPEN','收市':'CLOSE','次搜尋':'SEARCHES','新上榜熱搜':'NEW TRENDING SEARCH',
    '香港':'HONG KONG','美國':'UNITED STATES','靜音':'MUTE','桌面通知':'DESKTOP ALERTS','測試提示':'TEST ALERTS',
    '開市與收市倒數':'MARKET COUNTDOWNS','下一個交易時刻':'NEXT MARKET EVENT','港股 × 美股':'HONG KONG × US',
    '2026–2027 交易日曆':'2026–2027 TRADING CALENDARS','港股按持續交易時段（不含收市競價）；不包含臨時停市。':'HK continuous trading only; closing auctions and emergency halts excluded.',
    '美股自動換算紐約夏令時間。報價可能延遲。':'US hours adjust for New York daylight saving. Quotes may be delayed.',
    '即時交通':'LIVE TRANSPORT','運輸署 / 九巴 / 城巴':'TRANSPORT DEPT / KMB / CITYBUS','官方預計到站時間':'Official estimated arrivals',
    '實際班次以營辦商為準 · 3 分鐘內紫紅色提示':'Times subject to operator · Magenta: within 3 mins',
    '香港天氣':'HONG KONG WEATHER','香港天文台':'HONG KONG OBSERVATORY','準即時觀測 / 官方預報':'Near-live observations / Official forecast',
    '市場焦點':'MARKET FOCUS','即日升跌 · 本頁觀測線':'DAY CHANGE · OBSERVED IN THIS SESSION',
    '網頁經 Jina Reader / 報價可延遲':'Web via Jina Reader / Quotes may be delayed',
    '線圖只記錄開頁後收到嘅報價，唔係完整日內走勢。':'Charts record quotes received since opening, not full intraday history.',
    '香港熱搜':'HK TRENDING','熱門搜尋 RSS / Jina Reader':'Trending searches RSS / Jina Reader',
    '依 RSS 順序 · 搜尋量為來源概約值':'RSS order · Search volumes are approximate',
    '只提示新出現於前 3 位的字眼':'Alerts only for newly appearing top 3 terms',
    '頭條新聞':'HEADLINES','本地 / 國際 / 財經':'LOCAL / WORLD / FINANCE','國際及財經':'WORLD & FINANCE','香港電台':'RTHK',
    '公開新聞 / Jina Reader':'Public news / Jina Reader','主畫面切換':'Select main panel','持續更新資料欄':'Live data column',
    '市場時鐘':'CLOCKS','交通':'TRANSPORT','天氣':'WEATHER','市場':'MARKETS','熱搜':'TRENDING','新聞':'NEWS',
    '交易時鐘':'TRADING CLOCKS','主要指數':'KEY INDICES','即日':'DAY','準即時':'NEAR LIVE',
    '外匯':'FOREIGN EXCHANGE','外幣兌港元':'FOREIGN CURRENCY TO HKD',
    '市場中間價，非銀行買賣牌價':'MID-MARKET RATES, NOT BANK BUY/SELL QUOTES',
    '最新 10 封未讀':'LATEST 10 UNREAD','連接 Gmail（唯讀）':'CONNECT GMAIL (READ ONLY)','中斷連接':'DISCONNECT',
    '只申請 gmail.readonly；權杖只儲存在你的瀏覽器。':'Only gmail.readonly; tokens stay in your browser.',
    '寄件人 / 標題':'SENDER / SUBJECT','收件時間':'RECEIVED','尚未連接 Gmail':'Gmail not connected','未讀':'UNREAD',
    '網頁版':'WEB','開啟 WhatsApp ↗':'OPEN WHATSAPP ↗','網頁版不會讀取 WhatsApp 資料。':'The web dashboard does not read WhatsApp data.',
    '加密貨幣':'CRYPTOCURRENCY','加密貨幣即時':'LIVE CRYPTO','公開成交串流 / 美元':'Public trade stream / USD',
    '24 小時升跌 · 每次成交更新':'24-HOUR CHANGE · UPDATES ON TRADES','來源時間':'SOURCE TIME',
    '設定與數據來源':'SETTINGS & DATA SOURCES','突發':'BREAKING','最新':'LATEST','關閉提示':'Dismiss alert',
    '每 30 秒':'EVERY 30 SECS','每 60 秒':'EVERY 60 SECS','每 5 分鐘':'EVERY 5 MINS','每 15 分鐘':'EVERY 15 MINS',
    '暫停輪播':'PAUSE','繼續輪播':'RESUME','輪播已暫停':'ROTATION PAUSED','15 秒輪播 · 香港視角':'15-SECOND ROTATION · HONG KONG',
    '香港視角 · 全部資料':'HONG KONG · ALL PANELS','通勤時段 · 固定交通':'COMMUTE HOURS · TRANSPORT PINNED',
    '下一班車':'NEXT ARRIVAL','正在讀取':'LOADING','正在取得到站時間…':'Loading arrival times…',
    '正在取得天文台資料…':'Loading HKO weather…','正在取得市場資料…':'Loading market quotes…','正在取得匯率…':'Loading exchange rates…',
    '正在取得香港熱搜…':'Loading HK trending searches…','正在取得新聞…':'Loading news…','正在載入指數、自選股及外匯…':'Loading indices, watchlist and FX…',
    '正在取得公開數據…':'Loading public data…','讀取中…':'Loading…','讀取報價…':'Loading quotes…',
    '暫時未能取得數據':'Data temporarily unavailable','暫無班次資料':'No upcoming services reported','暫無到站資料':'No arrivals available','暫缺':'N/A',
    '部分新聞來源暫時未能取得數據':'Some news feeds are temporarily unavailable','等待第二筆報價':'Waiting for the second quote',
    '連線逾時，下次更新重試':'Connection timed out; retrying next update','公開服務限流，下次更新重試':'Public service rate-limited; retrying next update',
    '來源回應沒有有效報價':'Source returned no valid quote','公開來源暫時無法讀取，下次更新重試':'Public source unavailable; retrying next update',
    '來源未提供時間':'Source timestamp unavailable','暫無天氣警告':'No active weather warning',
    '天氣警告':'WEATHER WARNING','即將到站':'ARRIVING SOON','市場異動':'MARKET MOVE','最新新聞':'LATEST NEWS','新 Gmail':'NEW GMAIL','市場時刻':'MARKET EVENT',
    '這是測試：橫額會在 10 秒後收起，亦可按 × 關閉。':'Test: this banner closes after 10 seconds, or press × to dismiss.',
    '第二條測試：佇列依次顯示，沒有重疊。':'Second test: queued alerts appear one at a time.',
    '專線小巴':'GMB','九巴＋城巴':'KMB + CITYBUS','九巴':'KMB','城巴':'CITYBUS','小巴':'GMB',
    '恒生指數':'HANG SENG','國企指數':'HSCEI','恒生科技指數':'HANG SENG TECH','0700 騰訊':'0700 TENCENT','0005 匯豐':'0005 HSBC','9988 阿里巴巴':'9988 ALIBABA','0388 港交所':'0388 HKEX',
    '道瓊斯':'DOW JONES','標普 500':'S&P500','納斯達克':'NASDAQ','比特幣':'Bitcoin','以太幣':'Ethereum',
    '休市':'CLOSED','交易中':'TRADING','休市・午休':'LUNCH BREAK','未確認':'UNCONFIRMED',
    '交易日曆待更新':'Calendar needs updating','下一年度交易日曆待更新':'Next-year calendar needs updating',
    '小時':'HRS','分鐘':'MINS','分':'MINS','秒':'SECS','即到':'DUE',
    '連線中':'CONNECTING','重新連線中':'RECONNECTING','即時串流 · USD':'LIVE STREAM · USD','已暫停連線':'CONNECTION PAUSED',
    '等待首筆成交':'Waiting for first trade','24 小時升跌未提供':'24-hour change unavailable','搜尋量未提供':'Search volume unavailable','查看相關新聞 ↗':'RELATED NEWS ↗',
    '目前沒有未讀郵件':'No unread mail','（未知寄件人）':'(Unknown sender)','（沒有主旨）':'(No subject)',
    '已連接；權杖只儲存在你的瀏覽器，可隨時中斷。':'Connected; tokens stay in your browser. Disconnect at any time.',
    '已中斷連接；本頁已移除 Gmail 存取權杖。':'Disconnected; the Gmail access token was removed from this browser.',
    '登入已逾時，請按「連接 Gmail」重新授權。':'Session expired. Select CONNECT GMAIL to authorize again.',
    '登入已逾時，請重新連接 Gmail':'Session expired. Reconnect Gmail.',
    '擴充功能｜只讀分頁標題':'EXTENSION | TAB TITLES ONLY','只檢查 web.whatsapp.com 分頁標題中的數字，不讀取訊息內容。':'Only reads unread counts in WhatsApp Web tab titles, never message contents.',
    '只在看板仍開啟時提供通知':'Notifications work while the dashboard remains open',
    '手機版提供頁內提示；關閉或切到背景後不保證更新。':'Mobile provides in-page alerts; background/closed-page updates are not guaranteed.',
    '授權回傳無效，請重新連接':'Invalid authorization response. Reconnect.',
    '請先設定網頁版 Client ID。':'Configure the web Client ID first.',
    'Google 登入元件載入逾時，請重試。':'Google sign-in timed out. Retry.',
    'Google 登入元件載入失敗。':'Google sign-in could not load.',
    '尚未授予 Gmail 唯讀權限':'Gmail read-only permission has not been granted',
    '登入視窗已關閉；可再按連接。':'Sign-in window closed. Select CONNECT again.',
    '登入視窗未能開啟。請在 Safari 開啟此網址，再按連接 Gmail。':'Sign-in window could not open. Open this URL in Safari and select CONNECT GMAIL.',
    '準備 Google 登入元件…':'Preparing Google sign-in…','已準備好，請再按「連接 Gmail（唯讀）」。':'Ready. Select CONNECT GMAIL (READ ONLY) again.',
    '請先在 config.js 填入擴充功能 Client ID。':'Enter the extension Client ID in config.js first.',
    '沒有收到授權結果':'No authorization response received','登入回傳驗證失敗，請重新連接':'Sign-in validation failed. Reconnect.',
    '你嘅世界，一眼掌握。':'YOUR WORLD. IN FOCUS.',
    'Gmail 仍只使用唯讀權限；公開 Client ID 及路線、自選股集中在 config.js。每個瀏覽器需各自登入。完整操作及來源：':'Gmail remains read-only. Public Client IDs, routes and watchlists are in config.js. Sign in separately on each browser. Instructions and sources: ',
    '交通 30 秒；天氣、股票、外匯、新聞 60 秒；Gmail 5 分鐘；熱搜 15 分鐘；加密貨幣只在展開時連接公開 WebSocket 串流。外匯為每日市場中間參考價，升跌較前一參考日；市場及新聞可延遲，最後更新為成功讀取時間，並非來源即時。手機背景或關頁後不保證更新，沒有背景推播。':'Transport 30s; weather, stocks, FX and news 60s; Gmail 5min; trends 15min. Crypto connects only while expanded. FX uses daily mid-market references; change vs previous reference day. Quotes and news may be delayed. Last updated means last successful fetch. Mobile background/closed-page updates and push are not guaranteed.',
    '交易日曆至 2027 年底；不處理交易所臨時停市。':'Calendars cover 2026–2027; emergency exchange halts are not included. ',
    'GitHub Pages／網頁模式｜目前網址：':'GITHUB PAGES / WEB | ORIGIN: ',
    '擴充功能模式｜ID：':'EXTENSION MODE | ID: '
  };
  const en=()=>language==='en',choose=(tc,english)=>en()?english:tc;
  function date(value,time=false){return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',day:'2-digit',month:en()?'short':'2-digit',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).format(new Date(value));}
  function day(key){return date(key.slice(0,4)+'-'+key.replaceAll('-','').slice(4,6)+'-'+key.replaceAll('-','').slice(6,8)+'T12:00:00+08:00')}
  function t(value){const raw=String(value??'');if(!en())return raw;const s=raw.trim();if(words[s])return raw.replace(s,words[s]);
    if(/^\d{2}:\d{2} 更新$/.test(s))return s.replace(' 更新',' UPDATED');
    if(s.startsWith('最後更新：'))return s.replace('最後更新：','LAST UPDATED: ').replace('等待資料','WAITING FOR DATA');
    if(s.startsWith('版面版本更新：'))return s.replace(/版面版本更新：(\d{2})\/(\d{2})\/(\d{4})/,(_,d,m,y)=>'LAYOUT UPDATED: '+date(`${y}-${m}-${d}T12:00:00+08:00`));
    if(/^\d+ 分$/.test(s))return s.replace(' 分',' MINS');
    if(/^本頁收到的 \d+ 筆報價走勢$/.test(s))return s.replace(/本頁收到的 (\d+) 筆報價走勢/,'Trend from $1 quotes received in this session');
    if(/^[\d.,+KMB]+ 次搜尋$/.test(s))return s.replace(' 次搜尋',' searches');
    if(s.startsWith('香港時間 '))return s.replace('香港時間 ','HKT ').replace('翌日 ','NEXT DAY ').replace('（半日市）',' (EARLY CLOSE)');
    if(s.startsWith('連接失敗：'))return 'Connection failed: '+t(s.slice(5));
    return raw;
  }
  const records=new WeakMap(),attributeRecords=new WeakMap();
  const protectedSelector='script,style,code,#languageToggle,[data-original-content],.news-title,.sender,.subject,.trend-term,.trend-articles,#lowerHeadline a,#breakingText';
  function translateText(node){if(!node.parentElement||node.parentElement.closest(protectedSelector))return;const before=node.nodeValue,old=records.get(node),original=old&&before===old.shown?old.original:before,shown=t(original);records.set(node,{original,shown});if(before!==shown)node.nodeValue=shown;}
  function apply(root=document.body){if(!root)return;if(root.nodeType===3){translateText(root);return}const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode())translateText(node);
    if(root.querySelectorAll)for(const e of [root,...root.querySelectorAll('[aria-label],[title]')])for(const key of ['aria-label','title']){if(!e.getAttribute||!e.hasAttribute(key)||e.id==='languageToggle')continue;const value=e.getAttribute(key),saved=attributeRecords.get(e)||{},old=saved[key],original=old&&old.shown===value?old.original:value,shown=t(original);saved[key]={original,shown};attributeRecords.set(e,saved);if(value!==shown)e.setAttribute(key,shown)}
  }
  function refreshDates(){document.querySelectorAll('[data-datetime]').forEach(e=>{e.textContent=date(Number(e.dataset.datetime),e.dataset.dateOnly!=='1')});}
  function sync(){document.documentElement.lang=en()?'en-HK':'zh-Hant-HK';document.title=en()?'INFO//DESK Personal Dashboard':'INFO//DESK 個人資訊看板';const b=document.querySelector('#languageToggle');if(b){b.dataset.language=language;b.setAttribute('aria-label',choose('切換至英文','Switch to Traditional Chinese'))}apply();refreshDates();}
  function setLanguage(next){if(!['tc','en'].includes(next)||next===language)return;language=next;revision++;try{localStorage.setItem('dashboard_language',language)}catch{}sync();document.dispatchEvent(new CustomEvent('infodesk:language',{detail:{language,revision}}));}
  document.addEventListener('DOMContentLoaded',()=>{sync();document.querySelector('#languageToggle').onclick=()=>setLanguage(en()?'tc':'en');new MutationObserver(events=>{for(const e of events){if(e.type==='characterData')translateText(e.target);else e.addedNodes.forEach(n=>{if(n.nodeType===1||n.nodeType===3)apply(n)})}}).observe(document.body,{subtree:true,childList:true,characterData:true});});
  return {get language(){return language},get revision(){return revision},en,choose,t,date,day,apply,refreshDates,setLanguage};
})();
