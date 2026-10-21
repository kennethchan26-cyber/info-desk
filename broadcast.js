"use strict";
// Presentation layer only. Reuses existing DOM/data; does not fetch any data.
window.InfoDeskView = (() => {
  const C=window.InfoDeskCalendar,Q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
  const history=new Map(),previousNumbers=new Map(),marketPrevious=new Map(),flashTimers=new WeakMap();
  const rendered=new Map();
  function put(selector,html){if(!tv()||rendered.get(selector)!==html){Q(selector).innerHTML=html;rendered.set(selector,html);}}
  let quoteScheduled=false;
  function queueQuotes(){if(quoteScheduled)return;quoteScheduled=true;queueMicrotask(()=>{quoteScheduled=false;renderQuotes()})}
  let slide=0,paused=false,locked=false,rotateAt=Date.now()+15000,lowerIndex=0,latestTransit=[],lastClockTick=null;
  const names=['市場','交通','天氣','市場','熱搜','新聞','美股'];
  const text=v=>window.InfoDeskI18n?.t(v)??v,english=()=>window.InfoDeskI18n?.en()||false;
  const tv=()=>Boolean(window.InfoDeskTV?.enabled());
  const mobile=()=>!tv()&&matchMedia('(max-width:767px)').matches;
  function observe(id,fn){const node=Q(id);new MutationObserver(fn).observe(node,{childList:true});fn();}
  function valueOf(node,selector){return node.querySelector(selector)?.textContent?.trim()||'';}
  function quotes(){return all('#hkMarket .quote,#usMarket .quote').map((e,i)=>({symbol:e.dataset.symbol,name:valueOf(e,'.quote-name'),price:valueOf(e,'.quote-price'),pct:valueOf(e,'.quote-change'),time:valueOf(e,'.quote-time'),timeKey:e.querySelector('[data-datetime]')?.dataset.datetime||'',delta:Number(e.dataset.delta),error:valueOf(e,'.quote-error'),cls:e.querySelector('.quote-change')?.classList.contains('up')?'up':e.querySelector('.quote-change')?.classList.contains('down')?'down':'flat',node:e,index:i}));}
  function arrow(q){return q.cls==='up'?'▲':q.cls==='down'?'▼':'—';}
  function spark(q){return window.InfoDeskCharts?.sparkHTML(q.symbol,{tv:tv()})||'';}
  function focusQuote(q){if(!q)return '<div class="focus-quote"><div class="loading">讀取報價…</div></div>';return `<div class="focus-quote" data-symbol="${esc(q.symbol)}"><div class="index-caption">即日</div><div class="quote-name">${esc(q.name)}</div>${q.error?`<div class="quote-error">${esc(q.error)}</div>`:`<div class="quote-price">${esc(q.price)}</div><div class="quote-change ${q.cls}">${esc(q.pct)}</div>${spark(q)}`}<div class="quote-time">${esc(q.time)}</div></div>`;}
  function flash(node,key,num){if(!node||!Number.isFinite(num))return;const prev=previousNumbers.get(key);previousNumbers.set(key,num);if(prev!==undefined&&num!==prev){clearTimeout(flashTimers.get(node));node.classList.remove('flash-up','flash-down');void node.offsetWidth;node.classList.add(num>prev?'flash-up':'flash-down');flashTimers.set(node,setTimeout(()=>node.classList.remove('flash-up','flash-down'),500));}}

  function renderQuotes(){const qs=quotes();for(const q of qs){if(!q.price)continue;const price=Number(q.price.replaceAll(',',''));const h=history.get(q.symbol)||[];if(h.at(-1)?.time!==q.timeKey||h.at(-1)?.price!==price){h.push({price,time:q.timeKey});if(h.length>48)h.shift();history.set(q.symbol,h);}
      flash(q.node,'quote:'+q.symbol,price);q.node.querySelector('.spark-holder')?.remove();const holder=document.createElement('div');holder.className='spark-holder';holder.innerHTML=spark(q);q.node.append(holder);
    }
    const byName=new Map(qs.map(q=>[q.symbol,q]));const hk=CFG.HK_MARKET.slice(0,3).map(x=>byName.get(x.yahoo)),us=CFG.US_MARKET.slice(0,3).map(x=>byName.get(x.yahoo));
    Q('#hkIndexFocus').innerHTML=hk.map(focusQuote).join('');Q('#usIndexFocus').innerHTML=us.map(focusQuote).join('');
    all('.focus-quote').forEach(e=>{const n=Number(valueOf(e,'.quote-price').replaceAll(',',''));if(valueOf(e,'.quote-price'))flash(e,'focus:'+valueOf(e,'.quote-name'),n)});
    Q('#railIndices').innerHTML=[...hk,...us].map(q=>q?`<div class="rail-quote" data-symbol="${esc(q.symbol)}"><b>${esc(q.name)}</b><strong class="rail-value">${esc(q.price||'—')}</strong><span class="${q.cls}">${q.error?'暫缺':arrow(q)+' '+esc(q.pct)}</span></div>`:'<div class="rail-quote">讀取中…</div>').join('');
    all('#railIndices .rail-quote').forEach(e=>{const n=Number(valueOf(e,'strong').replaceAll(',',''));flash(e,'rail:'+valueOf(e,'b'),n)});
    updateTicker();
  }
  function updateTicker(){if(!Q('#tickerTrack'))return;const qs=quotes(),items=qs.map(q=>`<span class="ticker-item"><b>${esc(q.name)}</b><span class="ticker-value">${esc(q.price||'—')}</span><span class="${q.cls}">${q.error?'暫缺':arrow(q)+' '+esc(q.pct)}</span></span>`);
    all('#fx .fx').forEach(e=>items.push(`<span class="ticker-item"><b>${esc(e.dataset.units+' '+e.dataset.code+' → HKD')}</b><span class="ticker-value">${esc(valueOf(e,'.fx-rate'))}</span><span class="${e.querySelector('.fx-change')?.classList.contains('up')?'up':e.querySelector('.fx-change')?.classList.contains('down')?'down':'flat'}">${esc(valueOf(e,'.fx-change'))}</span></span>`));
    // Retain the existing warnings/headlines in addition to the expanded financial ticker.
    items.push(`<span class="ticker-item alert">${esc(state.warningText)}</span>`);state.headlines.slice(0,2).forEach(t=>items.push(`<span class="ticker-item">${esc(t)}</span>`));
    const content=items.length?items.join(''):'<span class="ticker-item">正在取得公開數據…</span>';
    const html=`<div class="ticker-set">${content}</div><div class="ticker-set" aria-hidden="true">${content}</div>`;
    if(tv()&&rendered.get('#tickerTrack')===html)return;
    put('#tickerTrack',html);window.InfoDeskTV?.tickerChanged();
    all('.ticker-set').forEach((set,i)=>set.querySelectorAll('.ticker-item').forEach(e=>{const raw=valueOf(e,'.ticker-value');if(raw&&raw!=='—')flash(e,'ticker:'+i+':'+valueOf(e,'b'),Number(raw.replaceAll(',','')))}));
  }
  function renderWeather(){const temps=all('#weather .location').map(e=>{flash(e,'weather:'+valueOf(e,'.location-name'),parseFloat(valueOf(e,'.temp')));return `<span>${esc(valueOf(e,'.location-name').replace('氣象站','').replace('數碼港附近：',''))}<strong>${esc(valueOf(e,'.temp'))}</strong></span>`});Q('#weatherCompact').innerHTML=temps.length?temps.join('')+`<span class="warning-mini">${esc(state.warningText)}</span>`:`<span>${Q('#weather .error')?'暫時未能取得數據':'正在取得天文台資料…'}</span>`;}
  function transit(results){latestTransit=(state.transitOrder.length?state.transitOrder:CFG.TRANSIT.map(r=>r.key)).flatMap(key=>{const i=CFG.TRANSIT.findIndex(r=>r.key===key),r=CFG.TRANSIT[i];return results[i]?.status==='fulfilled'&&(tv()||!window.InfoDeskDisplay||window.InfoDeskDisplay.region()==='all'||r.region===window.InfoDeskDisplay.region())?results[i].value.slice(0,1).map(eta=>({r,eta})):[]});renderNextBus();
    all('#transit .route-card').forEach(row=>row.querySelectorAll('.eta').forEach((e,j)=>{const i=CFG.TRANSIT.findIndex(r=>r.key===row.dataset.routeKey),n=results[i]?.value?.[j]?.mins;if(Number.isFinite(n))flash(e,'eta:'+row.dataset.routeKey+':'+j,n)}));
  }
  function renderNextBus(){const next=latestTransit[0],cached=window.InfoDeskNetwork?.stale('transit');
    put('#nextBus',next?`<span>${text(cached?'快取':'下一班車')}</span><b>${esc(next.r.route)} ${english()?'TO '+esc(next.r.destinationEn):'往'+esc(next.r.destination)}</b><strong>${cached?esc(next.eta.time):Math.max(0,Math.ceil((new Date(next.eta.iso)-Date.now())/60000))}<small> ${cached?'HKT':text('分鐘')}</small></strong>`:`<span>${text('下一班車')}</span><b>${text('暫無到站資料')}</b>`);
  }
  function countdownHTML(s){if(s.unknown)return `<div class="countdown-label">${text(s.name)}<span class="market-state">${text('未確認')}</span></div><div class="countdown-number">—</div><div class="countdown-hours">${text(s.reason)}</div>`;
    const date=english()?window.InfoDeskI18n.date(s.next.time):C.dateKey(s.next.time,'Asia/Hong_Kong').split('-').reverse().join('/');
    const event=english()?text(s.name)+' '+({'開市':'OPENS IN','收市':'CLOSES IN','午休':'LUNCH BREAK IN','午市開市':'AFTERNOON OPENS IN'}[s.next.type]||text(s.next.type)):s.name+s.next.type;
    const duration=english()?C.duration(s.remaining).replaceAll('小時','HRS').replaceAll('分鐘','MINS').replaceAll('分','MINS').replaceAll('秒','SECS').replaceAll('天','DAYS'):C.duration(s.remaining);
    return `<div class="countdown-label">${event}<span class="market-state ${s.trading?'trading':''}">${text(s.reason)}</span></div><div class="countdown-number ${s.remaining<=300000?'urgent':''}">${duration}</div><div class="countdown-hours">${text(s.hours)}</div><div class="countdown-date">${text('下一事件')} ${date} · ${hkTime(s.next.time)} HKT</div>`;
  }
  function marketTick(now=Date.now()){for(const key of ['HK','US']){const s=C.status(key,now),prev=marketPrevious.get(key);if(prev?.next&&lastClockTick!==null&&now-lastClockTick<10000&&prev.next.time>lastClockTick&&prev.next.time<=now)enqueueAlert('市場時刻',english()?`${text(s.name)} ${prev.next.type==='開市'?'OPEN':prev.next.type==='收市'?'CLOSED':text(prev.next.type)}${prev.next.early?' (EARLY CLOSE)':''}`:`${s.name}${prev.next.type}${prev.next.early&&prev.next.type==='收市'?'（提早收市）':''}`,3);marketPrevious.set(key,s);const html=countdownHTML(s);if(!tv()||slide===0)put('#countdown'+key,html);put('#mini'+key,html);}lastClockTick=now;}
  function showSlide(n){slide=n;all('.stage').forEach((e,i)=>{e.classList.toggle('active',i===n);e.inert=!mobile()&&i!==n;});all('[data-slide]').forEach(e=>{e.setAttribute('aria-current',String(+e.dataset.slide===n));e.disabled=locked&&!mobile();});}
  function rotationTick(now=Date.now()){if(tv()||window.InfoDeskDisplay?.paged())return;const nextLock=C.commute(now)&&!mobile();if(nextLock!==locked){locked=nextLock;rotateAt=now+15000;if(locked)showSlide(1);else showSlide(slide);}
    if(mobile()){all('.stage').forEach(e=>e.inert=false);Q('#rotationStatus').textContent='香港視角 · 全部資料';return;}
    if(locked){if(slide!==1)showSlide(1);Q('#rotationStatus').textContent='通勤時段 · 固定交通';Q('#pauseRotation').disabled=true;return;}
    Q('#pauseRotation').disabled=false;Q('#rotationStatus').textContent=tv()?(english()?'TV · AUTO ROTATE 15 SEC':'TV · 15 秒自動輪播'):paused?'輪播已暫停':'15 秒輪播 · 香港視角';
    // Pause while a person is interacting with a stage link, to avoid moving their focus.
    if((tv()||!paused)&&now>=rotateAt&&(tv()||!Q('.stage-deck').contains(document.activeElement))){showSlide((slide+1)%all('.stage').length);rotateAt=now+15000;}
  }
  function lowerThird(){if(state.alertShowing)return;const nodes=all('#localNews .news-item,#worldNews .news-item,#usNews .news-item');nodes.sort((a,b)=>Number(b.dataset.published)-Number(a.dataset.published));const news=[...new Map(nodes.map(e=>[e.href,e])).values()];
    const data=quotes().filter(q=>q.price),slot=lowerIndex++;let html,category='新聞';if(slot%4===3&&data.length){const q=data[Math.floor(slot/4)%data.length],price=Number(q.price.replaceAll(',','')),pct=parseFloat(q.pct),delta=Number.isFinite(q.delta)?q.delta:price-price/(1+pct/100);category='市場';html=`<div class="lower-data"><b>${esc(q.name)}</b><strong>${esc(q.price)}</strong><span class="${q.cls}">${arrow(q)} ${Math.abs(delta).toFixed(2)}　${Math.abs(pct).toFixed(2)}%</span></div>`;}else if(slot%4===2&&window.InfoDeskSignals?.getTrends().length){const trends=window.InfoDeskSignals.getTrends(),t=trends[Math.floor(slot/4)%trends.length];category='熱搜';html=`<a href="${esc(t.articles[0]?.link||t.link)}" target="_blank" rel="noopener noreferrer">${esc(t.title)}${t.traffic?' · '+esc(t.traffic)+' 次搜尋':''}</a>`;}else if(news.length){const n=news[slot%news.length];html=`<a href="${esc(n.href)}" target="_blank" rel="noopener noreferrer">${esc(valueOf(n,'.news-title'))}</a>`;}else{category=names[slide];html=esc(state.warningText||'你嘅世界，一眼掌握。');}
    if(category==='新聞'&&news[slot%news.length]?.closest('#usNews'))category='美股';
    Q('#lowerCategory').textContent=text(category);Q('#lowerHeadline').innerHTML=html.replace(' 次搜尋',english()?' SEARCHES':' 次搜尋');if(!tv()){Q('#lowerHeadline').classList.remove('wipe');void Q('#lowerHeadline').offsetWidth;Q('#lowerHeadline').classList.add('wipe');}
  }
  function init(){observe('#hkMarket',queueQuotes);observe('#usMarket',queueQuotes);observe('#weather',renderWeather);observe('#fx',()=>{all('#fx .fx').forEach(e=>flash(e,'fx:'+e.dataset.code,+valueOf(e,'.fx-rate')));updateTicker();});
    const fit=()=>{if(mobile()||tv())return;const top=Q('.stage-deck').getBoundingClientRect().top+window.scrollY,footer=Q('.lower-third').getBoundingClientRect().height+Q('.ticker-shell').getBoundingClientRect().height;document.documentElement.style.setProperty('--deck-height',Math.max(250,window.innerHeight-top-footer-34)+'px')};
    new ResizeObserver(fit).observe(Q('.topbar'));new ResizeObserver(fit).observe(Q('.quickbar'));new ResizeObserver(fit).observe(Q('#appNotices'));window.addEventListener('resize',fit);fit();
    document.addEventListener('infodesk:language',()=>{renderQuotes();renderWeather();renderNextBus();marketTick();rotationTick();lowerThird()});
    document.addEventListener('infodesk:tv',()=>{rendered.clear();rotateAt=Date.now()+15000;showSlide(slide);rotationTick();fit();updateTicker()});
    all('[data-slide]').forEach(e=>e.addEventListener('click',()=>{if(locked&&!mobile())return;showSlide(+e.dataset.slide);rotateAt=Date.now()+15000;}));
    Q('#pauseRotation').onclick=()=>{paused=!paused;Q('#pauseRotation').setAttribute('aria-pressed',String(paused));Q('#pauseRotation').textContent=paused?'繼續輪播':'暫停輪播';rotateAt=Date.now()+15000;rotationTick();};
    matchMedia('(max-width:767px)').addEventListener('change',()=>{showSlide(slide);rotationTick();});
    marketTick();rotationTick();lowerThird();setInterval(()=>{if(tv()&&document.hidden)return;marketTick();rotationTick();renderNextBus();const live=Math.floor(Date.now()/5000)%2?'香港':hkTime();if(Q('#liveLocation').textContent!==live)Q('#liveLocation').textContent=live;},1000);setInterval(()=>{if(!tv()||!document.hidden)lowerThird()},10000);
  }
  document.addEventListener('DOMContentLoaded',init);
  return {updateTicker,flash,transit,marketTick,rotationTick,countdownHTML,showSlide,lowerThird};
})();
