"use strict";
// Presentation only: reuses public data already held by the dashboard.
window.InfoDeskTVRail=(()=>{
  const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],en=()=>window.InfoDeskI18n?.en(),tr=(a,b)=>en()?b:a;
  const text=(n,s)=>n?.querySelector(s)?.textContent?.trim()||'',cache=new WeakMap();
  function createSchedule(interval=10000,offset=5000){let started=false,indices=[0,0],next=[0,0],locked=false;
    return {step(now,lengths,lock=false){if(!started){started=true;next=[now+interval,now+offset];}if(locked&&!lock)next[0]=now+interval;locked=lock;
      for(let i=0;i<2;i++)if(!(i===0&&lock)&&now>=next[i]){indices[i]=(indices[i]+1)%Math.max(1,lengths[i]);next[i]=now+interval;}return [...indices];
    },select(slot,index,now=Date.now()){indices[slot]=index;next[slot]=now+interval;},snapshot:()=>[...indices]};
  }
  let schedule=null,last=['',''];
  function put(node,html){if(node&&cache.get(node)!==html){node.innerHTML=html;cache.set(node,html);}}
  function quoteRows(selector,count,movers=false){let rows=all(selector);if(movers)rows=rows.slice(3).sort((a,b)=>Math.abs(parseFloat(text(b,'.quote-change'))||0)-Math.abs(parseFloat(text(a,'.quote-change'))||0));return rows.slice(0,count).map(n=>`<div class="rail-stock" data-symbol="${esc(n.dataset.symbol)}"><b>${esc(({'^HSI':tr('恒指','HSI'),'^HSCE':tr('國指','HSCEI'),'HSTECH.HK':tr('恒科','HSTECH'),'^DJI':tr('道指','DJI'),'^GSPC':tr('標普','S&P'),'^IXIC':tr('納指','IXIC')})[n.dataset.symbol]||text(n,'.quote-name'))}</b><strong data-flash-key="rail-stock:${esc(n.dataset.symbol)}" data-flash-value="${esc(text(n,'.quote-price'))}">${esc(text(n,'.quote-price')||'—')}</strong><span class="${n.querySelector('.quote-change')?.className||''}">${n.querySelector('.up')?'▲':n.querySelector('.down')?'▼':'—'} ${esc(text(n,'.quote-change')||'—')}</span></div>`).join('');}
  function render(type){const T=window.InfoDeskTVPanels,none=`<div class="tv-empty">${tr('暫時未能取得數據','DATA TEMPORARILY UNAVAILABLE')}</div>`;
    const marketPanel=window.InfoDeskMarketPulse?.rail(type);if(marketPanel)return marketPanel;
    if(type==='arrivals'){const buses=T.fastest(CFG.TRANSIT,state.transitResults);return [tr('最快到站','NEXT ARRIVALS'),buses.map(({route,eta})=>`<div class="tv-fast-row"><b>${esc(route.route)}</b><span>${esc(en()?route.destinationEn:route.destination)}<small>${esc(hkTime(eta.iso))} HKT</small></span><strong class="${eta.mins<=3?'soon':''}" data-flash-key="rail-bus:${route.key}" data-flash-value="${eta.mins}">${eta.mins<=0?tr('即到','DUE'):eta.mins}<small>${eta.mins<=0?'':tr('分','MIN')}</small></strong></div>`).join('')||none];}
    if(type==='indices')return [tr('六大指數','MAJOR INDICES'),quoteRows('#hkMarket .quote',3)+quoteRows('#usMarket .quote',3)];
    if(type==='hk-movers'||type==='us-movers')return [type==='hk-movers'?tr('港股升跌焦點','HK MOVERS'):tr('美股升跌焦點','US MOVERS'),quoteRows(type==='hk-movers'?'#hkMarket .quote':'#usMarket .quote',3,true)||none];
    if(type==='trends')return [tr('香港熱搜','HK TRENDING'),all('#trends .trend-row').slice(0,3).map((n,i)=>`<div class="rail-trend"><b>${i+1}</b><strong>${esc(text(n,'.trend-term'))}</strong></div>`).join('')||none];
    if(type==='fx')return [tr('主要外幣','KEY CURRENCIES'),['USD','CNY','JPY','GBP','EUR','AUD'].map(code=>{const n=q(`#fx .fx[data-code="${code}"]`);return `<div class="tv-rail-fx"><b class="tv-tag">${code==='JPY'?'100 JPY':code}</b><strong data-flash-key="rail-fx:${code}" data-flash-value="${esc(text(n,'.fx-rate'))}">${esc(text(n,'.fx-rate')||'—')}</strong><span class="${n?.querySelector('.fx-change')?.className||''}">${esc(text(n,'.fx-change')||'—')}</span></div>`}).join('')];
    if(type==='forecast')return [tr('三天天氣預報','3-DAY FORECAST'),all('#weather .day').slice(0,3).map(n=>`<div class="rail-day"><b>${esc(text(n,'.day-date'))}</b><strong>${esc(text(n,'.day-temp'))}</strong></div>`).join('')||none];
    if(type==='heatmap')return [tr('納指熱力圖','NASDAQ 100 HEATMAP'),window.InfoDeskHeatmap?.html(true)||none];
    if(type==='clocks')return [tr('下一交易時刻','NEXT MARKET EVENT'),['HK','US'].map(m=>`<div class="rail-clock">${window.InfoDeskView.countdownHTML(window.InfoDeskCalendar.status(m))}</div>`).join('')];
    if(type==='us-news'){const n=q('#usNews .news-item'),parts=T.splitText(text(n,'.news-title'),en()?220:200),part=Math.floor(Date.now()/8000)%parts.length;return [tr('美股新聞','US MARKET NEWS'),n?`<div class="rail-news"><b>CNBC${parts.length>1?' · '+(part+1)+'/'+parts.length:''}</b><strong>${esc(parts[part])}</strong></div>`:none];}
    if(type==='warning'){const parts=T.splitText(state.warningText,en()?180:85),part=Math.floor(Date.now()/8000)%parts.length;return [tr('天氣警告','WEATHER WARNING'),`<div class="rail-warning">${esc(parts[part])}</div>`];}
    return [tr('資料','DATA'),none];
  }
  function tick(now=Date.now()){if(!window.InfoDeskTV?.enabled()||!q('#tvRail'))return;const cfg=CFG.TV_RAIL||{},lists=[cfg.UPPER||['arrivals'],cfg.LOWER||['fx']];schedule||=createSchedule(cfg.INTERVAL_MS||10000,cfg.OFFSET_MS||5000);
    const warning=q('#weather .warning-box'),weatherLock=warning&&!warning.classList.contains('none'),busLock=window.InfoDeskTVPanels.fastest(CFG.TRANSIT,state.transitResults).some(x=>x.eta.mins<=3&&Date.parse(x.eta.iso)>now-60000)&&!window.InfoDeskNetwork?.stale('transit');
    const forced=weatherLock?'warning':busLock?'arrivals':null,indices=schedule.step(now,lists.map(a=>a.length),Boolean(forced));
    [0,1].forEach(i=>{const prefix=i?'Fx':'Transit',type=i===0&&forced?forced:lists[i][indices[i]%lists[i].length],body=q(`#tvRail${prefix}Body`),title=q(`#tvRail${prefix}Title`),[heading,html]=render(type),changed=last[i]!==type;
      put(title,esc(heading));let counter=title.parentElement.querySelector('.rail-counter');if(!counter){counter=document.createElement('b');counter.className='rail-counter';title.parentElement.append(counter)}counter.textContent=`${indices[i]+1}/${lists[i].length}${i===0&&forced?' · '+tr('鎖定','HOLD'):''}`;
      body.dataset.railType=type;put(body,html);if(changed){body.getAnimations?.().forEach(a=>a.cancel());body.animate?.([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:300,easing:'ease-out'});last[i]=type;}
      body.querySelectorAll('[data-flash-value]').forEach(n=>{const value=Number(n.dataset.flashValue.replaceAll(',',''));if(Number.isFinite(value))window.InfoDeskView?.flash(n.parentElement,n.dataset.flashKey,value)});window.InfoDeskHeatmap?.scan(body);
    });
  }
  return {tick,createSchedule,render,select(slot,index){schedule||=createSchedule();schedule.select(slot,index);tick()},inspect:()=>({pages:schedule?.snapshot(),types:[...last]})};
})();
