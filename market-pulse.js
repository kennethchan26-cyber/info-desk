"use strict";
// Public Longbridge market analytics. No account/portfolio endpoint is involved.
window.InfoDeskMarketPulse=(()=>{
  const en=()=>window.InfoDeskI18n?.en(),tr=(a,b)=>en()?b:a,E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lb=()=>window.InfoDeskLongbridge,extra=k=>lb()?.extras(k),fmt=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-HK',{maximumFractionDigits:d}):'—';
  const signed=(v,d=2)=>`<span class="${v>0?'up':v<0?'down':'flat'}">${v>0?'▲':v<0?'▼':'—'} ${fmt(Math.abs(v),d)}</span>`;
  const card=(tag,value,detail='',cls='')=>`<article class="lb-card ${cls}"><b class="tv-tag">${E(tag)}</b><strong class="lb-number">${value}</strong><p>${detail}</p></article>`;
  const missing=()=>card(tr('長橋','LONGBRIDGE'),'—',tr('暫時未能取得數據；股價已啟用後備','DATA UNAVAILABLE; QUOTES USE FALLBACK'));
  function session(m){const s=window.InfoDeskCalendar?.status(m),raw=extra('pulse')?.status?.[m];if(m==='HK')return raw==='Trading'?tr('交易中','OPEN'):s?.reason?tr(s.reason,s.trading?'OPEN':'CLOSED'):tr('休市','CLOSED');
    const d=new Date(),parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),get=t=>parts.find(p=>p.type===t)?.value,n=Number(get('hour'))*60+Number(get('minute')),day=get('weekday');
    if(raw==='Trading')return tr('交易中','OPEN');
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),isToday=s?.sessionDay===today;
    if(!['Sat','Sun'].includes(day)&&isToday&&n>=240&&n<570)return tr('盤前（時段）','PRE-MARKET SESSION');
    // Early-close afternoons use the existing exchange calendar, never a hard-coded HKT offset.
    const schedule=window.InfoDeskCalendar?.schedule('US',today)||[],close=schedule.at(-1)?.time;
    if(close&&Date.now()>=close&&n<1200)return tr('盤後（時段）','POST-MARKET SESSION');
    const q=lb()?.current()?.quotes?.NVDA?.extended?.overnight;if(q?.time&&Date.now()-Date.parse(q.time)<20*60000)return tr('夜盤','OVERNIGHT');
    return tr('休市','CLOSED');
  }
  function pulseItems(){const p=extra('pulse'),items=[];for(const m of ['HK','US']){const t=p?.temperature?.[m];items.push(card(tr(m==='HK'?'港股溫度':'美股溫度',m+' TEMPERATURE'),t?fmt(t.temperature,0)+'<em>/100</em>':'—',`${E(session(m))}<br>${tr('估值','VALUATION')} ${fmt(t?.valuation,0)} · ${tr('情緒','SENTIMENT')} ${fmt(t?.sentiment,0)}`));}
    for(const a of extra('ah')?.items||[])items.push(card(a.symbol,signed(a.hVsAPct)+'%',tr('H 股較 A 股溢價／折讓','H-SHARE PREMIUM / DISCOUNT TO A')+`<br>${tr('按匯率折算；來源日期','FX-ADJUSTED; SOURCE DATE')} ${E(lb().date(Number(a.time)*1000))}`));return items;
  }
  function capitalItems(){return (extra('capital')?.items||[]).map(x=>card(x.symbol,signed(x.net/1e6)+'<em> M '+E(x.currency)+'</em>',`${E(x.name)}<br>${tr('大單流入 − 大單流出','LARGE-ORDER INFLOW − OUTFLOW')}`));}
  function eventItems(){return (extra('calendar')?.items||[]).map(x=>`<article class="lb-event"><div><b class="tv-tag">${E(x.symbol||x.market)}</b><span>${E(lb().date(x.time*1000))}</span></div><h3>${E(x.title)}</h3><p>${E(x.name)}${x.watched?' · '+tr('自選股','WATCHLIST'):''}</p></article>`)}
  function anomalyItems(limit=12){return (extra('anomalies')?.items||[]).sort((a,b)=>Number(b.alert_time)-Number(a.alert_time)).slice(0,limit).map(x=>card(x.symbol,E(x.alert_name),`${E((x.change_values||[]).join(' · '))}<br>${E(lb().date(Number(x.alert_time)*1000))}`,'lb-anomaly'));}
  function leaderItems(){const r=extra('leaders'),items=[];for(const [group,rows]of Object.entries(r?.groups||{})){const [m,order]=group.split('-');items.push(`<article class="lb-leaders"><b class="tv-tag">${m} ${tr(order==='desc'?'升幅榜':'跌幅榜',order==='desc'?'GAINERS':'LOSERS')}</b><p>${tr('選股器前收市資料，非即時排名','SCREENER LAST-CLOSE DATA, NOT LIVE RANKING')}</p>${rows.map(x=>`<div><b>${E(x.symbol)}</b>${signed(Number(x.prevchg))}%</div>`).join('')}</article>`)}
    // A bounded universe is labelled, rather than pretending this is an exchange-wide turnover ranking.
    for(const m of ['HK','US']){const rows=Object.values(lb()?.current()?.quotes||{}).filter(x=>x.symbol.endsWith('.'+m)&&!x.symbol.startsWith('.')&&!['HSI.HK','HSCEI.HK','HSTECH.HK'].includes(x.symbol)).sort((a,b)=>(b.turnover||0)-(a.turnover||0)).slice(0,5);if(rows.length)items.push(`<article class="lb-leaders"><b class="tv-tag">${m} ${tr('成交額焦點','TURNOVER LEADERS')}</b><p>${tr('僅已追蹤股份，非全市場','TRACKED UNIVERSE ONLY, NOT THE WHOLE MARKET')}</p>${rows.map(x=>`<div><b>${E(x.symbol)}</b><strong>${fmt(x.turnover/1e9)} B</strong></div>`).join('')}</article>`)}return items;}
  function pages(){return [
    {tc:'市場溫度與 A/H',en:'MARKET TEMPERATURE / A-H',type:'lb-pulse',items:pulseItems(),capacity:4},
    {tc:'市場榜單',en:'MARKET LEADERS',type:'lb-leaders',items:leaderItems(),capacity:2},
    {tc:'自選股資金流',en:'WATCHLIST CAPITAL FLOW',type:'lb-capital',items:capitalItems(),capacity:4},
    {tc:'未來七日財經日曆',en:'SEVEN-DAY MARKET CALENDAR',type:'lb-calendar',items:eventItems(),capacity:3},
    {tc:'市場異動',en:'MARKET ANOMALIES',type:'lb-anomalies',items:anomalyItems(),capacity:3}
  ].map(x=>({...x,items:x.items.length?x.items:[missing()]}))}
  function rail(type){if(type==='lb-temperature')return [tr('市場溫度','MARKET TEMPERATURE'),pulseItems().slice(0,2).join('')];if(type==='lb-anomalies'){const items=anomalyItems(2);return [tr('市場異動','MARKET ANOMALIES'),items.join('')||missing()]}return null}
  const mobilePages=new Map();
  function mobile(){const node=document.getElementById('lbMobile');if(!node)return;node.innerHTML=pages().map(x=>{const size=Math.min(x.capacity,3),total=Math.ceil(x.items.length/size),page=(mobilePages.get(x.type)||0)%total;mobilePages.set(x.type,page);return `<section class="panel"><div class="panel-head"><h2>${E(tr(x.tc,x.en))}</h2></div><div class="lb-mobile-grid">${x.items.slice(page*size,(page+1)*size).join('')}</div><nav class="lb-mobile-pages"><button data-lb-page="${x.type}" data-step="-1" aria-label="${tr('上一頁','Previous page')}">‹</button><span>${page+1}/${total}</span><button data-lb-page="${x.type}" data-step="1" aria-label="${tr('下一頁','Next page')}">›</button></nav><p class="lb-source">${E(lb().label())}</p></section>`}).join('')}
  document.addEventListener('DOMContentLoaded',()=>{const target=document.querySelector('.broadcast-layout');target?.insertAdjacentHTML('beforeend','<div id="lbMobile"></div>');mobile();setInterval(mobile,60000)});
  document.addEventListener('infodesk:longbridge',()=>{mobile();window.InfoDeskTVPanels?.refresh()});document.addEventListener('infodesk:language',mobile);
  document.addEventListener('click',e=>{const b=e.target.closest?.('[data-lb-page]');if(!b)return;const p=pages().find(x=>x.type===b.dataset.lbPage),n=Math.ceil(p.items.length/Math.min(3,p.capacity));mobilePages.set(p.type,((mobilePages.get(p.type)||0)+Number(b.dataset.step)+n)%n);mobile()});
  return {pages,rail,session};
})();
