/* ================================================================
   使用者設定檔：日後增減自選股、巴士路線或填 OAuth Client ID，只改此檔。
   請勿在此放 Gmail 密碼、Google Client Secret 或任何私人資料。
   ================================================================ */
window.DASHBOARD_CONFIG = {
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
    { yahoo: "0388.HK", tv: "HKEX:388", name: "0388 港交所" }
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

  /* 已按官方路線及站點列表核實（2026-10-21）。
     680 城巴把九巴 ST534 同一位置命名為「歷奇單車場, 小瀝源路」。 */
  TRANSIT: [
    { key: "gmb804", destinationEn: "Kwong Yuen", stopNameEn: "Bus lay-by on Che Kung Miu Road outside Tai Wai Station Public Transport Interchange", operator: "專線小巴", route: "804", destination: "廣源", stopName: "車公廟路，大圍站公共運輸交匯處外", api: "gmb", routeId: 2010275, routeSeq: 2, stopSeq: 5, stopId: "20001582" },
    { key: "gmb65k", destinationEn: "Fo Tan Station (Circular)", stopNameEn: "Au Pui Wan Street, Near Kin Ho Industrial Building Block 2", operator: "專線小巴", route: "65K", destination: "火炭站（循環線）", stopName: "坳背灣街近金豪工業大廈第二座", api: "gmb", routeId: 2009081, routeSeq: 1, stopSeq: 6, stopId: "20001505" },
    { key: "gmb69x", destinationEn: "Cyberport", stopNameEn: "Lockhart Road, near Cannon Street", operator: "專線小巴", route: "69X", destination: "數碼港", stopName: "駱克道近景隆街", api: "gmb", routeId: 2000511, routeSeq: 2, stopSeq: 1, stopId: "20006944" },
    { key: "bus680", destinationEn: "ADMIRALTY STATION (EAST)", stopNameEn: "ALVA HOTEL BY ROYAL (ST534)", operator: "九巴＋城巴", route: "680", destination: "金鐘站（東）", stopName: "帝逸酒店（ST534）", api: "joint", kmbStopId: "2223D64E9ED2E1A7", kmbDirection: "O", kmbServiceType: "1", ctbStopId: "003082", ctbDirection: "I" },
    { key: "ctb30x", destinationEn: "Admiralty (East)", stopNameEn: "Cyberport 3, Cyberport Road", operator: "城巴", route: "30X", destination: "金鐘（東）", stopName: "數碼港三座，數碼港道", api: "ctb", stopId: "002393", direction: "O" }
  ],

  NEWS: {
    // 公開新聞列表經 Jina Reader 轉讀；不傳送 Gmail 權杖或私人資料。
    LOCAL: ["https://news.rthk.hk/rthk/ch/latest-news/local.htm"],
    WORLD: ["https://news.rthk.hk/rthk/ch/latest-news/world-news.htm", "https://news.rthk.hk/rthk/ch/latest-news/finance.htm"],
    EN_LOCAL: ["https://rthk.hk/rthk/news/rss/e_expressnews_elocal.xml"],
    EN_WORLD: ["https://rthk.hk/rthk/news/rss/e_expressnews_einternational.xml", "https://rthk.hk/rthk/news/rss/e_expressnews_efinance.xml"]
  }
};
