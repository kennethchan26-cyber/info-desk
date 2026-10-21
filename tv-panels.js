"use strict";
// TV-only presentation. Reads the existing public data/DOM; never fetches or reads Gmail.
window.InfoDeskTVPanels = (() => {
  const Q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
  const tv=()=>Boolean(window.InfoDeskTV?.enabled()),active=()=>tv()||innerWidth>=768,en=()=>window.InfoDeskI18n?.en()||false;
  const tr=(tc,eng)=>en()?eng:tc,txt=(node,selector)=>node?.querySelector(selector)?.textContent?.trim()||'';
  const chunks=(rows,size)=>Array.from({length:Math.max(1,Math.ceil(rows.length/size))},(_,i)=>rows.slice(i*size,(i+1)*size));
  // Long prose is continued, never ellipsized or hidden. Original links/metadata accompany every continuation.
  function splitText(value,limit){const chars=Array.from(String(value||'')),out=[];for(let i=0;i<chars.length;i+=limit)out.push(chars.slice(i,i+limit).join(''));return out.length?out:[''];}
  function fastest(routes,results){return routes.flatMap((route,i)=>results?.[i]?.status==='fulfilled'?results[i].value.map(eta=>({route,eta})):[]).filter(x=>Number.isFinite(Date.parse(x.eta.iso))&&x.eta.mins<=60).sort((a,b)=>Date.parse(a.eta.iso)-Date.parse(b.eta.iso)).slice(0,3);}
  function createSchedule(){let main=0,nextMain=0,nextSub=0,locked=false,started=false;const pages=Array(10).fill(0),visits=Array(10).fill(false);
    return {advance(now,commute,counts){let changed=false;
      if(!started){started=true;main=commute?4:0;locked=commute;nextMain=now+15000;nextSub=now+8000;visits[main]=true;changed=true;}
      else if(commute!==locked){locked=commute;main=commute?4:0;nextMain=now+15000;nextSub=now+8000;changed=true;}
      else if(!locked&&now>=nextMain){main=(main+1)%10;if(visits[main])pages[main]++;visits[main]=true;nextMain=now+15000;nextSub=now+8000;changed=true;}
      else if(now>=nextSub){if((counts[main]||1)>1){pages[main]++;changed=true;}nextSub=now+8000;}
      pages[main]%=(counts[main]||1);return {main,sub:pages[main],locked,changed};
    },reset(){started=false;},select(index,now=Date.now(),sub=null){main=index;if(sub!==null)pages[main]=sub;nextMain=now+15000;nextSub=now+8000;},snapshot(){return {main,sub:pages[main],locked}},clamp(count){pages[main]%=Math.max(1,count)}};
  }
  let ready=false,timer=null,refreshTimer=null,models=[],schedule=createSchedule(),lastFrame='',lastSecondary=-1,tvOrder=[],paused=false;
  const capacities=new Map(),cache=new WeakMap();
  function put(node,html){if(node&&cache.get(node)!==html){node.innerHTML=html;cache.set(node,html);}}
  function copy(node){if(!node)return '';const n=node.cloneNode(true);n.removeAttribute('id');n.classList.remove('region-hidden','rail-item-hidden');n.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));return n.outerHTML;}
  const unavailable=()=>`<div class="tv-empty">${tr('暫時未能取得數據','DATA TEMPORARILY UNAVAILABLE')}</div>`;
  function quote(node){const symbol=node?.dataset.symbol||'';return `<article class="tv-quote" data-symbol="${esc(symbol)}"><b class="tv-tag">${esc(txt(node,'.quote-name'))}</b><strong class="tv-price">${esc(txt(node,'.quote-price')||'—')}</strong><span class="tv-change ${node?.querySelector('.quote-change')?.classList.contains('up')?'up':node?.querySelector('.quote-change')?.classList.contains('down')?'down':'flat'}">${esc(txt(node,'.quote-change'))}</span>${node?.querySelector('.quote-error')?`<span class="error">${esc(txt(node,'.quote-error'))}</span>`:window.InfoDeskCharts?.sparkHTML(symbol,{tv:tv()})||''}<small>${esc(txt(node,'.quote-time'))}</small></article>`;}
  function fx(node){return `<article class="tv-fx"><div class="tv-fx-name"><b class="tv-tag">${node?.dataset.units==='100'?'100 ':''}${esc(node?.dataset.code||'—')}</b><span>${esc(txt(node,'.fx-label span'))}</span></div><small>${esc(txt(node,'.fx-code'))}</small><strong class="tv-price">${esc(txt(node,'.fx-rate')||'—')}</strong><span class="tv-change ${node?.querySelector('.fx-change')?.classList.contains('up')?'up':node?.querySelector('.fx-change')?.classList.contains('down')?'down':'flat'}">${esc(txt(node,'.fx-change'))}</span><small>${esc(txt(node,'.fx-date')||txt(node,'.error'))}</small></article>`;}
  function model(title,englishTitle,subtitle,source,type,items,capacity){const key=(en()?'en:':'tc:')+type+title,size=Math.min(capacity,capacities.get(key)||capacity);return {title:tr(title,englishTitle),subtitle,source,type,items:items.length?items:[unavailable()],capacity:size,key,pages:chunks(items.length?items:[unavailable()],size)};}
  function weatherItems(){const node=Q('#weather'),summary=txt(node,'.summary');return [copy(node?.querySelector('.weather-now')),copy(node?.querySelector('.warning-box')),...splitText(summary,en()?550:260).map(t=>`<div class="tv-weather-summary">${esc(t)}</div>`),copy(node?.querySelector('.forecast')),copy(node?.querySelector('.fx-note'))].filter(Boolean);}
  function newsItems(){const categories=[['#localNews','本地','LOCAL'],['#worldNews','國際','WORLD'],['#usNews','美股','US MARKETS']];const items=categories.flatMap(([id,tc,eng])=>all(id+' .news-item').map(node=>({node,category:tr(tc,eng),time:Number(node.dataset.published)||0}))).sort((a,b)=>b.time-a.time);
    return items.flatMap(({node,category})=>splitText(txt(node,'.news-title'),en()?220:110).map((title,i,parts)=>`<article class="tv-news-card"><div><b class="tv-tag">${category}</b><small>${esc(txt(node,'.news-source')|| (node.closest('#usNews')?'CNBC':'RTHK'))} · ${esc(txt(node,'.news-time'))}${parts.length>1?' · '+(i+1)+'/'+parts.length:''}</small></div><a href="${esc(node.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></article>`));
  }
  function trendItems(){return all('#trends .trend-row').flatMap(node=>{
    const term=node.querySelector('.trend-term'),articles=[...node.querySelectorAll('.trend-articles a')];
    const related=articles.flatMap(a=>splitText(a.textContent,en()?180:85).map(t=>`<a class="tv-related" href="${esc(a.href)}">${esc(t)}</a>`));
    return chunks(related,2).map((parts,i,pages)=>`<article class="tv-trend-card"><b class="tv-trend-rank">${esc(txt(node,'.trend-rank'))}</b><div><a class="tv-trend-term" href="${esc(term?.href||'#')}">${esc(term?.textContent||'')}</a><small>${esc(txt(node,'.trend-volume'))}${pages.length>1?' · '+(i+1)+'/'+pages.length:''}</small>${parts.join('')}</div></article>`);
    });}
  function buildModels(){const hk=all('#hkMarket .quote'),us=all('#usMarket .quote'),fxs=all('#fx .fx'),routes=all('#transit .route-card');
    if(state.transitResults)tvOrder=window.InfoDeskTransitOrder(CFG.TRANSIT,state.transitResults,tvOrder,tv()||state.transitSorted);
    const ordered=(tvOrder.length?tvOrder.map(k=>routes.find(e=>e.dataset.routeKey===k)).filter(Boolean):routes).filter(e=>tv()||window.InfoDeskDisplay?.region()==='all'||e.dataset.region===window.InfoDeskDisplay?.region());
    const clocks=['HK','US'].map((key,i)=>`<div class="tv-session"><div class="countdown-block${i?' us':''} tv-clock" data-market="${key}"></div><div class="tv-index-grid">${(i?us:hk).slice(0,3).map(quote).join('')||unavailable()}</div></div>`).join('');
    models=[
      model('下一個交易時刻','NEXT MARKET EVENT',tr('港股 × 美股 · 香港時間','HK × US · HONG KONG TIME'),'HKEX / NYSE · '+tr('報價可延遲','QUOTES MAY BE DELAYED'),'clocks',[clocks],1),
      model('市場焦點：港股','HONG KONG WATCHLIST',Q('#hkMarketUpdated').textContent,'YAHOO FINANCE / JINA · '+tr('即日分鐘走勢','INTRADAY MINUTE CHARTS'),'hk',hk.slice(3).map(quote),4),
      model('市場焦點：美股','US WATCHLIST',Q('#usMarketUpdated').textContent,'YAHOO FINANCE / JINA · '+tr('報價可延遲','QUOTES MAY BE DELAYED'),'us',us.slice(3).map(quote),6),
      model('外幣兌港元','FOREIGN CURRENCIES / HKD',tr('市場中間價，非銀行買賣牌價','MID-MARKET RATES, NOT BANK BUY/SELL QUOTES'),'FRANKFURTER · '+Q('#fxUpdated').textContent,'fx',fxs.map(fx),6),
      model('即時交通','LIVE TRANSPORT',Q('#transitUpdated').textContent,tr('運輸署 / 九巴 / 城巴 · 官方預計到站時間','TRANSPORT DEPT / KMB / CITYBUS · ESTIMATED ARRIVALS'),'transit',ordered.map(copy),tv()?6:5),
      model('香港天氣及三天預報','HONG KONG WEATHER',Q('#weatherUpdated').textContent,tr('香港天文台 · 官方觀測及預報','HONG KONG OBSERVATORY · OBSERVATIONS & FORECAST'),'weather',weatherItems(),5),
      model('頭條新聞','TOP HEADLINES',tr('本地 · 國際 · 美股新聞','LOCAL · WORLD · US MARKETS'),'RTHK / GOOGLE NEWS / CNBC','news',newsItems(),3),
      model('香港熱搜','TRENDING IN HONG KONG',Q('#trendsUpdated').textContent,'GOOGLE TRENDS · HK / JINA','trends',trendItems(),4),
      model('指數走勢','INDEX CHARTS',tr('即日分鐘走勢','INTRADAY MINUTE CHARTS'),'YAHOO FINANCE · LIGHTWEIGHT CHARTS','indices-chart',[window.InfoDeskCharts?.indicesHTML({tv:tv()})||unavailable()],1),
      model('焦點股走勢','FOCUS STOCK CHART',tr('即日 · 8 秒換股','INTRADAY · 8 SECONDS PER STOCK'),'YAHOO FINANCE · LIGHTWEIGHT CHARTS','focus-chart',(window.InfoDeskCharts?.preferredWatchlist()||[]).map(s=>window.InfoDeskCharts.focusHTML(typeof s==='string'?s:s.yahoo,{tv:tv()})),1)
    ];
  }
  function wipe(node){node?.getAnimations?.().forEach(a=>a.cancel());node?.animate?.([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:300,easing:'ease-out'});}
  function drawPage(animate=false){if(!models.length)return;const s=schedule.snapshot(),m=models[s.main];schedule.clamp(m.pages.length);const sub=schedule.snapshot().sub,body=Q('#tvPageBody'),items=m.pages[sub];
    put(Q('#tvMainTitle'),esc(m.title));put(Q('#tvMainSubtitle'),esc(m.subtitle));put(Q('#tvMainNumber'),`${String(s.main+1).padStart(2,'0')} / 10`);put(Q('#tvSubNumber'),`${sub+1}/${m.pages.length}`);put(Q('#tvPageSource'),esc(m.source));
    Q('#desktopTransitFilters').innerHTML=s.main===4&&!tv()?window.InfoDeskDisplay.regionControls()+`<button class="text-button" data-desktop-sort>${tr(state.transitSorted?'按到站排序':'固定次序',state.transitSorted?'ARRIVAL ORDER':'FIXED ORDER')}</button>`:'';Q('#desktopTransitFilters').hidden=s.main!==4||tv();
    if(cache.get(body)!==items.join(''))window.InfoDeskCharts?.destroyWithin(body);
    body.className='tv-page-body tv-type-'+m.type;body.style.setProperty('--tv-rows',String(Math.ceil(items.length/(m.type==='hk'?2:['us','fx'].includes(m.type)?3:m.type==='trends'?2:1))));put(body,items.join(''));body.dataset.main=String(s.main);body.dataset.sub=String(sub);body.dataset.pages=String(m.pages.length);
    updateClocks();
    // Paginate whole cards until all fit. Never scroll or clip a bottom half-card.
    const overflow=body.scrollHeight>body.clientHeight+2||[...body.children].some(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2);
    if(overflow&&m.capacity>1){const first=sub*m.capacity;m.capacity--;capacities.set(m.key,m.capacity);m.pages=chunks(m.items,m.capacity);schedule.clamp(m.pages.length);drawPage(false);return;}
    body.querySelectorAll('a').forEach(a=>a.tabIndex=tv()?-1:0);window.InfoDeskCharts?.scan(body);if(animate)wipe(body);const previous=lastFrame;lastFrame=s.main+':'+sub;if(previous!==lastFrame)document.dispatchEvent(new CustomEvent('infodesk:pagechange',{detail:{main:s.main,sub}}));
    all('[data-display-page]').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.displayPage===s.main)));
  }
  function updateClocks(){if(!active()||schedule.snapshot().main!==0)return;all('#tvPageBody .tv-clock').forEach(node=>put(node,window.InfoDeskView.countdownHTML(window.InfoDeskCalendar.status(node.dataset.market))));}
  function drawRail(step=0){const locations=all('#weather .location'),warning=state.warningText||tr('暫時未能取得數據','DATA TEMPORARILY UNAVAILABLE'),warnings=splitText(warning,en()?150:65),warningPage=step%warnings.length,hasWarning=Boolean(Q('#weather .warning-box')&&!Q('#weather .warning-box').classList.contains('none'));
    put(Q('#tvRailTransitTitle'),tr('最快到站','NEXT ARRIVALS'));
    const buses=fastest(CFG.TRANSIT,state.transitResults);
    put(Q('#tvRailTransitBody'),buses.length?buses.map(({route,eta})=>`<div class="tv-fast-row"><b>${esc(route.route)}</b><span>${esc(en()?route.destinationEn:route.destination)}<small>${esc(hkTime(eta.iso))} HKT${window.InfoDeskNetwork?.stale('transit')?' · '+tr('快取','CACHED'):''}</small></span><strong class="${eta.mins<=3?'soon':''}">${esc(eta.mins<=0?tr('即到','DUE'):eta.mins)}<small>${eta.mins<=0?'':tr('分鐘','MINS')}</small></strong></div>`).join(''):`<div class="tv-empty">${tr('暫無班次','NO UPCOMING SERVICE')}</div>`);
    put(Q('#tvRailFxTitle'),tr('主要外幣','KEY CURRENCIES'));
    put(Q('#tvRailFxBody'),['USD','CNY','JPY','GBP','EUR','AUD'].map(code=>{const n=Q('#fx .fx[data-code="'+code+'"]');return `<div class="tv-rail-fx"><div><b class="tv-tag">${code==='JPY'?'100 JPY':code}</b></div><strong>${esc(txt(n,'.fx-rate')||'—')}</strong><span class="${n?.querySelector('.fx-change')?.classList.contains('up')?'up':n?.querySelector('.fx-change')?.classList.contains('down')?'down':'flat'}">${esc(txt(n,'.fx-change')||'—')}</span></div>`}).join(''));
  }
  function drawTicker(step){const items=[...all('#hkMarket .quote,#usMarket .quote').map(n=>{const cls=n.querySelector('.quote-change')?.classList.contains('up')?'up':n.querySelector('.quote-change')?.classList.contains('down')?'down':'flat';return `<span><b>${esc(txt(n,'.quote-name'))}</b> ${esc(txt(n,'.quote-price')||'—')} <em class="${cls}">${cls==='up'?'▲':cls==='down'?'▼':'—'} ${esc(txt(n,'.quote-change'))}</em></span>`}),...all('#fx .fx').map(n=>`<span><b>${esc(n.dataset.units+' '+n.dataset.code+' → HKD')}</b> ${esc(txt(n,'.fx-rate'))} <em class="${n.querySelector('.fx-change')?.classList.contains('up')?'up':n.querySelector('.fx-change')?.classList.contains('down')?'down':'flat'}">${esc(txt(n,'.fx-change'))}</em></span>`)];const pages=chunks(items,3),page=step%pages.length;
    put(Q('#tvTicker'),`<div class="tv-ticker-items">${pages[page].join('')}</div><b class="tv-ticker-page">${page+1}/${pages.length}</b>`);
  }
  function tick(now=Date.now()){if(!ready||!active()||document.hidden)return;const s=paused&&!tv()&&!window.InfoDeskCalendar.commute(now)?{...schedule.snapshot(),changed:false}:schedule.advance(now,window.InfoDeskCalendar.commute(now),models.map(m=>m.pages.length));
    const status=s.locked?tr('通勤時段 · 固定交通','COMMUTE HOURS · TRANSPORT'):tr('TV · 15 秒輪播 / 分頁 8 秒','TV · 15 SEC ROTATION / 8 SEC PAGES');if(Q('#rotationStatus').textContent!==status)Q('#rotationStatus').textContent=status;
    if(s.changed||lastFrame!==s.main+':'+s.sub)drawPage(true);else updateClocks();const secondary=Math.floor(now/8000);if(secondary!==lastSecondary){const previous=lastSecondary;lastSecondary=secondary;if(tv()){drawRail(secondary);drawTicker(secondary);if(previous!==-1)wipe(Q('#tvTicker'));}}
  }
  function refresh(){if(!ready||!active()||document.hidden||refreshTimer)return;refreshTimer=setTimeout(()=>{refreshTimer=null;buildModels();schedule.advance(Date.now(),window.InfoDeskCalendar.commute(),models.map(m=>m.pages.length));drawPage(false);drawRail(Math.floor(Date.now()/8000));drawTicker(Math.floor(Date.now()/8000));},80);}
  function start(){clearInterval(timer);timer=null;if(!ready)return;if(active()&&!document.hidden){buildModels();schedule.reset();lastFrame='';lastSecondary=-1;tick();timer=setInterval(tick,1000);}}
  function init(){const layout=Q('.broadcast-layout');
    layout.insertAdjacentHTML('beforeend',`<section id="tvMain" class="panel tv-only tv-main" aria-label="Broadcast main panel"><header class="tv-main-head"><div><h1 id="tvMainTitle"></h1><p id="tvMainSubtitle"></p></div><div class="tv-page-markers"><b id="tvMainNumber"></b><span id="tvSubNumber"></span></div></header><div id="desktopTransitFilters" hidden></div><div id="tvPageBody" class="tv-page-body"></div><footer id="tvPageSource" class="tv-page-source"></footer><nav id="desktopPageTabs">${Array.from({length:10},(_,i)=>`<button data-display-page="${i}">${String(i+1).padStart(2,'0')}</button>`).join('')}</nav></section><aside id="tvRail" class="tv-only tv-rail"><section class="panel tv-rail-panel"><header><h2 id="tvRailTransitTitle"></h2></header><div id="tvRailTransitBody"></div></section><section class="panel tv-rail-panel"><header><h2 id="tvRailFxTitle"></h2></header><div id="tvRailFxBody"></div></section></aside>`);
    Q('.ticker-window').insertAdjacentHTML('beforeend','<div id="tvTicker" class="tv-only"></div>');ready=true;
    ['hkMarket','usMarket','fx','transit','weather','localNews','worldNews','usNews','trends'].forEach(id=>new MutationObserver(refresh).observe(Q('#'+id),{childList:true,subtree:true,characterData:true}));
    document.addEventListener('infodesk:tv',start);document.addEventListener('infodesk:language',()=>{capacities.clear();refresh()});document.addEventListener('visibilitychange',start);window.addEventListener('pageshow',start);window.addEventListener('pagehide',()=>{clearInterval(timer);timer=null});document.fonts?.ready.then(refresh);
    all('[data-display-page]').forEach(b=>b.onclick=()=>{if(window.InfoDeskCalendar.commute())return;schedule.select(+b.dataset.displayPage);drawPage(true)});Q('#pauseRotation').onclick=()=>{paused=!paused;Q('#pauseRotation').textContent=paused?tr('繼續輪播','RESUME'):tr('暫停輪播','PAUSE');Q('#pauseRotation').setAttribute('aria-pressed',String(paused));};
    document.addEventListener('click',e=>{if(e.target.closest('[data-desktop-sort]')){Q('#transitSort').click();refresh()}});
    // Fixed desktop/TV surfaces never scroll; the normal mobile document still does.
    for(const name of ['wheel','touchmove'])document.addEventListener(name,event=>{if(active())event.preventDefault()},{passive:false});
    document.addEventListener('keydown',event=>{if(active()&&['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))event.preventDefault()});start();
  }
  document.addEventListener('DOMContentLoaded',init);
  return {refresh,tick,chunks,splitText,fastest,createSchedule,start,select(index,sub=null){schedule.select(index,Date.now(),sub);drawPage(true)}};
})();
