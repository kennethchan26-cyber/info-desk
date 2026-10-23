/* ================================================================
   使用者設定檔：日後增減自選股、巴士路線或填 OAuth Client ID，只改此檔。
   請勿在此放 Gmail 密碼、Google Client Secret 或任何私人資料。
   ================================================================ */
window.DASHBOARD_CONFIG = {
  // Public snapshots only. Never put Longbridge credentials in this file.
  LONGBRIDGE: {
    ENABLED: true,
    URL: "https://raw.githubusercontent.com/kennethchan26-cyber/info-desk/data/market.json",
    MAX_AGE_MS: 1200000,
    ACTIVE_SECONDS: 120, CLOSED_SECONDS: 900,
    INTRADAY_SECONDS: 300, EXTRAS_SECONDS: 900,
    SYMBOLS: {"^HSI":"HSI.HK","^HSCE":"HSCEI.HK","HSTECH.HK":"HSTECH.HK","^DJI":".DJI.US","^GSPC":".SPX.US","^IXIC":".IXIC.US","BRK-B":"BRK.B.US"},
    AH: ["2318.HK", "3968.HK"]
  },
  GMAIL: {
    WEB_CLIENT_ID: "591775724134-779o2m1f5oudgkc32ufblsbccbl14sr2.apps.googleusercontent.com",
    EXTENSION_CLIENT_ID: "591775724134-779o2m1f5oudgkc32ufblsbccbl14sr2.apps.googleusercontent.com",
    SCOPE: "https://www.googleapis.com/auth/gmail.readonly"
  },

  HK_MARKET: [
    { yahoo: "^HSI", tv: "TVC:HSI", name: "恒生指數", alertIndex: "HSI" },
    { yahoo: "^HSCE", tv: "HSI:HSCEI", name: "國企指數" },
    { yahoo: "HSTECH.HK", tv: "HSI:HSTECH", name: "恒生科技指數" },
    { yahoo: "0700.HK", tv: "HKEX:700", name: "0700 騰訊" },
    { yahoo: "0005.HK", tv: "HKEX:5", name: "0005 匯豐" },
    { yahoo: "9988.HK", tv: "HKEX:9988", name: "9988 阿里巴巴" },
    { yahoo: "0388.HK", tv: "HKEX:388", name: "0388 港交所" },
    { yahoo: "2800.HK", tv: "HKEX:2800", name: "2800 盈富基金" }
  ],
  US_MARKET: [
    { yahoo: "^DJI", tv: "FOREXCOM:DJI", name: "道瓊斯", alertIndex: "DJI" },
    { yahoo: "^GSPC", tv: "FOREXCOM:SPXUSD", name: "標普 500" },
    { yahoo: "^IXIC", tv: "NASDAQ:IXIC", name: "納斯達克" },
    { yahoo: "AAPL", tv: "NASDAQ:AAPL", name: "AAPL" },
    { yahoo: "MSFT", tv: "NASDAQ:MSFT", name: "MSFT" },
    { yahoo: "NVDA", tv: "NASDAQ:NVDA", name: "NVDA" },
    { yahoo: "TSLA", tv: "NASDAQ:TSLA", name: "TSLA" },
    { yahoo: "AMZN", name: "AMZN" },
    { yahoo: "GOOGL", name: "GOOGL" },
    { yahoo: "META", name: "META" },
    { yahoo: "AVGO", name: "AVGO" },
    { yahoo: "AMD", name: "AMD" },
    { yahoo: "TSM", name: "TSM" },
    { yahoo: "NFLX", name: "NFLX" },
    { yahoo: "JPM", name: "JPM" },
    { yahoo: "BRK-B", name: "BRK.B" },
    { yahoo: "COST", name: "COST" },
    { yahoo: "PLTR", name: "PLTR" }
  ],

  // Yahoo Spark 每批最多 20 個代號；25 項港美股合計每分鐘兩批。
  MARKET_BATCH_SIZE: 20,
  BUS_PREVIEW_MINUTES: 12, // 每條路線 previewAlert:false 可關閉綠色預告
  TV_RAIL: {
    INTERVAL_MS: 10000, OFFSET_MS: 5000,
    UPPER: ['arrivals','indices','hk-movers','us-movers','trends','lb-anomalies'],
    LOWER: ['fx','forecast','heatmap','clocks','us-news','lb-temperature']
  },
  HEATMAP: { INTERVAL_MS:60000, BATCH_SIZE:20, STAGGER_MS:10000 },
  FX: {
    API: "https://api.frankfurter.dev/v2/rates",
    // Daily mid-market reference rates. JPY/KRW are quoted per100 units.
    CURRENCIES: [
      {code:"USD",name:"美元",en:"US dollar",units:1}, {code:"CNY",name:"人民幣",en:"Renminbi",units:1},
      {code:"JPY",name:"日圓",en:"Japanese yen",units:100}, {code:"GBP",name:"英鎊",en:"British pound",units:1},
      {code:"EUR",name:"歐元",en:"Euro",units:1}, {code:"AUD",name:"澳元",en:"Australian dollar",units:1},
      {code:"CAD",name:"加元",en:"Canadian dollar",units:1}, {code:"SGD",name:"新加坡元",en:"Singapore dollar",units:1},
      {code:"TWD",name:"新台幣",en:"New Taiwan dollar",units:1}, {code:"KRW",name:"韓圜",en:"South Korean won",units:100},
      {code:"THB",name:"泰銖",en:"Thai baht",units:1}, {code:"CHF",name:"瑞士法郎",en:"Swiss franc",units:1},
      {code:"NZD",name:"紐西蘭元",en:"New Zealand dollar",units:1}
    ]
  },
  TRENDS: { RSS: "https://trends.google.com/trending/rss?geo=HK", INTERVAL_MS: 900000, LIMIT: 10 },
  CRYPTO: {
    WS_URL: "wss://ws-feed.exchange.coinbase.com",
    PRODUCTS: [
      { id: "BTC-USD", symbol: "BTC", name: "比特幣" },
      { id: "ETH-USD", symbol: "ETH", name: "以太幣" },
      { id: "SOL-USD", symbol: "SOL", name: "Solana" }
    ]
  },

  /* 已按官方路線及站點列表核實（2026-10-21）。region 為上車站地區，可自行新增。
     direction: 九巴／城巴 O=outbound、I=inbound；小巴使用 routeSeq/stopSeq。
     680 城巴把九巴 ST534 同一位置命名為「歷奇單車場, 小瀝源路」。
     682 是城巴獨營，往柴灣（東）為 I；九巴官方路線表沒有 682。
     同名站柱勿混用：281A 綠怡雅苑 ST603；49X/83X ST604（相距約 35 米）；
     86 廣柏樓 ST600；83K/83S ST601（相距約 10 米），均按各路線站表選取。 */
  TRANSIT: [
    { key: "gmb804", previewAlert: true, region: "沙田", destinationEn: "Kwong Yuen", stopNameEn: "Bus lay-by on Che Kung Miu Road outside Tai Wai Station Public Transport Interchange", operator: "專線小巴", route: "804", destination: "廣源", stopName: "車公廟路，大圍站公共運輸交匯處外", api: "gmb", routeId: 2010275, routeSeq: 2, stopSeq: 5, stopId: "20001582" },
    { key: "gmb65k", previewAlert: true, region: "沙田", destinationEn: "Fo Tan Station (Circular)", stopNameEn: "Au Pui Wan Street, Near Kin Ho Industrial Building Block 2", operator: "專線小巴", route: "65K", destination: "火炭站（循環線）", stopName: "坳背灣街近金豪工業大廈第二座", api: "gmb", routeId: 2009081, routeSeq: 1, stopSeq: 6, stopId: "20001505" },
    { key: "gmb69x", previewAlert: true, region: "港島", destinationEn: "Cyberport", stopNameEn: "Lockhart Road, near Cannon Street", operator: "專線小巴", route: "69X", destination: "數碼港", stopName: "駱克道近景隆街", api: "gmb", routeId: 2000511, routeSeq: 2, stopSeq: 1, stopId: "20006944" },
    { key: "bus680", previewAlert: true, region: "沙田", destinationEn: "ADMIRALTY STATION (EAST)", stopNameEn: "ALVA HOTEL BY ROYAL (ST534)", operator: "九巴＋城巴", route: "680", destination: "金鐘站（東）", stopName: "帝逸酒店（ST534）", api: "joint", kmbStopId: "2223D64E9ED2E1A7", kmbDirection: "O", kmbServiceType: "1", ctbStopId: "003082", ctbDirection: "I" },
    { key: "ctb30x", previewAlert: true, region: "港島", destinationEn: "Admiralty (East)", stopNameEn: "Cyberport 3, Cyberport Road", operator: "城巴", route: "30X", destination: "金鐘（東）", stopName: "數碼港三座，數碼港道", api: "ctb", stopId: "002393", direction: "O" },
    { key: "kmb281e", previewAlert: true, region: "九龍", destinationEn: "KWONG YUEN", stopNameEn: "OLYMPIC STATION (MK656)", operator: "九巴", route: "281E", destination: "廣源", stopName: "奧運站 (MK656)", api: "kmb", stopId: "9DA7325E4238402B", direction: "O", serviceType: "1", stopSeq: 10 },
    { key: "ctb682", previewAlert: true, region: "沙田", destinationEn: "Chai Wan (East)", stopNameEn: "Adventure Cycling Area, Siu Lek Yuen Road", operator: "城巴", route: "682", destination: "柴灣（東）", stopName: "歷奇單車場, 小瀝源路", api: "ctb", stopId: "003082", direction: "I", stopSeq: 19 },
    { key: "kmb281a", previewAlert: true, region: "沙田", destinationEn: "KOWLOON STATION", stopNameEn: "SIU LEK YUEN (GREENHILL VILLA) (ST603)", operator: "九巴", route: "281A", destination: "九龍站", stopName: "小瀝源 (綠怡雅苑) (ST603)", api: "kmb", stopId: "75D57F5A5891A1C2", direction: "O", serviceType: "1", stopSeq: 2 },
    { key: "kmb49x", previewAlert: true, region: "沙田", destinationEn: "TSING YI FERRY", stopNameEn: "SIU LEK YUEN (GREENHILL VILLA) (ST604)", operator: "九巴", route: "49X", destination: "青衣碼頭", stopName: "小瀝源 (綠怡雅苑) (ST604)", api: "kmb", stopId: "51D13DDB8EBA98AF", direction: "O", serviceType: "1", stopSeq: 2 },
    { key: "kmb83x", previewAlert: true, region: "沙田", destinationEn: "KWUN TONG FERRY", stopNameEn: "SIU LEK YUEN (GREENHILL VILLA) (ST604)", operator: "九巴", route: "83X", destination: "觀塘碼頭", stopName: "小瀝源 (綠怡雅苑) (ST604)", api: "kmb", stopId: "51D13DDB8EBA98AF", direction: "O", serviceType: "1", stopSeq: 8 },
    { key: "kmb86", previewAlert: true, region: "沙田", destinationEn: "MEI FOO", stopNameEn: "CYPRESS HOUSE KWONG YUEN ESTATE (ST600)", operator: "九巴", route: "86", destination: "美孚", stopName: "廣源邨廣柏樓 (ST600)", api: "kmb", stopId: "260B43921BAFD8CB", direction: "O", serviceType: "1", stopSeq: 2 },
    { key: "kmb83k", previewAlert: true, region: "沙田", destinationEn: "SHA TIN CENTRAL (CIRCULAR)", stopNameEn: "CYPRESS HOUSE KWONG YUEN ESTATE (ST601)", operator: "九巴", route: "83K", destination: "沙田市中心（循環線）", stopName: "廣源邨廣柏樓 (ST601)", api: "kmb", stopId: "7E3C2CA5ABEC8416", direction: "O", serviceType: "1", stopSeq: 2 },
    { key: "kmb83s", previewAlert: true, region: "沙田", destinationEn: "SHATIN CENTRAL", stopNameEn: "CYPRESS HOUSE KWONG YUEN ESTATE (ST601)", operator: "九巴", route: "83S", destination: "沙田市中心", stopName: "廣源邨廣柏樓 (ST601)", api: "kmb", stopId: "7E3C2CA5ABEC8416", direction: "O", serviceType: "1", stopSeq: 2 }
  ],

  NEWS: {
    // Google News indexing can be delayed; these public feeds use the same Reader bridge as local news.
    SEARCH_LOCAL: [
      {id:"now",rss:"https://news.google.com/rss/search?q=site%3Anews.now.com&hl=zh-HK&gl=HK&ceid=HK%3Azh-Hant"},
      {id:"cable",rss:"https://news.google.com/rss/search?q=site%3Ai-cable.com&hl=zh-HK&gl=HK&ceid=HK%3Azh-Hant"}
    ],
    US: [
      {name:"Top News",rss:"https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"},
      {name:"Investing",rss:"https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069"},
      {name:"Economy",rss:"https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"},
      {name:"Asia-Pacific",rss:"https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19832390"}
    ],
    // 公開新聞列表經 Jina Reader 轉讀；不傳送 Gmail 權杖或私人資料。
    LOCAL: ["https://news.rthk.hk/rthk/ch/latest-news/local.htm"],
    WORLD: ["https://news.rthk.hk/rthk/ch/latest-news/world-news.htm", "https://news.rthk.hk/rthk/ch/latest-news/finance.htm"],
    EN_LOCAL: ["https://rthk.hk/rthk/news/rss/e_expressnews_elocal.xml"],
    EN_WORLD: ["https://rthk.hk/rthk/news/rss/e_expressnews_einternational.xml", "https://rthk.hk/rthk/news/rss/e_expressnews_efinance.xml"]
  }
};
