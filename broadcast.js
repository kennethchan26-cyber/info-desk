"use strict";
// Presentation layer only. Reuses existing DOM/data; does not fetch any data.
window.InfoDeskView = (() => {
  const C=window.InfoDeskCalendar,Q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
  const history=new Map(),previousNumbers=new Map(),marketPrevious=new Map();
  let slide=0,paused=false,locked=false,rotateAt=Date.now()+15000,lowerIndex=0,latestTransit=[],lastClockTick=null;
  const names=['市場','交通','天氣','市場','新聞'];
  const mobile=()=>matchMedia('(max-width:767px)').matches;
  function observe(id,fn){const node=Q(id);new MutationObserver(fn).observe(node,{childList:true});fn();}
  function valueOf(node,selector){return node.querySelector(selector)?.textContent?.trim()||'';}
  function quotes(){return all('#hkMarket .quote,#usMarket .quote').map((e,i)=>({name:valueOf(e,'.quote-name'),price:valueOf(e,'.quote-price'),pct:valueOf(e,'.quote-change'),time:valueOf(e,'.quote-time'),delta:Number(e.dataset.delta),error:valueOf(e,'.quote-error'),cls:e.querySelector('.quote-change')?.classList.contains('up')?'up':e.querySelector('.quote-change')?.classList.contains('down')?'down':'flat',node:e,index:i}));}
  function arrow(q){return q.cls==='up'?'▲':q.cls==='down'?'▼':'—';}
  function spark(q){const h=history.get(q.name)||[];if(h.length<2)return '<div class="spark-pending">等待第二筆報價</div>';
    const values=h.map(p=>p.price),lo=Math.min(...values),hi=Math.max(...values),range=hi-lo||Math.max(1,hi*.001),pts=values.map((v,i)=>[i/(h.length-1)*180,32-(v-lo)/range*28]);
    const path=pts.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),last=pts.at(-1),color=q.cls==='up'?'#00c853':q.cls==='down'?'#ff3b30':'#a39ac2';
    return `<svg class="sparkline" viewBox="0 0 180 38" preserveAspectRatio="none" role="img" aria-label="本頁收到的 ${h.length} 筆報價走勢"><path d="${path} L180 38 L0 38 Z" fill="${color}" opacity=".12"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${color}"/></svg>`;
  }
  function focusQuote(q){if(!q)return '<div class="focus-quote"><div class="loading">讀取報價…</div></div>';return `<div class="focus-quote"><div class="index-caption">即日</div><div class="quote-name">${esc(q.name)}</div>${q.error?`<div class="quote-error">${esc(q.error)}</div>`:`<div class="quote-price">${esc(q.price)}</div><div class="quote-change ${q.cls}">${esc(q.pct)}</div>${spark(q)}`}<div class="quote-time">${esc(q.time)}</div></div>`;}
  function flash(node,key,num){const prev=previousNumbers.get(key);previousNumbers.set(key,num);if(prev!==undefined&&Number.isFinite(num)&&num!==prev){node.classList.remove('flash-up','flash-down');void node.offsetWidth;node.classList.add(num>prev?'flash-up':'flash-down');}}
  function renderQuotes(){const qs=quotes();for(const q of qs){if(!q.price)continue;const price=Number(q.price.replaceAll(',',''));const h=history.get(q.name)||[];if(h.at(-1)?.time!==q.time||h.at(-1)?.price!==price){h.push({price,time:q.time});if(h.length>48)h.shift();history.set(q.name,h);}
      flash(q.node,'quote:'+q.name,price);q.node.querySelector('.spark-holder')?.remove();const holder=document.createElement('div');holder.className='spark-holder';holder.innerHTML=spark(q);q.node.append(holder);
    }
    const byName=new Map(qs.map(q=>[q.name,q]));const hk=CFG.HK_MARKET.slice(0,3).map(x=>byName.get(x.name)),us=CFG.US_MARKET.slice(0,3).map(x=>byName.get(x.name));
    Q('#hkIndexFocus').innerHTML=hk.map(focusQuote).join('');Q('#usIndexFocus').innerHTML=us.map(focusQuote).join('');
    all('.focus-quote').forEach(e=>{const n=Number(valueOf(e,'.quote-price').replaceAll(',',''));if(valueOf(e,'.quote-price'))flash(e,'focus:'+valueOf(e,'.quote-name'),n)});
    Q('#railIndices').innerHTML=[...hk,...us].map(q=>q?`<div class="rail-quote"><b>${esc(q.name)}</b><strong>${esc(q.price||'—')}</strong><span class="${q.cls}">${q.error?'暫缺':arrow(q)+' '+esc(q.pct)}</span></div>`:'<div class="rail-quote">讀取中…</div>').join('');
    updateTicker();
  }
  function updateTicker(){if(!Q('#tickerTrack'))return;const qs=quotes(),items=qs.map(q=>`<span class="ticker-item"><b>${esc(q.name)}</b> ${esc(q.price||'—')} <span class="${q.cls}">${q.error?'暫缺':arrow(q)+' '+esc(q.pct)}</span></span>`);
    all('#fx .fx').forEach(e=>items.push(`<span class="ticker-item"><b>${esc(valueOf(e,'.fx-code'))}</b> ${esc(valueOf(e,'.fx-rate'))}</span>`));
    // Retain the existing warnings/headlines in addition to the expanded financial ticker.
    items.push(`<span class="ticker-item alert">${esc(state.warningText)}</span>`);state.headlines.slice(0,2).forEach(t=>items.push(`<span class="ticker-item">${esc(t)}</span>`));
    const content=items.length?items.join(''):'<span class="ticker-item">正在取得公開數據…</span>';
    Q('#tickerTrack').innerHTML=`<div class="ticker-set">${content}</div><div class="ticker-set" aria-hidden="true">${content}</div>`;
  }
  function renderWeather(){const temps=all('#weather .location').map(e=>{flash(e,'weather:'+valueOf(e,'.location-name'),parseFloat(valueOf(e,'.temp')));return `<span>${esc(valueOf(e,'.location-name').replace('氣象站','').replace('數碼港附近：',''))}<strong>${esc(valueOf(e,'.temp'))}</strong></span>`});Q('#weatherCompact').innerHTML=temps.length?temps.join('')+`<span class="warning-mini">${esc(state.warningText)}</span>`:`<span>${Q('#weather .error')?'暫時未能取得數據':'正在取得天文台資料…'}</span>`;}
  function transit(results){latestTransit=CFG.TRANSIT.flatMap((r,i)=>results[i]?.status==='fulfilled'?results[i].value.slice(0,1).map(eta=>({r,eta})):[]);renderNextBus();
    all('#transit .route-card').forEach((row,i)=>row.querySelectorAll('.eta').forEach((e,j)=>{const n=results[i]?.value?.[j]?.mins;if(Number.isFinite(n))flash(e,'eta:'+i+':'+j,n)}));
  }
  function renderNextBus(){const next=latestTransit.filter(x=>new Date(x.eta.iso).getTime()>Date.now()-60000).sort((a,b)=>new Date(a.eta.iso)-new Date(b.eta.iso))[0];
    Q('#nextBus').innerHTML=next?`<span>下一班車</span><b>${esc(next.r.route)} 往${esc(next.r.destination)}</b><strong>${Math.max(0,Math.ceil((new Date(next.eta.iso)-Date.now())/60000))}<small> 分鐘</small></strong>`:'<span>下一班車</span><b>暫無到站資料</b>';
  }
  function countdownHTML(s){if(s.unknown)return `<div class="countdown-label">${s.name}<span class="market-state">未確認</span></div><div class="countdown-number">—</div><div class="countdown-hours">${s.reason}</div>`;
    const date=s.next.day.split('-').reverse().join('/');return `<div class="countdown-label">${s.name}${s.next.type}<span class="market-state ${s.trading?'trading':''}">${s.reason}</span></div><div class="countdown-number ${s.remaining<=300000?'urgent':''}">${C.duration(s.remaining)}</div><div class="countdown-hours">${s.hours}</div><div class="countdown-date">下一事件 ${date} · ${hkTime(s.next.time)} HKT</div>`;
  }
  function marketTick(now=Date.now()){for(const key of ['HK','US']){const s=C.status(key,now),prev=marketPrevious.get(key);if(prev?.next&&lastClockTick!==null&&now-lastClockTick<10000&&prev.next.time>lastClockTick&&prev.next.time<=now)enqueueAlert('市場時刻',`${s.name}${prev.next.type}${prev.next.early&&prev.next.type==='收市'?'（提早收市）':''}`,3);marketPrevious.set(key,s);const html=countdownHTML(s);Q('#countdown'+key).innerHTML=html;Q('#mini'+key).innerHTML=html;}lastClockTick=now;}
  function showSlide(n){slide=n;all('.stage').forEach((e,i)=>{e.classList.toggle('active',i===n);e.inert=!mobile()&&i!==n;});all('[data-slide]').forEach(e=>{e.setAttribute('aria-current',String(+e.dataset.slide===n));e.disabled=locked&&!mobile();});}
  function rotationTick(now=Date.now()){const nextLock=C.commute(now)&&!mobile();if(nextLock!==locked){locked=nextLock;rotateAt=now+15000;if(locked)showSlide(1);else showSlide(slide);}
    if(mobile()){all('.stage').forEach(e=>e.inert=false);Q('#rotationStatus').textContent='香港視角 · 全部資料';return;}
    if(locked){if(slide!==1)showSlide(1);Q('#rotationStatus').textContent='通勤時段 · 固定交通';Q('#pauseRotation').disabled=true;return;}
    Q('#pauseRotation').disabled=false;Q('#rotationStatus').textContent=paused?'輪播已暫停':'15 秒輪播 · 香港視角';
    // Pause while a person is interacting with a stage link, to avoid moving their focus.
    if(!paused&&now>=rotateAt&&!Q('.stage-deck').contains(document.activeElement)){showSlide((slide+1)%5);rotateAt=now+15000;}
  }
  function lowerThird(){if(state.alertShowing)return;const nodes=all('#localNews .news-item,#worldNews .news-item');const dateOf=e=>{const t=valueOf(e,'.news-time'),m=t.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}:\d{2})/);return m?Date.parse(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:00+08:00`):0;};nodes.sort((a,b)=>dateOf(b)-dateOf(a));const news=[...new Map(nodes.map(e=>[e.href,e])).values()];
    const data=quotes().filter(q=>q.price),slot=lowerIndex++;let html,category='新聞';if(slot%4===3&&data.length){const q=data[Math.floor(slot/4)%data.length],price=Number(q.price.replaceAll(',','')),pct=parseFloat(q.pct),delta=Number.isFinite(q.delta)?q.delta:price-price/(1+pct/100);category='市場';html=`<div class="lower-data"><b>${esc(q.name)}</b><strong>${esc(q.price)}</strong><span class="${q.cls}">${arrow(q)} ${Math.abs(delta).toFixed(2)}　${Math.abs(pct).toFixed(2)}%</span></div>`;}else if(news.length){const n=news[slot%news.length];html=`<a href="${esc(n.href)}" target="_blank" rel="noopener noreferrer">${esc(valueOf(n,'.news-title'))}</a>`;}else{category=names[slide];html=esc(state.warningText||'你嘅世界，一眼掌握。');}
    Q('#lowerCategory').textContent=category;Q('#lowerHeadline').innerHTML=html;Q('#lowerHeadline').classList.remove('wipe');void Q('#lowerHeadline').offsetWidth;Q('#lowerHeadline').classList.add('wipe');
  }
  function init(){observe('#hkMarket',renderQuotes);observe('#usMarket',renderQuotes);observe('#weather',renderWeather);observe('#fx',()=>{all('#fx .fx').forEach(e=>flash(e,'fx:'+valueOf(e,'.fx-code'),+valueOf(e,'.fx-rate')));updateTicker();});
    all('[data-slide]').forEach(e=>e.addEventListener('click',()=>{if(locked&&!mobile())return;showSlide(+e.dataset.slide);rotateAt=Date.now()+15000;}));
    Q('#pauseRotation').onclick=()=>{paused=!paused;Q('#pauseRotation').setAttribute('aria-pressed',String(paused));Q('#pauseRotation').textContent=paused?'繼續輪播':'暫停輪播';rotateAt=Date.now()+15000;rotationTick();};
    matchMedia('(max-width:767px)').addEventListener('change',()=>{showSlide(slide);rotationTick();});
    marketTick();rotationTick();lowerThird();setInterval(()=>{marketTick();rotationTick();renderNextBus();Q('#liveLocation').textContent=Math.floor(Date.now()/5000)%2?'香港':hkTime();},1000);setInterval(lowerThird,10000);
  }
  document.addEventListener('DOMContentLoaded',init);
  return {updateTicker,transit,marketTick,rotationTick,countdownHTML,showSlide};
})();
