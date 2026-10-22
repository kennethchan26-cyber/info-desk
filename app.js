"use strict";

const CFG = window.DASHBOARD_CONFIG;
const UI = window.InfoDeskI18n;
const T = value => UI?.t(value) ?? value;
const L = (tc,en) => UI?.en() ? en : tc;
const lang = () => UI?.language || 'tc';
const $ = s => document.querySelector(s);
const HK_TZ = "Asia/Hong_Kong";
const IS_EXTENSION = location.protocol === "chrome-extension:" && Boolean(globalThis.chrome?.runtime?.id);
const state = {
  suppressAlerts: false,
  warningText: "暫無天氣警告", headlines: [], indices: {},
  alertQueue: [], alertShowing: false, alertTimer: null,
  gmailToken: null, gmailExpiry: 0, gmailTimer: null, gmailOpen:false, gmailGeneration:0, gmailAbort:null, gmailBusy:false,
  transitOrder:[], transitSorted:true,
  weatherCache:{}, weatherPending:{}, newsCache:{}, newsPending:{}, transitResults:null, marketBatch:null, fxRows:null, stamps:{}
};

const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const hkTime = value => new Intl.DateTimeFormat("zh-HK", {timeZone:HK_TZ,hour:"2-digit",minute:"2-digit",hour12:false}).format(value ? new Date(value) : new Date());
const hkDateTime = value => UI?.date ? UI.date(value,true) : new Intl.DateTimeFormat("en-GB", {timeZone:HK_TZ,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));
// Each page establishes its own first-success baseline; reloads never announce old mail/news.
const baselines = new Map();

