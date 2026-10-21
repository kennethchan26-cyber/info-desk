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
    { yahoo: "TSLA", tv: "NASDAQ:TSLA", name: "TSLA" }
  ],

  /* 已按官方路線及站點列表核實（2026-10-21）。
     680 城巴把九巴 ST534 同一位置命名為「歷奇單車場, 小瀝源路」。 */
  TRANSIT: [
    { key: "gmb804", operator: "專線小巴", route: "804", destination: "廣源", stopName: "車公廟路，大圍站公共運輸交匯處外", api: "gmb", routeId: 2010275, routeSeq: 2, stopSeq: 5, stopId: "20001582" },
    { key: "gmb65k", operator: "專線小巴", route: "65K", destination: "火炭站（循環線）", stopName: "坳背灣街近金豪工業大廈第二座", api: "gmb", routeId: 2009081, routeSeq: 1, stopSeq: 6, stopId: "20001505" },
    { key: "gmb69x", operator: "專線小巴", route: "69X", destination: "數碼港", stopName: "駱克道近景隆街", api: "gmb", routeId: 2000511, routeSeq: 2, stopSeq: 1, stopId: "20006944" },
    { key: "bus680", operator: "九巴＋城巴", route: "680", destination: "金鐘站（東）", stopName: "帝逸酒店（ST534）", api: "joint", kmbStopId: "2223D64E9ED2E1A7", kmbDirection: "O", kmbServiceType: "1", ctbStopId: "003082", ctbDirection: "I" },
    { key: "ctb30x", operator: "城巴", route: "30X", destination: "金鐘（東）", stopName: "數碼港三座，數碼港道", api: "ctb", stopId: "002393", direction: "O" }
  ],

  NEWS: {
    // 公開新聞列表經 Jina Reader 轉讀；不傳送 Gmail 權杖或私人資料。
    LOCAL: ["https://news.rthk.hk/rthk/ch/latest-news/local.htm"],
    WORLD: ["https://news.rthk.hk/rthk/ch/latest-news/world-news.htm", "https://news.rthk.hk/rthk/ch/latest-news/finance.htm"]
  }
};
