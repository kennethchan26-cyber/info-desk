"use strict";

const CFG = window.DASHBOARD_CONFIG;
const $ = s => document.querySelector(s);
const HK_TZ = "Asia/Hong_Kong";
const IS_EXTENSION = location.protocol === "chrome-extension:" && Boolean(globalThis.chrome?.runtime?.id);
const state = {
  suppressAlerts: false,
  warningText: "暫無天氣警告", headlines: [], indices: {},
  alertQueue: [], alertShowing: false, alertTimer: null,
  gmailToken: null, gmailExpiry: 0, gmailTimer: null
};

const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const hkTime = value => new Intl.DateTimeFormat("zh-HK", {timeZone:HK_TZ,hour:"2-digit",minute:"2-digit",hour12:false}).format(value ? new Date(value) : new Date());
const hkDateTime = value => new Intl.DateTimeFormat("en-GB", {timeZone:HK_TZ,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
// Each page establishes its own first-success baseline; reloads never announce old mail/news.
const baselines = new Map();

function tickClock(){
  const now = new Date();
  $("#clock").textContent = new Intl.DateTimeFormat("zh-HK",{timeZone:HK_TZ,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);
  $("#date").textContent = new Intl.DateTimeFormat("en-GB",{timeZone:HK_TZ,day:"2-digit",month:"2-digit",year:"numeric"}).format(now);
}
function setStamp(id){$(id).textContent=`${hkTime()} 更新`;$("#lastUpdate").textContent=`最後更新：${hkTime()} HKT`;}
async function getJSON(url, timeout=18000, options={}){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{cache:"no-store",signal:ctl.signal,...options});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(timer)}}
const readerQueue=[];let readerActive=0;
function drainReader(){
  while(readerActive<3&&readerQueue.length){const task=readerQueue.shift();readerActive++;task().finally(()=>{readerActive--;drainReader()})}
}
function fetchJinaText(url,timeout=18000,headers={}){
  return new Promise((resolve,reject)=>{readerQueue.push(async()=>{const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",headers,signal:ctl.signal});if(!r.ok)throw new Error(`公開資料轉讀 HTTP ${r.status}`);resolve(await r.text())}catch(e){reject(e)}finally{clearTimeout(timer)}});drainReader()});
}

function previous(key){return baselines.has(key)?baselines.get(key):null;}
function remember(key,value){baselines.set(key,String(value));}
function changed(key,value){const old=previous(key);remember(key,value);return old!==null&&old!==String(value);}

function beep(){
  if($("#muteToggle").checked)return;
  try{const C=window.AudioContext||window.webkitAudioContext;const ctx=new C();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.frequency.value=880;gain.gain.setValueAtTime(.09,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);osc.connect(gain).connect(ctx.destination);osc.onended=()=>ctx.close();osc.start();osc.stop(ctx.currentTime+.18)}catch{}
}
async function desktopNotify(title,message){
  if(!$("#notifyToggle").checked)return;
  try{
    if(IS_EXTENSION){chrome.notifications.create({type:"basic",iconUrl:chrome.runtime.getURL("icon.svg"),title,message});}
    else if("Notification" in window&&Notification.permission==="granted")new Notification(title,{body:message,icon:"apple-touch-icon.png"});
  }catch{}
}
function enqueueAlert(type,text,priority=5){
  if(state.suppressAlerts)return;
  state.alertQueue.push({type,text,priority});state.alertQueue.sort((a,b)=>a.priority-b.priority);showNextAlert();
}
function showNextAlert(){
  if(state.alertShowing||!state.alertQueue.length)return;
  const item=state.alertQueue.shift();state.alertShowing=true;$("#breakingType").textContent=item.type;$("#breakingText").textContent=item.text;$("#breaking").hidden=false;beep();desktopNotify(item.type,item.text);state.alertTimer=setTimeout(closeAlert,10000);
}
function closeAlert(){clearTimeout(state.alertTimer);$("#breaking").hidden=true;state.alertShowing=false;setTimeout(showNextAlert,180)}
function testAlerts(){enqueueAlert("測試提示","這是測試：橫額會在 10 秒後收起，亦可按 × 關閉。",1);enqueueAlert("測試提示","第二條測試：佇列依次顯示，沒有重疊。",5)}
function transitAlert(route,next){
  const key=`transit_${route.key}`,old=previous(key);remember(key,next?JSON.stringify(next):"none");
  if(old===null||!next||next.mins>3||next.mins<=0)return;
  let before;try{before=JSON.parse(old)}catch{}
  if(!before||before.mins>3||(before.iso!==next.iso&&Math.abs(new Date(before.iso)-new Date(next.iso))>240000))enqueueAlert("即將到站",`${route.route} 往${route.destination}：下一班約 ${next.mins} 分鐘`,3);
}

function updateTicker(){
  if(window.InfoDeskView){window.InfoDeskView.updateTicker();return;}
  const hsi=state.indices.HSI?`恒指 ${state.indices.HSI.price} ${state.indices.HSI.change}`:"恒指 —";
  const dji=state.indices.DJI?`道指 ${state.indices.DJI.price} ${state.indices.DJI.change}`:"道指 —";
  const parts=[hsi,dji,`天氣：${state.warningText}`,...state.headlines.slice(0,8)];
  $("#tickerTrack").innerHTML=parts.map((x,i)=>`<span class="${i===2?"alert":""}">${esc(x)}</span>`).join("");
}

async function loadWeather(){
  const base="https://data.weather.gov.hk/weatherAPI/opendata/weather.php?lang=tc&dataType=";
  try{
    const [now,local,nine,warnings]=await Promise.all([getJSON(base+"rhrread"),getJSON(base+"flw"),getJSON(base+"fnd"),getJSON(base+"warnsum")]);
    const temp=name=>now.temperature?.data?.find(x=>x.place===name)?.value??"—";const rh=now.humidity?.data?.[0]?.value??"—";
    const active=Object.values(warnings||{}).filter(x=>x&&x.actionCode!=="CANCEL");const names=active.map(x=>x.name||x.code).filter(Boolean);
    state.warningText=names.length?names.join("、"):(now.warningMessage?.join("、")||"暫無天氣警告");
    if(changed("weather_warning",state.warningText))enqueueAlert("天氣警告",`警告更新：${state.warningText}`,1);
    const days=(nine.weatherForecast||[]).slice(0,3).map(d=>`<div class="day"><div class="day-date">${esc(String(d.forecastDate).slice(6,8)+"/"+String(d.forecastDate).slice(4,6))}</div><div class="day-temp">${esc(d.forecastMintemp?.value)}–${esc(d.forecastMaxtemp?.value)}°</div><div class="day-desc">${esc(d.forecastWeather)}</div><div class="day-rh">濕度 ${esc(d.forecastMinrh?.value)}–${esc(d.forecastMaxrh?.value)}%</div></div>`).join("");
    $("#weather").innerHTML=`<div class="weather-now"><div class="location"><div class="location-name">沙田氣象站</div><div class="temp">${esc(temp("沙田"))}°</div><div class="humidity">濕度 ${esc(rh)}% <small>（香港天文台站）</small></div></div><div class="location"><div class="location-name">數碼港附近：黃竹坑站</div><div class="temp">${esc(temp("黃竹坑"))}°</div><div class="humidity">濕度 ${esc(rh)}% <small>（香港天文台站）</small></div></div></div><div class="warning-box ${names.length||now.warningMessage?.length?"":"none"}">${esc(state.warningText)}</div><div class="summary"><b>今日概況：</b>${esc(local.forecastDesc||local.generalSituation||"暫未提供")}</div><div class="forecast">${days}</div><div class="fx-note">天文台即時 API 只提供香港天文台站相對濕度；兩地均如實標示該站數值。</div>`;
    updateTicker();setStamp("#weatherUpdated");
  }catch{$("#weather").innerHTML='<div class="error">暫時未能取得數據</div>'}
}

const minutesUntil=iso=>Math.max(0,Math.round((new Date(iso)-Date.now())/60000));
const normEta=(iso,operator,remark="")=>iso?{mins:minutesUntil(iso),operator,remark,time:hkTime(iso),iso}:null;
async function fetchTransit(item){
  if(item.api==="gmb"){const j=await getJSON(`https://data.etagmb.gov.hk/eta/route-stop/${item.routeId}/${item.routeSeq}/${item.stopSeq}`);return(j.data?.eta||[]).map(x=>({mins:Math.max(0,Number(x.diff)),operator:"小巴",remark:x.remarks_tc||"",time:hkTime(x.timestamp),iso:x.timestamp}))}
  if(item.api==="ctb"){const j=await getJSON(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${item.stopId}/${item.route}`);return(j.data||[]).filter(x=>!item.direction||x.dir===item.direction).map(x=>normEta(x.eta,"城巴",x.rmk_tc)).filter(Boolean)}
  const [k,c]=await Promise.allSettled([getJSON(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${item.kmbStopId}/${item.route}/${item.kmbServiceType}`),getJSON(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${item.ctbStopId}/${item.route}`)]);let all=[];
  if(k.status==="fulfilled")all.push(...(k.value.data||[]).filter(x=>x.dir===item.kmbDirection).map(x=>normEta(x.eta,"九巴",x.rmk_tc)).filter(Boolean));
  if(c.status==="fulfilled")all.push(...(c.value.data||[]).filter(x=>x.dir===item.ctbDirection).map(x=>normEta(x.eta,"城巴",x.rmk_tc)).filter(Boolean));
  if(k.status==="rejected"&&c.status==="rejected")throw new Error("both failed");return all.sort((a,b)=>a.mins-b.mins).slice(0,3);
}
const etaHTML=e=>`<span class="eta ${e.mins<=3?"soon":""}">${e.mins<=0?"即到":e.mins+" 分"}<small>${esc(e.operator)} · ${esc(e.time)}</small></span>`;
async function loadTransit(){
  const results=await Promise.allSettled(CFG.TRANSIT.map(fetchTransit));
  $("#transit").innerHTML=`<div class="transit-list">${CFG.TRANSIT.map((r,i)=>{const x=results[i];let body='<span class="route-error">暫時未能取得數據</span>';if(x.status==="fulfilled"){body=x.value.length?x.value.slice(0,3).map(etaHTML).join(""):'<span class="route-error">暫無班次資料</span>';transitAlert(r,x.value[0])}return`<div class="route-card"><div class="route-identity"><div class="route-no">${esc(r.route)}</div><div class="operator">${esc(r.operator)}</div></div><div class="route-meta"><div class="route-dest">往 ${esc(r.destination)}</div><div class="route-stop">${esc(r.stopName)}</div></div><div class="etas">${body}</div></div>`}).join("")}</div>`;
  window.InfoDeskView?.transit(results);
  if(results.some(x=>x.status==="fulfilled"))setStamp("#transitUpdated");
}

async function loadFx(){
  try{let j;try{j=await getJSON("https://api.frankfurter.app/latest?from=HKD&to=USD,CNY,JPY,GBP,EUR,AUD,CAD,SGD")}catch{j=await getJSON("https://api.frankfurter.dev/v1/latest?base=HKD&symbols=USD,CNY,JPY,GBP,EUR,AUD,CAD,SGD")}const names={USD:"美元",CNY:"人民幣",JPY:"日圓",GBP:"英鎊",EUR:"歐元",AUD:"澳元",CAD:"加元",SGD:"新加坡元"};$("#fx").innerHTML=`<div class="fx-grid">${Object.entries(names).map(([code,name])=>`<div class="fx"><div class="fx-code">1 HKD → ${esc(name)} ${code}</div><div class="fx-rate">${j.rates?.[code]!=null?Number(j.rates[code]).toFixed(code==="JPY"?3:4):"—"}</div></div>`).join("")}</div><div class="fx-note">參考日期：${esc(j.date?j.date.split("-").reverse().join("/"):"—")}；屬每日參考匯率，並非銀行即時兌換價。</div>`;setStamp("#fxUpdated")}catch{$("#fx").innerHTML='<div class="error">暫時未能取得數據</div>'}
}

function parseJinaJSON(text){const marker="Markdown Content:";const raw=text.includes(marker)?text.slice(text.indexOf(marker)+marker.length):text;const start=raw.indexOf("{"),end=raw.lastIndexOf("}");if(start<0||end<start)throw new Error("invalid market response");return JSON.parse(raw.slice(start,end+1).replace(/\r?\n\s*/g,""))}
function quoteFromMeta(item,meta){if(!meta)throw new Error("no quote");const price=Number(meta.regularMarketPrice);if(!Number.isFinite(price)||price<=0)throw new Error("invalid price");let pct=meta.regularMarketChangePercent==null?NaN:Number(meta.regularMarketChangePercent);if(!Number.isFinite(pct)){const prev=Number(meta.chartPreviousClose||meta.previousClose);if(!prev)throw new Error("no quote");pct=(price-prev)/prev*100}return{...item,price,pct,time:meta.regularMarketTime?new Date(meta.regularMarketTime*1000):null}}
async function fetchQuoteBatch(items){
  const unique=[...new Set(items.map(x=>x.yahoo))],size=Math.max(1,Math.min(20,Number(CFG.MARKET_BATCH_SIZE)||20)),chunks=[];
  for(let i=0;i<unique.length;i+=size)chunks.push(unique.slice(i,i+size));
  const map=new Map();
  await Promise.all(chunks.map(async symbols=>{
    try{
      const query="symbols="+encodeURIComponent(symbols.join(","))+"&range=1d&interval=1d";
      const target="https://query1.finance.yahoo.com/v7/finance/spark?"+query;
      const data=IS_EXTENSION?await getJSON(target):parseJinaJSON(await fetchJinaText("https://r.jina.ai/http://query1.finance.yahoo.com/v7/finance/spark?"+query.replaceAll("&","%26")));
      if(data.spark?.error)throw new Error(data.spark.error.description||"no quote");
      const rows=new Map((data.spark?.result||[]).map(r=>[r.symbol,r.response?.[0]?.meta]));
      for(const symbol of symbols){try{const q=quoteFromMeta({yahoo:symbol},rows.get(symbol));map.set(symbol,{status:"fulfilled",value:q})}catch(reason){map.set(symbol,{status:"rejected",reason})}}
    }catch(reason){for(const symbol of symbols)map.set(symbol,{status:"rejected",reason})}
  }));
  return map;
}
function quoteHTML(q){const cls=q.pct>0?"up":q.pct<0?"down":"flat";const sign=q.pct>0?"+":"";return`<div class="quote" data-delta="${q.pct!==-100?q.price*q.pct/(100+q.pct):0}"><div><div class="quote-name">${esc(q.name)}</div><div class="quote-price">${q.price.toLocaleString("en-HK",{maximumFractionDigits:2})}</div></div><div class="quote-change ${cls}">${sign}${q.pct.toFixed(2)}%</div><div class="quote-time">${q.time?hkDateTime(q.time):"來源未提供時間"} HKT · Yahoo Finance${IS_EXTENSION?"":"／Jina 快照"}</div></div>`}
function publicDataError(error){if(error?.name==="AbortError")return "連線逾時，下次更新重試";const message=String(error?.message||"");if(message.includes("429"))return "公開服務限流，下次更新重試";if(/invalid market response|no quote|invalid price/.test(message))return "來源回應沒有有效報價";return "公開來源暫時無法讀取，下次更新重試"}
async function loadMarket(items,target,stamp,batch=null){
  batch=batch||await fetchQuoteBatch(items);const settled=items.map(item=>{const x=batch.get(item.yahoo);return x?.status==="fulfilled"?{status:"fulfilled",value:{...item,...x.value}}:{status:"rejected",reason:x?.reason||new Error("no quote")}});const good=settled.filter(x=>x.status==="fulfilled").map(x=>x.value);$(target).innerHTML=settled.map((x,i)=>x.status==="fulfilled"?quoteHTML(x.value):`<div class="quote"><div class="quote-name">${esc(items[i].name)}</div><div class="quote-error">暫時未能取得數據</div><div class="quote-time">${esc(publicDataError(x.reason))}</div></div>`).join("");
  for(const q of good){if(q.alertIndex){state.indices[q.alertIndex]={price:q.price.toLocaleString("en-HK",{maximumFractionDigits:2}),change:`${q.pct>0?"+":""}${q.pct.toFixed(2)}%`};const over=Math.abs(q.pct)>2?`${q.pct>0?"up":"down"}:${q.pct.toFixed(1)}`:"normal";const key=`market_${q.alertIndex}`;const old=previous(key);remember(key,over);if(old!==null&&over!=="normal"&&!old.startsWith(over.split(":")[0]))enqueueAlert("市場異動",`${q.name} 單日${q.pct>0?"上升":"下跌"} ${Math.abs(q.pct).toFixed(2)}%`,4)}}
  updateTicker();if(good.length)setStamp(stamp);
}
async function loadMarkets(){const batch=await fetchQuoteBatch([...CFG.HK_MARKET,...CFG.US_MARKET]);await Promise.allSettled([loadMarket(CFG.HK_MARKET,"#hkMarket","#hkMarketUpdated",batch),loadMarket(CFG.US_MARKET,"#usMarket","#usMarketUpdated",batch)])}

function parseReaderMarkdown(text){
  const matches=[...text.matchAll(/\[([^\]\n]{5,180})\]\((https?:\/\/[^\s)]+)\)/g)], rows=[],seen=new Set();
  for(let i=0;i<matches.length;i++){
    const m=matches[i],title=m[1].trim();let url;try{url=new URL(m[2].replace(/&amp;/g,"&"))}catch{continue}
    if(url.hostname!=="news.rthk.hk"||!url.pathname.startsWith("/rthk/ch/component/k2/")||/^(Image|https?:)/i.test(title))continue;
    url.protocol="https:";url.search="";url.hash="";const link=url.href;if(seen.has(link))continue;
    const after=text.slice(m.index+m[0].length,m.index+m[0].length+1500).split(/\n#{2,6}\s/)[0];
    const date=after.match(/(\d{4}-\d{2}-\d{2}) HKT (\d{2}:\d{2})/);
    if(!date)continue;const published=Date.parse(`${date[1]}T${date[2]}:00+08:00`);if(!Number.isFinite(published))continue;
    seen.add(link);rows.push({title,link,published});
  }
  return rows.sort((a,b)=>b.published-a.published);
}
async function loadOneNews(feeds,target,stamp,key){
  try{
    const results=await Promise.allSettled(feeds.map(async feed=>{const rows=parseReaderMarkdown(await fetchJinaText("https://r.jina.ai/"+feed));if(!rows.length)throw new Error("empty");return rows}));
    const all=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
    const items=[...new Map(all.map(x=>[x.link,x])).values()].sort((a,b)=>b.published-a.published).slice(0,10);
    if(!items.length)throw new Error("empty");
    const partial=results.some(x=>x.status==="rejected");
    $(target).innerHTML=`${partial?'<div class="route-error">部分新聞來源暫時未能取得數據</div>':""}<div class="news-list">${items.map(x=>`<a class="news-item" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer"><span class="news-title">${esc(x.title)}</span><span class="news-time">${hkDateTime(x.published)}</span></a>`).join("")}</div>`;
    const ids=items.map(x=>x.link).join("||"),old=previous(`news_${key}`);remember(`news_${key}`,ids);
    if(old!==null){const oldSet=new Set(old.split("||"));items.filter(x=>!oldSet.has(x.link)).slice(0,3).forEach(x=>enqueueAlert("最新新聞",x.title,5))}
    state.headlines.push(...items.slice(0,4).map(x=>x.title));updateTicker();setStamp(stamp);
  }catch{$(target).innerHTML='<div class="error">暫時未能取得數據</div>'}
}
async function loadNews(){state.headlines=[];await Promise.allSettled([loadOneNews(CFG.NEWS.LOCAL,"#localNews","#localNewsUpdated","local"),loadOneNews(CFG.NEWS.WORLD,"#worldNews","#worldNewsUpdated","world")])}

function startGmailPolling(){clearInterval(state.gmailTimer);state.gmailTimer=setInterval(loadGmail,300000)}
function saveToken(token,expiresIn=3600){if(typeof token!=="string"||!token||!Number.isFinite(Number(expiresIn))||Number(expiresIn)<=60)throw new Error("授權回傳無效，請重新連接");state.gmailToken=token;state.gmailExpiry=Date.now()+(Number(expiresIn)-60)*1000;localStorage.setItem("dashboard_gmail_token",token);localStorage.setItem("dashboard_gmail_expiry",String(state.gmailExpiry));$("#gmailDisconnect").hidden=false;startGmailPolling()}
function restoreToken(){const token=localStorage.getItem("dashboard_gmail_token");const expiry=Number(localStorage.getItem("dashboard_gmail_expiry"));if(token&&expiry>Date.now()){state.gmailToken=token;state.gmailExpiry=expiry;$("#gmailDisconnect").hidden=false;return true}return false}
function setGmailHint(text,isError=false){$("#gmailHint").innerHTML=text;$("#gmailHint").style.color=isError?"#ff8793":""}
let gmailWebClient=null,gmailWebPreparing=null;
function prepareGmailWeb(){
  if(gmailWebClient)return Promise.resolve();if(gmailWebPreparing)return gmailWebPreparing;
  gmailWebPreparing=(async()=>{
    const id=CFG.GMAIL.WEB_CLIENT_ID;if(!id||id.startsWith("填入_"))throw new Error("請先設定網頁版 Client ID。");
    if(!globalThis.google?.accounts?.oauth2)await new Promise((resolve,reject)=>{
      const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;
      const timer=setTimeout(()=>{script.remove();reject(new Error("Google 登入元件載入逾時，請重試。"))},15000);
      script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error("Google 登入元件載入失敗。"))};document.head.appendChild(script);
    });
    gmailWebClient=google.accounts.oauth2.initTokenClient({client_id:id,scope:CFG.GMAIL.SCOPE,include_granted_scopes:false,
      callback:async r=>{try{if(r.error)throw new Error(r.error);if(!google.accounts.oauth2.hasGrantedAllScopes(r,CFG.GMAIL.SCOPE))throw new Error("尚未授予 Gmail 唯讀權限");saveToken(r.access_token,r.expires_in);await loadGmail()}catch(e){setGmailHint(esc(e.message),true)}finally{$("#gmailAuth").disabled=false}},
      error_callback:e=>{$("#gmailAuth").disabled=false;setGmailHint(e.type==="popup_closed"?"登入視窗已關閉；可再按連接。":"登入視窗未能開啟。請在 Safari 開啟此網址，再按連接 Gmail。",true)}
    });
  })().finally(()=>{gmailWebPreparing=null});return gmailWebPreparing;
}
function connectGmailWeb(){
  // Open synchronously within the tap handler: Safari otherwise blocks the popup.
  if(!gmailWebClient){setGmailHint("準備 Google 登入元件…");prepareGmailWeb().then(()=>setGmailHint("已準備好，請再按「連接 Gmail（唯讀）」。")).catch(e=>setGmailHint(esc(e.message),true));return}
  $("#gmailAuth").disabled=true;
  try{gmailWebClient.requestAccessToken({prompt:"consent"})}catch(e){$("#gmailAuth").disabled=false;setGmailHint(esc(e.message),true)}
}
async function connectGmailExtension(){
  const id=CFG.GMAIL.EXTENSION_CLIENT_ID;if(!id||id.startsWith("填入_")){setGmailHint("請先在 config.js 填入擴充功能 Client ID。",true);return}
  const redirect=chrome.identity.getRedirectURL("oauth2");
  const nonce=crypto.randomUUID();
  const url="https://accounts.google.com/o/oauth2/v2/auth?"+new URLSearchParams({client_id:id,response_type:"token",redirect_uri:redirect,scope:CFG.GMAIL.SCOPE,prompt:"consent",include_granted_scopes:"false",state:nonce});
  $("#gmailAuth").disabled=true;
  try{
    const result=await chrome.identity.launchWebAuthFlow({url,interactive:true});
    if(!result)throw new Error("沒有收到授權結果");
    const response=new URL(result), expected=new URL(redirect);
    const p=new URLSearchParams(response.hash.slice(1));
    if(response.origin!==expected.origin||response.pathname!==expected.pathname||p.get("state")!==nonce)throw new Error("登入回傳驗證失敗，請重新連接");
    if(p.get("error"))throw new Error(p.get("error"));
    const scopes=(p.get("scope")||"").split(/\s+/);
    if(!scopes.includes(CFG.GMAIL.SCOPE))throw new Error("尚未授予 Gmail 唯讀權限");
    saveToken(p.get("access_token"),p.get("expires_in"));await loadGmail();
  }catch(e){setGmailHint(`連接失敗：${esc(e.message)}`,true)}finally{$("#gmailAuth").disabled=false}
}
async function gmailFetch(path){const r=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{headers:{Authorization:`Bearer ${state.gmailToken}`}});if(r.status===401){disconnectGmail(false);throw new Error("登入已逾時，請重新連接 Gmail")}if(!r.ok)throw new Error(`Gmail API ${r.status}`);return r.json()}
async function loadGmail(){
  if(!state.gmailToken)return;
  if(state.gmailExpiry<=Date.now()){await disconnectGmail(false);setGmailHint("登入已逾時，請按「連接 Gmail」重新授權。",true);return}
  try{const list=await gmailFetch("messages?q=is%3Aunread&maxResults=10");const msgs=await Promise.all((list.messages||[]).map(x=>gmailFetch(`messages/${x.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));const rows=msgs.map(m=>{const h=Object.fromEntries((m.payload?.headers||[]).map(x=>[x.name.toLowerCase(),x.value]));return{id:m.id,sender:h.from||"（未知寄件人）",subject:h.subject||"（沒有主旨）",date:h.date||Number(m.internalDate),thread:m.threadId}}).sort((a,b)=>new Date(b.date)-new Date(a.date));$("#gmail").innerHTML=rows.length?`<div class="mail-list">${rows.map(m=>`<a class="mail" href="https://mail.google.com/mail/u/0/#inbox/${esc(m.thread)}" target="_blank" rel="noopener"><span class="sender">${esc(m.sender)}</span><span class="subject">${esc(m.subject)}</span><span class="mail-time">${esc(hkDateTime(m.date))}</span></a>`).join("")}</div>`:'<div class="empty">目前沒有未讀郵件</div>';const ids=rows.map(x=>x.id).join(",");const old=previous("gmail_ids");remember("gmail_ids",ids);if(old!==null){const oldSet=new Set(old.split(","));rows.filter(x=>!oldSet.has(x.id)).slice(0,3).forEach(x=>enqueueAlert("新 Gmail",`${x.sender}：${x.subject}`,2))}setGmailHint("已連接；權杖只儲存在你的瀏覽器，可隨時中斷。");setStamp("#gmailUpdated")}catch(e){$("#gmail").innerHTML='<div class="error">暫時未能取得數據</div>';setGmailHint(esc(e.message),true)}
}
async function disconnectGmail(revoke=true){if(revoke&&state.gmailToken)fetch("https://oauth2.googleapis.com/revoke?token="+encodeURIComponent(state.gmailToken),{method:"POST"}).catch(()=>{});state.gmailToken=null;state.gmailExpiry=0;localStorage.removeItem("dashboard_gmail_token");localStorage.removeItem("dashboard_gmail_expiry");clearInterval(state.gmailTimer);$("#gmailDisconnect").hidden=true;$("#gmail").innerHTML='<div class="empty">尚未連接 Gmail</div>';setGmailHint("已中斷連接；本頁已移除 Gmail 存取權杖。")}

function handleWhatsAppStatus(count){count=Number(count)||0;$("#waUnread").textContent=count;const old=previous("whatsapp_unread");remember("whatsapp_unread",count);if(old!==null&&count>Number(old))enqueueAlert("WhatsApp",`未讀訊息增加至 ${count} 則`,2)}
function setupWhatsApp(){
  if(IS_EXTENSION){$("#waMode").textContent="擴充功能｜只讀分頁標題";$("#waNote").textContent="只檢查 web.whatsapp.com 分頁標題中的數字，不讀取訊息內容。";chrome.runtime.onMessage.addListener(m=>{if(m?.type==="WHATSAPP_STATUS")handleWhatsAppStatus(m.unread)});chrome.runtime.sendMessage({type:"GET_WHATSAPP_STATUS"}).then(r=>handleWhatsAppStatus(r?.unread)).catch(()=>{});$("#waOpen").onclick=()=>chrome.runtime.sendMessage({type:"OPEN_WHATSAPP"})}
  else{$("#waUnread").textContent="—";$("#waOpen").onclick=()=>{const mobile=/iPhone|iPad|Android/i.test(navigator.userAgent);window.open(mobile?"whatsapp://":"https://web.whatsapp.com","_blank","noopener")}}
}

async function init(){
  tickClock();setInterval(tickClock,1000);$("#breakingClose").onclick=closeAlert;$("#testAlert").onclick=testAlerts;
  $("#muteToggle").checked=localStorage.getItem("dashboard_muted")==="1";$("#muteToggle").onchange=e=>localStorage.setItem("dashboard_muted",e.target.checked?"1":"0");
  const desktopSupported=IS_EXTENSION||("Notification" in window&&!/iPhone|iPad|iPod/i.test(navigator.userAgent));
  $("#notifyToggle").disabled=!desktopSupported;$("#notifyToggle").title=desktopSupported?"只在看板仍開啟時提供通知":"手機版提供頁內提示；關閉或切到背景後不保證更新。";
  $("#notifyToggle").checked=desktopSupported&&localStorage.getItem("dashboard_notify")==="1";$("#notifyToggle").onchange=async e=>{try{if(e.target.checked&&!IS_EXTENSION){const p=await Notification.requestPermission();if(p!=="granted")e.target.checked=false}}catch{e.target.checked=false}localStorage.setItem("dashboard_notify",e.target.checked?"1":"0")};
  $("#gmailAuth").onclick=IS_EXTENSION?connectGmailExtension:connectGmailWeb;$("#gmailDisconnect").onclick=()=>disconnectGmail(true);setupWhatsApp();
  const runtime=IS_EXTENSION?`擴充功能模式｜ID：<code>${esc(chrome.runtime.id)}</code><br>Gmail Redirect URI：<code>${esc(chrome.identity.getRedirectURL("oauth2"))}</code>`:`GitHub Pages／網頁模式｜目前網址：<code>${esc(location.origin)}</code>`;$("#runtimeInfo").innerHTML=runtime;
  if(restoreToken()){loadGmail();startGmailPolling()}
  if(!IS_EXTENSION)prepareGmailWeb().catch(e=>setGmailHint(esc(e.message),true));
  const jobs=[[loadTransit,30000],[loadWeather,60000],[loadFx,60000],[loadNews,60000],[loadMarkets,60000]];
  for(const [load,interval]of jobs){let busy=false;const run=async()=>{if(busy)return;busy=true;try{await load()}finally{busy=false}};run();setInterval(run,interval)}
}

document.addEventListener("DOMContentLoaded",init);