function tickClock(){
  const now = new Date();
  $("#clock").textContent = new Intl.DateTimeFormat("zh-HK",{timeZone:HK_TZ,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);
  $("#date").textContent = UI?.date ? UI.date(now) : new Intl.DateTimeFormat("en-GB",{timeZone:HK_TZ,day:"2-digit",month:"2-digit",year:"numeric"}).format(now);
  if($('#cornerClock'))$('#cornerClock').textContent=hkTime(now);
  if($('#cornerDate'))$('#cornerDate').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:HK_TZ,day:'2-digit',month:'2-digit'}).format(now)+' HKT';
}
const stampGroup=id=>/Market/.test(id)?'markets':id.replace(/^#|Updated$/g,'');
function setStamp(id){state.stamps[id]=id==='#gmailUpdated'?Date.now():(window.InfoDeskNetwork?.stamp(stampGroup(id))||Date.now());state.lastSuccess=Math.max(...Object.values(state.stamps));renderStamps();}
function renderStamps(){for(const [id,time]of Object.entries(state.stamps))$(id).textContent=T(`${hkTime(time)} 更新`)+(window.InfoDeskNetwork?.stale(stampGroup(id))?' · '+T('快取'):'');$("#lastUpdate").textContent=T(state.lastSuccess?`最後更新：${hkTime(state.lastSuccess)} HKT`:'最後更新：等待資料');}
async function getJSON(url, timeout=18000, options={}){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await (window.InfoDeskNetwork?.fetch||fetch)(url,{cache:"no-store",signal:ctl.signal,...options});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(timer)}}
const readerQueue=[];let readerActive=0;
function drainReader(){
  while(readerActive<3&&readerQueue.length){const task=readerQueue.shift();readerActive++;task().finally(()=>{readerActive--;drainReader()})}
}
function fetchJinaText(url,timeout=18000,headers={}){
  return new Promise((resolve,reject)=>{readerQueue.push(async()=>{const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await (window.InfoDeskNetwork?.fetch||fetch)(url,{cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",headers,signal:ctl.signal});if(!r.ok)throw new Error(`公開資料轉讀 HTTP ${r.status}`);resolve(await r.text())}catch(e){reject(e)}finally{clearTimeout(timer)}});drainReader()});
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
  if(state.suppressAlerts||navigator.onLine===false||(type==='新 Gmail'&&!state.gmailOpen))return;
  const level=type==='天氣警告'?'breaking':type==='巴士預告'?'preview':'latest';
  const rank={breaking:0,latest:1,preview:2};
  state.alertQueue.push({kind:type,type:type==='巴士預告'?L('巴士預告','BUS ADVANCE'):T(type),text:T(text),priority,level});
  // Weather > latest > advance. Resume displaced banners without duplicate sound.
  if(state.alertShowing&&rank[level]<rank[state.alertCurrent?.level]){
    clearTimeout(state.alertTimer);state.alertQueue.push(state.alertCurrent);state.alertShowing=false;$('#breaking').hidden=true;
  }
  state.alertQueue.sort((a,b)=>rank[a.level]-rank[b.level]||a.priority-b.priority);showNextAlert();
}
function showNextAlert(){
  if(state.alertShowing||!state.alertQueue.length)return;
  const item=state.alertQueue.shift();if(item.kind==='新 Gmail'&&!state.gmailOpen){showNextAlert();return}state.alertKind=item.kind;state.alertCurrent=item;state.alertShowing=true;
  const banner=$('#breaking');banner.dataset.level=item.level;banner.setAttribute('aria-live',item.level==='breaking'?'assertive':'polite');banner.querySelector('.breaking-badge').textContent=item.level==='breaking'?L('突發','BREAKING'):item.level==='preview'?L('預告','UPCOMING'):L('最新','LATEST');
  $("#breakingType").textContent=item.type;$("#breakingText").textContent=item.text;banner.hidden=false;
  banner.getAnimations?.().forEach(a=>a.cancel());banner.animate?.([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:300,easing:'ease-out'});
  if(!item.notified){beep();desktopNotify(item.type,item.text);item.notified=true}state.alertTimer=setTimeout(closeAlert,10000);
}
function closeAlert(){clearTimeout(state.alertTimer);$("#breaking").hidden=true;state.alertShowing=false;setTimeout(showNextAlert,180)}
function testAlerts(){enqueueAlert("測試提示","這是測試：橫額會在 10 秒後收起，亦可按 × 關閉。",1);enqueueAlert("測試提示","第二條測試：佇列依次顯示，沒有重疊。",5)}
function transitAlert(route,next){
  if(window.InfoDeskBusPreview?.observe(route,next,Number(CFG.BUS_PREVIEW_MINUTES)||12))enqueueAlert('巴士預告',L(`${route.route} 往${route.destination} ${next.mins} 分鐘後到站（${hkTime(next.iso)}）`,`${route.route} TO ${route.destinationEn||route.destination} IN ${next.mins} MINS (${hkTime(next.iso)})`),8);
  const key=`transit_${route.key}`,old=previous(key);remember(key,next?JSON.stringify(next):"none");
  if(old===null||!next||next.mins>3||next.mins<=0)return;
  let before;try{before=JSON.parse(old)}catch{}
  if(!before||before.mins>3||(before.iso!==next.iso&&Math.abs(new Date(before.iso)-new Date(next.iso))>240000))enqueueAlert("即將到站",L(`${route.route} 往${route.destination}：下一班約 ${next.mins} 分鐘`,`${route.route} TO ${route.destinationEn||route.destination}: NEXT IN ${next.mins} MINS`),3);
}

function updateTicker(){
  if(window.InfoDeskView){window.InfoDeskView.updateTicker();return;}
  const hsi=state.indices.HSI?`恒指 ${state.indices.HSI.price} ${state.indices.HSI.change}`:"恒指 —";
  const dji=state.indices.DJI?`道指 ${state.indices.DJI.price} ${state.indices.DJI.change}`:"道指 —";
  const parts=[hsi,dji,`天氣：${state.warningText}`,...state.headlines.slice(0,8)];
  $("#tickerTrack").innerHTML=parts.map((x,i)=>`<span class="${i===2?"alert":""}">${esc(x)}</span>`).join("");
}

async function loadWeather(){
  const requested=lang();if(state.weatherPending[requested])return state.weatherPending[requested];
  window.InfoDeskNetwork?.begin('weather');
  const base=`https://data.weather.gov.hk/weatherAPI/opendata/weather.php?lang=${requested}&dataType=`;
  const work=(async()=>{try{
    const data=await Promise.all([getJSON(base+"rhrread"),getJSON(base+"flw"),getJSON(base+"fnd"),getJSON(base+"warnsum")]);
    state.weatherCache[requested]=data;if(lang()!==requested)return;renderWeatherData(data);setStamp("#weatherUpdated");
  }catch{if(lang()===requested)$("#weather").innerHTML='<div class="error">暫時未能取得數據</div>'}finally{delete state.weatherPending[requested]}})();state.weatherPending[requested]=work;return work;
}
function renderWeatherData([now,local,nine,warnings]){
    const temp=name=>now.temperature?.data?.find(x=>x.place===name)?.value??"—";const rh=now.humidity?.data?.[0]?.value??"—";
    const active=Object.values(warnings||{}).filter(x=>x&&x.actionCode!=="CANCEL");const names=active.map(x=>x.name||x.code).filter(Boolean);
    const warningMessages=Array.isArray(now.warningMessage)?now.warningMessage:(now.warningMessage?[String(now.warningMessage)]:[]);
    state.warningText=names.length?names.join(L('、',' / ')):(warningMessages.join(L('、',' / '))||T("暫無天氣警告"));
    if(changed("weather_warning_"+lang(),state.warningText)&&!window.InfoDeskNetwork?.stale('weather'))enqueueAlert("天氣警告",L('警告更新：','WARNING UPDATE: ')+state.warningText,1);
    const days=(nine.weatherForecast||[]).slice(0,3).map(d=>`<div class="day"><div class="day-date">${esc(UI?.en()?UI.day(d.forecastDate):String(d.forecastDate).slice(6,8)+"/"+String(d.forecastDate).slice(4,6))}</div><div class="day-temp">${esc(d.forecastMintemp?.value)}–${esc(d.forecastMaxtemp?.value)}°</div><div class="day-desc">${esc(d.forecastWeather)}</div><div class="day-rh">${L('濕度','HUMIDITY')} ${esc(d.forecastMinrh?.value)}–${esc(d.forecastMaxrh?.value)}%</div></div>`).join("");
    const locations=[[L('沙田氣象站','SHA TIN'),L('沙田','Sha Tin')],[L('數碼港附近：黃竹坑站','NEAR CYBERPORT: WONG CHUK HANG'),L('黃竹坑','Wong Chuk Hang')]];
    $("#weather").innerHTML=`<div class="weather-now">${locations.map(([name,station])=>`<div class="location"><div class="location-name">${name}</div><div class="temp">${esc(temp(station))}°</div><div class="humidity">${L('濕度','HUMIDITY')} ${esc(rh)}% <small>${L('（香港天文台站）','(HKO STATION)')}</small></div></div>`).join('')}</div><div class="warning-box ${names.length||now.warningMessage?.length?"":"none"}">${esc(state.warningText)}</div><div class="summary"><b>${L('今日概況：','TODAY: ')}</b>${esc(local.forecastDesc||local.generalSituation||L('暫未提供','Not available yet'))}</div><div class="forecast">${days}</div><div class="fx-note">${L('天文台即時 API 只提供香港天文台站相對濕度；兩地均如實標示該站數值。','The live API provides relative humidity at HKO station only; both locations are labelled accordingly.')}</div>`;
    updateTicker();
}

const minutesUntil=iso=>Math.max(0,Math.round((new Date(iso)-Date.now())/60000));
const normEta=(iso,operator,remark="")=>iso?{mins:minutesUntil(iso),operator,remark,time:hkTime(iso),iso}:null;
async function fetchTransit(item){
  if(item.api==="kmb"){const j=await getJSON(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${item.stopId}/${item.route}/${item.serviceType||'1'}`);return(j.data||[]).filter(x=>x.dir===item.direction).map(x=>normEta(x.eta,"九巴",(lang()==='en'?x.rmk_en:x.rmk_tc))).filter(Boolean)}
  if(item.api==="gmb"){const j=await getJSON(`https://data.etagmb.gov.hk/eta/route-stop/${item.routeId}/${item.routeSeq}/${item.stopSeq}`);return(j.data?.eta||[]).map(x=>({mins:Math.max(0,Number(x.diff)),operator:"小巴",remark:(lang()==='en'?x.remarks_en:x.remarks_tc)||"",time:hkTime(x.timestamp),iso:x.timestamp}))}
  if(item.api==="ctb"){const j=await getJSON(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${item.stopId}/${item.route}`);return(j.data||[]).filter(x=>!item.direction||x.dir===item.direction).map(x=>normEta(x.eta,"城巴",(lang()==='en'?x.rmk_en:x.rmk_tc))).filter(Boolean)}
  const [k,c]=await Promise.allSettled([getJSON(`https://data.etabus.gov.hk/v1/transport/kmb/eta/${item.kmbStopId}/${item.route}/${item.kmbServiceType}`),getJSON(`https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${item.ctbStopId}/${item.route}`)]);let all=[];
  if(k.status==="fulfilled")all.push(...(k.value.data||[]).filter(x=>x.dir===item.kmbDirection).map(x=>normEta(x.eta,"九巴",(lang()==='en'?x.rmk_en:x.rmk_tc))).filter(Boolean));
  if(c.status==="fulfilled")all.push(...(c.value.data||[]).filter(x=>x.dir===item.ctbDirection).map(x=>normEta(x.eta,"城巴",(lang()==='en'?x.rmk_en:x.rmk_tc))).filter(Boolean));
  if(k.status==="rejected"&&c.status==="rejected")throw new Error("both failed");return all.sort((a,b)=>a.mins-b.mins).slice(0,3);
}
const etaHTML=e=>`<span class="eta ${e.mins<=3?"soon":""}"><b>${e.mins<=0?T("即到"):e.mins+L(" 分"," MINS")}</b><small class="eta-clock">(${esc(e.time)})</small><small class="eta-operator">${esc(T(e.operator))}</small></span>`;
const routeDestination=r=>L(r.destination,r.destinationEn||r.destination);
const routeStop=r=>L(r.stopName,r.stopNameEn||r.stopName);
async function loadTransit(){
  window.InfoDeskNetwork?.begin('transit');
  const results=await Promise.allSettled(CFG.TRANSIT.map(fetchTransit));
  for(const x of results)if(x.status==='fulfilled')x.value=x.value.filter(e=>Number.isFinite(Date.parse(e.iso))&&Date.parse(e.iso)>=Date.now()-120000&&Date.parse(e.iso)<=Date.now()+3600000).sort((a,b)=>Date.parse(a.iso)-Date.parse(b.iso));
  state.transitResults=results;state.transitOrder=window.InfoDeskTransitOrder(CFG.TRANSIT,results,state.transitOrder,state.transitSorted);renderTransitData(results,true);
  if(results.some(x=>x.status==="fulfilled"))setStamp("#transitUpdated");
}
function renderTransitData(results,animate=false){
  const old=new Map([...document.querySelectorAll('#transit .route-card')].map(e=>[e.dataset.routeKey,e.getBoundingClientRect().top]));
  const order=state.transitOrder.length?state.transitOrder:CFG.TRANSIT.map(r=>r.key);
  $("#transit").innerHTML=`<div class="transit-list">${order.map(key=>{const i=CFG.TRANSIT.findIndex(r=>r.key===key),r=CFG.TRANSIT[i],x=results[i],has=x?.status==='fulfilled'&&x.value.length;let body=has?x.value.slice(0,3).map(etaHTML).join(''):`<span class="route-error">${L('60 分鐘內沒有班次','NO SERVICE WITHIN 60 MINS')}${x?.status==='rejected'?`<small>${T('暫時未能取得數據')}</small>`:''}</span>`;if(animate&&!window.InfoDeskNetwork?.stale('transit'))transitAlert(r,has?x.value[0]:null);return`<div class="route-card ${has?'':'no-service'}" data-route-key="${esc(key)}" data-region="${esc(r.region||'其他')}"><div class="route-identity"><span class="region-tag">${esc(window.InfoDeskDisplay?.regionLabel(r.region)||r.region||'其他')}</span><div class="route-no">${esc(r.route)}</div><div class="operator">${esc(T(r.operator))}</div></div><div class="route-meta"><div class="route-dest">${L('往','TO')} ${esc(routeDestination(r))}</div><div class="route-stop">${esc(routeStop(r))}</div></div><div class="etas">${body}</div></div>`}).join("")}</div>`;
  window.InfoDeskDisplay?.applyRegion();
  if(animate&&!window.InfoDeskTV?.enabled()&&matchMedia('(max-width:767px)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches)document.querySelectorAll('#transit .route-card').forEach(e=>{const from=old.get(e.dataset.routeKey),to=e.getBoundingClientRect().top;if(Number.isFinite(from)&&from!==to)e.animate([{transform:`translateY(${from-to}px)`},{transform:'translateY(0)'}],{duration:400,easing:'cubic-bezier(.2,.7,.2,1)'})});
  window.InfoDeskView?.transit(results);
}
function setupTransitSort(){state.transitSorted=localStorage.getItem('dashboard_transit_sort')!=='fixed';const render=()=>{$('#transitSort').textContent=T(state.transitSorted?'按到站排序':'固定次序');$('#transitSort').setAttribute('aria-pressed',String(state.transitSorted))};render();$('#transitSort').onclick=()=>{state.transitSorted=!state.transitSorted;localStorage.setItem('dashboard_transit_sort',state.transitSorted?'arrival':'fixed');render();if(state.transitResults){state.transitOrder=window.InfoDeskTransitOrder(CFG.TRANSIT,state.transitResults,state.transitOrder,state.transitSorted);renderTransitData(state.transitResults,true)}};document.addEventListener('infodesk:language',render)}

async function loadFx(){
  window.InfoDeskNetwork?.begin('fx');
  try{const rows=await getJSON(window.InfoDeskFX.query(CFG.FX));if(!Array.isArray(rows))throw new Error('invalid FX');state.fxRows=window.InfoDeskFX.convert(rows,CFG.FX.CURRENCIES);if(!state.fxRows.some(x=>!x.error))throw new Error('missing FX');renderFx();setStamp('#fxUpdated')}catch{$('#fx').innerHTML='<div class="error">暫時未能取得數據</div>'}
}
function renderFx(){if(!state.fxRows)return;
  $('#fx').innerHTML=`<div class="fx-grid">${state.fxRows.map(q=>{
    const cls=q.change>0?'up':q.change<0?'down':'flat',arrow=q.change>0?'▲':q.change<0?'▼':'—';
    const change=q.change===null?L('未有前一參考日資料','Previous reference unavailable'):`${arrow} ${Math.abs(q.change).toFixed(4)} (${Math.abs(q.pct).toFixed(2)}%)`;
    return `<div class="fx" data-code="${q.code}" data-units="${q.units}"><div class="fx-label"><b>${q.code}</b><span>${esc(L(q.name,q.en))}</span></div><div class="fx-code">${q.units} ${q.code} = <span>HKD</span></div>${q.error?'<div class="error">暫時未能取得數據</div>':`<div class="fx-rate">${q.price.toFixed(4)}</div><div class="fx-change ${cls}">${esc(change)}</div><div class="fx-date">${esc(UI.day(q.date))}${q.previousDate?' · '+L('較','vs ')+esc(UI.day(q.previousDate)):''}</div>`}</div>`;
  }).join('')}</div><div class="fx-note">${L('每日參考價；升跌較前一參考日。每 60 秒檢查來源，並非即時交易價。','Daily reference rates; change vs previous reference day. Checked every60 seconds, not live trading prices.')}<br>Frankfurter v2 · ${L('各地中央銀行及官方來源','Central banks and official sources')}</div>`;
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
function quoteHTML(q){const cls=q.pct>0?"up":q.pct<0?"down":"flat";const sign=q.pct>0?"+":"";return`<div class="quote" data-symbol="${esc(q.yahoo||q.name)}" data-delta="${q.pct!==-100?q.price*q.pct/(100+q.pct):0}"><div><div class="quote-name">${esc(T(q.name))}</div><div class="quote-price">${q.price.toLocaleString("en-HK",{maximumFractionDigits:2})}</div></div><div class="quote-change ${cls}">${sign}${q.pct.toFixed(2)}%</div><div class="quote-time"><span ${q.time?`data-datetime="${+q.time}"`:''}>${q.time?hkDateTime(q.time):T("來源未提供時間")}</span> HKT · Yahoo Finance${IS_EXTENSION?"":L("／Jina 快照"," / Jina snapshot")}</div></div>`}
function publicDataError(error){if(error?.name==="AbortError")return "連線逾時，下次更新重試";const message=String(error?.message||"");if(message.includes("429"))return "公開服務限流，下次更新重試";if(/invalid market response|no quote|invalid price/.test(message))return "來源回應沒有有效報價";return "公開來源暫時無法讀取，下次更新重試"}
async function loadMarket(items,target,stamp,batch=null,touchStamp=true){
  batch=batch||await fetchQuoteBatch(items);const settled=items.map(item=>{const x=batch.get(item.yahoo);return x?.status==="fulfilled"?{status:"fulfilled",value:{...item,...x.value}}:{status:"rejected",reason:x?.reason||new Error("no quote")}});const good=settled.filter(x=>x.status==="fulfilled").map(x=>x.value);$(target).innerHTML=settled.map((x,i)=>x.status==="fulfilled"?quoteHTML(x.value):`<div class="quote" data-symbol="${esc(items[i].yahoo)}"><div class="quote-name">${esc(T(items[i].name))}</div><div class="quote-error">暫時未能取得數據</div><div class="quote-time">${esc(T(publicDataError(x.reason)))}</div></div>`).join("");
  for(const q of good){if(q.alertIndex){state.indices[q.alertIndex]={price:q.price.toLocaleString("en-HK",{maximumFractionDigits:2}),change:`${q.pct>0?"+":""}${q.pct.toFixed(2)}%`};const over=Math.abs(q.pct)>2?`${q.pct>0?"up":"down"}:${q.pct.toFixed(1)}`:"normal";const key=`market_${q.alertIndex}`;const old=previous(key);remember(key,over);if(old!==null&&over!=="normal"&&!old.startsWith(over.split(":")[0]))enqueueAlert("市場異動",L(`${q.name} 單日${q.pct>0?"上升":"下跌"} ${Math.abs(q.pct).toFixed(2)}%`,`${T(q.name)} ${q.pct>0?'UP':'DOWN'} ${Math.abs(q.pct).toFixed(2)}% TODAY`),4)}}
  updateTicker();if(good.length&&touchStamp)setStamp(stamp);
}
async function loadMarkets(){window.InfoDeskNetwork?.begin('markets');const batch=await fetchQuoteBatch([...CFG.HK_MARKET,...CFG.US_MARKET]);state.marketBatch=batch;await renderMarkets();}
async function renderMarkets(touchStamp=true){if(!state.marketBatch)return;await Promise.allSettled([loadMarket(CFG.HK_MARKET,"#hkMarket","#hkMarketUpdated",state.marketBatch,touchStamp),loadMarket(CFG.US_MARKET,"#usMarket","#usMarketUpdated",state.marketBatch,touchStamp)])}

function parseReaderMarkdown(text,requested='tc'){
  const matches=[...text.matchAll(/\[([^\]\n]{5,180})\]\((https?:\/\/[^\s)]+)\)/g)], rows=[],seen=new Set();
  for(let i=0;i<matches.length;i++){
    const m=matches[i],title=m[1].trim();let url;try{url=new URL(m[2].replace(/&amp;/g,"&"))}catch{continue}
    if(url.hostname!=="news.rthk.hk"||!url.pathname.startsWith(`/rthk/${requested==='en'?'en':'ch'}/component/k2/`)||/^(Image|https?:)/i.test(title))continue;
    url.protocol="https:";url.search="";url.hash="";const link=url.href;if(seen.has(link))continue;
    const after=text.slice(m.index+m[0].length,m.index+m[0].length+1500).split(/\n#{2,6}\s/)[0];
    const date=after.match(/(\d{4}-\d{2}-\d{2}) HKT (\d{2}:\d{2})/),rssDate=after.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),? \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} [+-]\d{4}/);
    const published=date?Date.parse(`${date[1]}T${date[2]}:00+08:00`):rssDate?Date.parse(rssDate[0]):NaN;if(!Number.isFinite(published))continue;
    seen.add(link);rows.push({title,link,published});
  }
  return rows.sort((a,b)=>b.published-a.published);
}
async function loadOneNews(feeds,target,stamp,key,requested=lang()){
  window.InfoDeskNetwork?.begin(key==='local'?'localNews':'worldNews');
  try{
    const results=await Promise.allSettled(feeds.map(async feed=>{const rows=parseReaderMarkdown(await fetchJinaText("https://r.jina.ai/"+feed,requested==='en'?35000:18000,requested==='en'?{'X-Engine':'browser','X-Respond-With':'markdown','X-No-Cache':'true'}:{}),requested);if(!rows.length)throw new Error("empty");return rows}));
    const all=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value);
    const items=[...new Map(all.map(x=>[x.link,x])).values()].sort((a,b)=>b.published-a.published).slice(0,10);
    if(!items.length)throw new Error("empty");
    const partial=results.some(x=>x.status==="rejected");
    (state.newsCache[requested]||={})[key]={items,partial};if(lang()!==requested)return;
    renderNewsGroup({items,partial},target,key,requested);setStamp(stamp);
  }catch{if(lang()===requested)$(target).innerHTML='<div class="error">暫時未能取得數據</div>'}
}
function renderNewsGroup({items,partial},target,key,requested){
    $(target).innerHTML=`${partial?'<div class="route-error">部分新聞來源暫時未能取得數據</div>':""}<div class="news-list">${items.map(x=>`<a class="news-item" data-published="${x.published}" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer"><span class="news-title">${esc(x.title)}</span><span class="news-time" data-datetime="${x.published}">${hkDateTime(x.published)}</span></a>`).join("")}</div>`;
    const ids=items.map(x=>x.link).join("||"),old=previous(`news_${requested}_${key}`);remember(`news_${requested}_${key}`,ids);
    if(old!==null){const oldSet=new Set(old.split("||"));items.filter(x=>!oldSet.has(x.link)).slice(0,3).forEach(x=>enqueueAlert("最新新聞",x.title,5))}
    state.headlines=Object.values(state.newsCache[requested]||{}).flatMap(x=>x.items.slice(0,4).map(x=>x.title));updateTicker();
}
async function loadNews(){const requested=lang();if(state.newsPending[requested])return state.newsPending[requested];const work=Promise.allSettled([window.InfoDeskNews.loadLocal(requested),loadOneNews(requested==='en'?CFG.NEWS.EN_WORLD:CFG.NEWS.WORLD,"#worldNews","#worldNewsUpdated","world",requested)]).finally(()=>delete state.newsPending[requested]);state.newsPending[requested]=work;return work;}

function startGmailPolling(){clearInterval(state.gmailTimer);state.gmailTimer=null;if(state.gmailOpen&&state.gmailToken)state.gmailTimer=setInterval(loadGmail,300000)}
function saveToken(token,expiresIn=3600){if(typeof token!=="string"||!token||!Number.isFinite(Number(expiresIn))||Number(expiresIn)<=60)throw new Error("授權回傳無效，請重新連接");state.gmailToken=token;state.gmailExpiry=Date.now()+(Number(expiresIn)-60)*1000;localStorage.setItem("dashboard_gmail_token",token);localStorage.setItem("dashboard_gmail_expiry",String(state.gmailExpiry));$("#gmailDisconnect").hidden=false;startGmailPolling()}
function restoreToken(){const token=localStorage.getItem("dashboard_gmail_token");const expiry=Number(localStorage.getItem("dashboard_gmail_expiry"));if(token&&expiry>Date.now()){state.gmailToken=token;state.gmailExpiry=expiry;$("#gmailDisconnect").hidden=false;return true}localStorage.removeItem('dashboard_gmail_token');localStorage.removeItem('dashboard_gmail_expiry');state.gmailToken=null;return false}
function setGmailHint(text,isError=false){if(!state.gmailOpen)return;$("#gmailHint").innerHTML=text;$("#gmailHint").hidden=false;$("#gmailHint").style.color=isError?"#ff8793":""}
function gmailAuthOnly(){for(const id of ['#gmailHint','#gmail','#gmailColumns','#gmailUpdated','#gmailDisconnect'])$(id).hidden=true;$('#gmailAuth').hidden=false;$('#gmailHint').textContent='';$('#gmail').textContent='';}
function gmailConnectedUI(){for(const id of ['#gmailHint','#gmail','#gmailColumns','#gmailUpdated','#gmailDisconnect'])$(id).hidden=false;$('#gmailAuth').hidden=true;}
function setGmailExpanded(open,persist=true){
  state.gmailOpen=Boolean(open);state.gmailGeneration++;state.gmailAbort?.abort();state.gmailAbort=null;state.gmailBusy=false;
  clearInterval(state.gmailTimer);state.gmailTimer=null;baselines.delete('gmail_ids');
  if(persist)localStorage.setItem('dashboard_gmail_open',open?'1':'0');
  $('#gmailToggle').setAttribute('aria-expanded',String(Boolean(open)));$('#gmailContent').hidden=!open;$('.gmail-panel').classList.toggle('collapsed',!open);
  state.alertQueue=state.alertQueue.filter(x=>x.kind!=='新 Gmail');if(state.alertShowing&&state.alertKind==='新 Gmail')closeAlert();
  if(!open)return;
  if(restoreToken()){gmailConnectedUI();loadGmail();startGmailPolling()}else gmailAuthOnly();
  if(persist&&globalThis.matchMedia?.('(max-width:767px)').matches)requestAnimationFrame(()=>$('.gmail-panel').scrollIntoView({block:'center',behavior:'smooth'}));
  // No OAuth SDK or identity request until an explicit Connect click.
}
function setupMessagePanels(){
  $('#gmailToggle').onclick=()=>setGmailExpanded(!state.gmailOpen);
  setGmailExpanded(localStorage.getItem('dashboard_gmail_open')==='1',false);
  const wa=open=>{$('#waToggle').setAttribute('aria-expanded',String(open));$('#waContent').hidden=!open;$('.whatsapp-panel').classList.toggle('collapsed',!open)};
  wa(localStorage.getItem('dashboard_whatsapp_open')==='1');$('#waToggle').onclick=()=>{const open=$('#waContent').hidden;wa(open);localStorage.setItem('dashboard_whatsapp_open',open?'1':'0');if(open&&globalThis.matchMedia?.('(max-width:767px)').matches)requestAnimationFrame(()=>$('.whatsapp-panel').scrollIntoView({block:'center',behavior:'smooth'}))};
}
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
async function gmailFetch(path,signal){const r=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{cache:'no-store',signal,headers:{Authorization:`Bearer ${state.gmailToken}`}});if(r.status===401){await disconnectGmail(false);throw new Error("登入已逾時，請重新連接 Gmail")}if(!r.ok)throw new Error(`Gmail API ${r.status}`);return r.json()}
async function loadGmail(){
  if(!state.gmailOpen||!state.gmailToken||state.gmailBusy)return;
  if(state.gmailExpiry<=Date.now()){await disconnectGmail(false);return}
  const generation=state.gmailGeneration,ctl=new AbortController();state.gmailAbort=ctl;state.gmailBusy=true;
  const current=()=>state.gmailOpen&&generation===state.gmailGeneration&&!ctl.signal.aborted;
  try{
    const list=await gmailFetch("messages?q=is%3Aunread&maxResults=10",ctl.signal);if(!current())return;
    const msgs=await Promise.all((list.messages||[]).map(x=>gmailFetch(`messages/${x.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,ctl.signal)));if(!current())return;
    const rows=msgs.map(m=>{const h=Object.fromEntries((m.payload?.headers||[]).map(x=>[x.name.toLowerCase(),x.value]));return{id:m.id,sender:h.from||T('（未知寄件人）'),subject:h.subject||T('（沒有主旨）'),date:h.date||Number(m.internalDate),thread:m.threadId}}).sort((a,b)=>new Date(b.date)-new Date(a.date));
    gmailConnectedUI();$('#gmail').innerHTML=rows.length?`<div class="mail-list">${rows.map(m=>`<a class="mail" href="https://mail.google.com/mail/u/0/#inbox/${esc(m.thread)}" target="_blank" rel="noopener"><span class="sender">${esc(m.sender)}</span><span class="subject">${esc(m.subject)}</span><span class="mail-time" data-datetime="${new Date(m.date).getTime()}">${esc(hkDateTime(m.date))}</span></a>`).join('')}</div>`:`<div class="empty">${T('目前沒有未讀郵件')}</div>`;
    const ids=rows.map(x=>x.id).join(','),old=previous('gmail_ids');remember('gmail_ids',ids);if(old!==null){const oldSet=new Set(old.split(','));rows.filter(x=>!oldSet.has(x.id)).slice(0,3).forEach(x=>enqueueAlert('新 Gmail',`${x.sender}：${x.subject}`,2))}
    setGmailHint(T('已連接；權杖只儲存在你的瀏覽器，可隨時中斷。'));setStamp('#gmailUpdated');
  }catch(e){if(current()&&state.gmailToken){$('#gmail').hidden=false;$('#gmail').innerHTML=`<div class="error">${T('暫時未能取得數據')}</div>`;setGmailHint(esc(e.message),true)}}finally{if(generation===state.gmailGeneration){state.gmailBusy=false;state.gmailAbort=null}}
}
async function disconnectGmail(revoke=true){if(revoke&&state.gmailToken)fetch("https://oauth2.googleapis.com/revoke?token="+encodeURIComponent(state.gmailToken),{method:"POST",cache:'no-store'}).catch(()=>{});state.gmailGeneration++;state.gmailAbort?.abort();state.gmailBusy=false;state.gmailToken=null;state.gmailExpiry=0;localStorage.removeItem("dashboard_gmail_token");localStorage.removeItem("dashboard_gmail_expiry");clearInterval(state.gmailTimer);state.gmailTimer=null;baselines.delete('gmail_ids');gmailAuthOnly();}

function handleWhatsAppStatus(count){count=Number(count)||0;$("#waUnread").textContent=count;const old=previous("whatsapp_unread");remember("whatsapp_unread",count);if(old!==null&&count>Number(old))enqueueAlert("WhatsApp",L(`未讀訊息增加至 ${count} 則`,`UNREAD COUNT INCREASED TO ${count}`),2)}
function setupWhatsApp(){
  if(IS_EXTENSION){$("#waMode").textContent="擴充功能｜只讀分頁標題";$("#waNote").textContent="只檢查 web.whatsapp.com 分頁標題中的數字，不讀取訊息內容。";chrome.runtime.onMessage.addListener(m=>{if(m?.type==="WHATSAPP_STATUS")handleWhatsAppStatus(m.unread)});chrome.runtime.sendMessage({type:"GET_WHATSAPP_STATUS"}).then(r=>handleWhatsAppStatus(r?.unread)).catch(()=>{});$("#waOpen").onclick=()=>chrome.runtime.sendMessage({type:"OPEN_WHATSAPP"})}
  else{$("#waUnread").textContent="—";$("#waOpen").onclick=()=>{const mobile=/iPhone|iPad|Android/i.test(navigator.userAgent);window.open(mobile?"whatsapp://":"https://web.whatsapp.com","_blank","noopener")}}
}

async function init(){
  tickClock();setInterval(tickClock,1000);$("#breakingClose").onclick=closeAlert;$("#testAlert").onclick=testAlerts;
  $("#muteToggle").checked=localStorage.getItem("dashboard_muted")==="1";$("#muteToggle").onchange=e=>localStorage.setItem("dashboard_muted",e.target.checked?"1":"0");
  const desktopSupported=IS_EXTENSION||("Notification" in window&&!/iPhone|iPad|iPod/i.test(navigator.userAgent));
  $("#notifyToggle").disabled=!desktopSupported;$("#notifyToggle").title=T(desktopSupported?"只在看板仍開啟時提供通知":"手機版提供頁內提示；關閉或切到背景後不保證更新。");
  $("#notifyToggle").checked=desktopSupported&&localStorage.getItem("dashboard_notify")==="1";$("#notifyToggle").onchange=async e=>{try{if(e.target.checked&&!IS_EXTENSION){const p=await Notification.requestPermission();if(p!=="granted")e.target.checked=false}}catch{e.target.checked=false}localStorage.setItem("dashboard_notify",e.target.checked?"1":"0")};
  $("#gmailAuth").onclick=IS_EXTENSION?connectGmailExtension:connectGmailWeb;$("#gmailDisconnect").onclick=()=>disconnectGmail(true);setupWhatsApp();
  const runtime=IS_EXTENSION?`擴充功能模式｜ID：<code>${esc(chrome.runtime.id)}</code><br>Gmail Redirect URI：<code>${esc(chrome.identity.getRedirectURL("oauth2"))}</code>`:`GitHub Pages／網頁模式｜目前網址：<code>${esc(location.origin)}</code>`;$("#runtimeInfo").innerHTML=runtime;
  setupMessagePanels();setupTransitSort();
  const jobs=[[loadTransit,30000],[loadWeather,600000],[loadFx,60000],[loadNews,60000],[loadMarkets,60000]];
  for(const [load,interval]of jobs){let busy=false;const run=async()=>{if(busy)return;busy=true;try{await load()}finally{busy=false}};run();setInterval(run,interval)}
}

document.addEventListener("DOMContentLoaded",init);
document.addEventListener('infodesk:language',()=>{
  // Re-render cached public numbers immediately; only language-dependent sources need fetching.
  state.suppressAlerts=true;state.alertQueue=[];clearTimeout(state.alertTimer);state.alertShowing=false;$('#breaking').hidden=true;
  tickClock();renderStamps();renderMarkets(false);renderFx();
  if(state.transitResults)renderTransitData(state.transitResults);
  const weather=state.weatherCache[lang()];
  if(weather)renderWeatherData(weather);else{$('#weather').innerHTML='<div class="loading">正在取得天文台資料…</div>';state.warningText=T('暫無天氣警告');}
  state.headlines=[];
  for(const [key,target]of [['local','#localNews'],['world','#worldNews']]){const saved=state.newsCache[lang()]?.[key];if(saved){renderNewsGroup(saved,target,key,lang());if(key==='local')window.InfoDeskNews?.renderLocal(saved)}else $(target).innerHTML='<div class="loading">正在取得新聞…</div>';}
  updateTicker();UI.apply();UI.refreshDates();state.suppressAlerts=false;
  loadWeather();loadNews();
});
