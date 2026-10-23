"use strict";
// Anonymous public snapshots ONLY. There is no Longbridge login or key in the browser.
window.InfoDeskLongbridge=(()=>{
  let snapshot=null,pending=null,lastAttempt=0;const CACHE='infodesk_public_longbridge_v1';
  const cfg=()=>window.DASHBOARD_CONFIG?.LONGBRIDGE||{},en=()=>window.InfoDeskI18n?.en(),tr=(a,b)=>en()?b:a;
  const fresh=(value,now=Date.now())=>{const age=now-Date.parse(value);return Number.isFinite(age)&&age>=-60000&&age<(cfg().MAX_AGE_MS||1200000)};
  function validate(x){return x?.schema===1&&x.publisher==='INFO-DESK-LONGBRIDGE'&&x.quotes&&typeof x.quotes==='object'&&Number.isFinite(Date.parse(x.collectedAt))}
  try{const x=JSON.parse(localStorage.getItem(CACHE));if(validate(x))snapshot=x}catch{}
  const current=()=>cfg().ENABLED!==false&&snapshot&&fresh(snapshot.collectedAt)?snapshot:null;
  function date(value){const d=new Date(value);if(!Number.isFinite(+d))return '—';return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(',','')+' HKT'}
  async function load(){if(cfg().ENABLED===false)return null;if(pending)return pending;if(Date.now()-lastAttempt<45000)return current();lastAttempt=Date.now();
    pending=(async()=>{const urls=[];if(['localhost','127.0.0.1'].includes(location.hostname))urls.push(new URL('market.json',location.href).href);if(cfg().URL)urls.push(cfg().URL);
      for(const raw of urls){try{const url=new URL(raw);url.searchParams.set('minute',String(Math.floor(Date.now()/60000)));const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),6500);let r;try{r=await fetch(url,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:abort.signal})}finally{clearTimeout(timer)}if(!r.ok)continue;const x=await r.json();if(!validate(x))continue;
          // Do not replace a newer cached snapshot with an old CDN response.
          if(!snapshot||Date.parse(x.collectedAt)>=Date.parse(snapshot.collectedAt)){snapshot=x;try{localStorage.setItem(CACHE,JSON.stringify(x))}catch{}}
          break;
        }catch{}}
      document.dispatchEvent(new CustomEvent('infodesk:longbridge'));return current();
    })().finally(()=>pending=null);return pending;
  }
  function quote(symbol){const x=current()?.quotes?.[symbol];if(!x||!fresh(x.fetchedAt)||!Number.isFinite(x.price)||x.price<=0||!Number.isFinite(x.pct))return null;return {yahoo:symbol,price:x.price,pct:x.pct,time:x.quoteTime?new Date(x.quoteTime):null,collectedAt:x.fetchedAt,source:'Longbridge',previous:x.previous,delta:x.change}}
  function cachedQuote(symbol){const x=cfg().ENABLED!==false&&snapshot?.quotes?.[symbol];if(!x||!Number.isFinite(x.price)||x.price<=0||!Number.isFinite(x.pct))return null;return {yahoo:symbol,price:x.price,pct:x.pct,time:null,collectedAt:x.fetchedAt,source:'Longbridge',cached:true}}
  function series(symbol){const data=current(),x=data?.intraday?.[symbol],q=data?.quotes?.[symbol];if(!x||!fresh(x.fetchedAt)||!Array.isArray(x.points)||x.points.length<2)return null;
    const p=x.points.filter(r=>Array.isArray(r)&&Number.isFinite(r[0])&&Number.isFinite(r[1])&&r[1]>0);if(p.length<2)return null;
    return {symbol,response:[{meta:{previousClose:q?.previous,regularMarketPrice:q?.price,regularMarketDayHigh:q?.high,regularMarketDayLow:q?.low,exchangeTimezoneName:symbol.endsWith('.HK')||symbol.startsWith('^HS')?'Asia/Hong_Kong':'America/New_York',dataGranularity:'1m'},timestamp:p.map(r=>r[0]),indicators:{quote:[{close:p.map(r=>r[1]),volume:p.map(r=>r[2])}]}}],fetchedAt:x.fetchedAt};
  }
  function extras(key){const x=current()?.extras?.[key];return x&&fresh(x.fetchedAt)?x:null}
  function label(){return current()?tr('資料來源：長橋 · 取得 ','SOURCE: LONGBRIDGE · FETCHED ')+date(snapshot.collectedAt):tr('資料來源：後備 Yahoo / Frankfurter','SOURCE: FALLBACK YAHOO / FRANKFURTER')}
  function updateBadge(){let node=document.getElementById('marketSourceStatus');if(!node){node=document.createElement('span');node.id='marketSourceStatus';document.querySelector('.status')?.append(node)}if(node)node.textContent=label()}
  document.addEventListener('DOMContentLoaded',()=>{updateBadge();setInterval(updateBadge,30000)});document.addEventListener('infodesk:longbridge',updateBadge);document.addEventListener('infodesk:language',updateBadge);
  return {load,quote,cachedQuote,series,extras,date,label,fresh,validate,current,inspect:()=>({fresh:Boolean(current()),collectedAt:snapshot?.collectedAt,quotes:Object.keys(snapshot?.quotes||{}).length})};
})();
