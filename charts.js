"use strict";
// Public market charts only. No Gmail, OAuth, cookies or private browser state is read.
// Native data: Yahoo's undocumented Spark endpoint via the existing public-data reader.
window.InfoDeskCharts = (() => {
  const RANGE={"1d":{interval:"5m",label:["即日","DAY"]},"5d":{interval:"5m",label:["5 日","5 DAYS"]},"1mo":{interval:"1d",label:["1 個月","1 MONTH"]},"1y":{interval:"1d",label:["1 年","1 YEAR"]}};
  const BATCH=20,PERIOD=60000,STAGGER=24000,START_DELAY=12000,records=new Map(),mounted=new Map(),inflight=new Map(),lastAttempt=new Map();
  const failureUntil=new Map(),scheduled=new Map(),batchDiagnostics=new Map();let timer=null,modal=null,modalSymbol=null,focusCursor=0,lastFocus=0,observer=null;
  const english=()=>Boolean(window.InfoDeskI18n?.en()),L=(tc,en)=>english()?en:tc;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const config=()=>window.DASHBOARD_CONFIG||{},allItems=()=>[...(config().HK_MARKET||[]),...(config().US_MARKET||[])];
  const itemFor=symbol=>allItems().find(x=>x.yahoo===symbol)||{yahoo:symbol,name:symbol};
  const translatedName=symbol=>window.InfoDeskI18n?.t(itemFor(symbol).name)||itemFor(symbol).name;
  const fmt=value=>Number.isFinite(value)?value.toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
  const key=(symbol,range)=>symbol+'|'+range;
  const timeLabel=time=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(time)*1000));
  const dayLabel=time=>new Intl.DateTimeFormat(english()?'en-GB':'zh-HK',{timeZone:'Asia/Hong_Kong',day:'2-digit',month:english()?'short':'2-digit'}).format(new Date(Number(time)*1000));
  const market=symbol=>(config().HK_MARKET||[]).some(x=>x.yahoo===symbol)?'HK':'US';
  const trading=symbol=>Boolean(window.InfoDeskCalendar?.status(market(symbol),Date.now())?.trading);
  function publicError(error){
    // Diagnostics intentionally contain only bounded public-provider classifications,
    // never response bodies, headers, arbitrary exception text or private state.
    const message=String(error?.message||error||''),http=message.match(/HTTP\s+(\d{3})/i);
    if(http)return {code:'HTTP_'+http[1],status:Number(http[1])};
    if(error?.name==='AbortError'||error?.name==='TimeoutError'||/timeout|timed out|aborted|逾時/i.test(message))return {code:'TIMEOUT'};
    if(error instanceof SyntaxError||/invalid.*response|JSON|public response/i.test(message))return {code:'INVALID_PUBLIC_RESPONSE'};
    if(/No complete intraday|Missing series|no quote/i.test(message))return {code:'MISSING_INTRADAY_SERIES'};
    if(/fetch|network|connect/i.test(message))return {code:'NETWORK_ERROR'};
    return {code:'PUBLIC_PROVIDER_ERROR'};
  }
  function parseSeries(row,range='1d'){
    const response=row?.response?.[0],meta=response?.meta||{},times=response?.timestamp||[],values=response?.indicators?.quote?.[0]?.close||[];
    const points=[...new Map(times.flatMap((time,i)=>Number.isFinite(Number(time))&&values[i]!==null&&Number.isFinite(Number(values[i]))&&Number(values[i])>0?[[Number(time),{time:Number(time),value:Number(values[i])}]]:[])).values()].sort((a,b)=>a.time-b.time);
    if(points.length<2)throw new Error('No complete intraday series');
    const previous=Number(meta.previousClose??meta.chartPreviousClose),last=points[points.length-1];
    const regular=meta.currentTradingPeriod?.regular,sessionEnd=Number(regular?.end),sessionStart=Number(regular?.start),session=meta.exchangeTimezoneName||null;
    let sessionDate=null;try{sessionDate=new Intl.DateTimeFormat('en-CA',{timeZone:session||'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(last.time*1000));}catch{}
    return {symbol:row.symbol,range,points,previous:Number.isFinite(previous)&&previous>0?previous:null,price:last.value,delta:Number.isFinite(previous)&&previous>0?last.value-previous:null,pct:Number.isFinite(previous)&&previous>0?(last.value/previous-1)*100:null,high:Number.isFinite(Number(meta.regularMarketDayHigh))?Number(meta.regularMarketDayHigh):null,low:Number.isFinite(Number(meta.regularMarketDayLow))?Number(meta.regularMarketDayLow):null,time:last.time,firstTime:points[0].time,session,sessionDate,sessionStart:Number.isFinite(sessionStart)?sessionStart:null,sessionEnd:Number.isFinite(sessionEnd)?sessionEnd:null,closedSessionComplete:range==='1d'&&Number.isFinite(sessionEnd)?Date.now()/1000>=sessionEnd&&last.time+300>=sessionEnd:null,currency:meta.currency||'',granularity:meta.dataGranularity||RANGE[range].interval,received:Date.now(),source:'Yahoo Finance',stale:false};
  }
  function parseResponse(body){if(typeof body!=='string')return body;const start=body.indexOf('{'),end=body.lastIndexOf('}');if(start<0||end<start)throw new Error('Invalid chart response');return JSON.parse(body.slice(start,end+1).replace(/\r?\n\s*/g,''));}
  function targetURL(symbols,range='1d'){return 'https://query1.finance.yahoo.com/v7/finance/spark?symbols='+encodeURIComponent(symbols.join(','))+'&range='+range+'&interval='+RANGE[range].interval;}
  async function fetchBatch(symbols,range='1d'){
    const unique=[...new Set(symbols)].filter(s=>allItems().some(x=>x.yahoo===s));if(!unique.length)return;
    const taskKey=unique.join(',')+'|'+range;if(inflight.has(taskKey))return inflight.get(taskKey);
    const diagnostic={symbols:[...unique],range,transport:location.protocol==='chrome-extension:'?'Yahoo direct':'Jina public reader',started:Date.now(),completed:null,durationMs:null,status:'pending',lastError:null,missing:[]};
    batchDiagnostics.set(taskKey,diagnostic);while(batchDiagnostics.size>40)batchDiagnostics.delete(batchDiagnostics.keys().next().value);
    const work=(async()=>{
      unique.forEach(s=>lastAttempt.set(key(s,range),Date.now()));
      try{
        const target=targetURL(unique,range),extension=location.protocol==='chrome-extension:';
        const response=extension?await (window.InfoDeskNetwork?.fetch||fetch)(target,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(25000)}):null;
        if(response&&!response.ok)throw new Error('HTTP '+response.status);
        const body=extension?await response.json():parseResponse(await fetchJinaText('https://r.jina.ai/'+target.replace('https:','http:').replaceAll('&','%26'),25000,{'X-Cache-Tolerance':'60'}));
        if(body.spark?.error)throw new Error(body.spark.error.description||'Missing series');
        const rows=new Map((body.spark?.result||[]).map(row=>[row.symbol,row]));
        for(const symbol of unique){
          try{const record=parseSeries(rows.get(symbol),range);record.stale=Boolean(window.InfoDeskNetwork?.stale('markets'));records.set(key(symbol,range),record);failureUntil.delete(key(symbol,range));}
          catch(error){diagnostic.missing.push({symbol,...publicError(error)});failureUntil.set(key(symbol,range),Date.now()+PERIOD);const old=records.get(key(symbol,range));if(old)old.stale=true;}
        }
        diagnostic.status=diagnostic.missing.length?'partial':'success';
      }catch(error){diagnostic.status='error';diagnostic.lastError=publicError(error);for(const symbol of unique){failureUntil.set(key(symbol,range),Date.now()+(/429|limit/i.test(String(error))?5*PERIOD:PERIOD));const old=records.get(key(symbol,range));if(old)old.stale=true;}}
      finally{diagnostic.completed=Date.now();diagnostic.durationMs=diagnostic.completed-diagnostic.started;inflight.delete(taskKey);renderAll();document.dispatchEvent(new CustomEvent('infodesk:charts'));}
    })();inflight.set(taskKey,work);return work;
  }
  function refreshVisible(){
    if(document.hidden)return;const symbols=allItems().map(x=>x.yahoo);
    for(let i=0;i<symbols.length;i+=BATCH){
      const batch=symbols.slice(i,i+BATCH),id=batch.join(',');if(scheduled.has(id))continue;
      const handle=setTimeout(()=>{scheduled.delete(id);if(document.hidden)return;const now=Date.now(),due=batch.filter(s=>now-(lastAttempt.get(key(s,'1d'))||0)>=PERIOD-1000&&(failureUntil.get(key(s,'1d'))||0)<=now);if(due.length)fetchBatch(due);},START_DELAY+Math.floor(i/BATCH)*STAGGER);scheduled.set(id,handle);
    }
    if(modal?.open&&modalSymbol){const range=modal.dataset.range||'1d';if(range!=='1d')ensure(modalSymbol,range);}
  }
  function ensure(symbol,range){const now=Date.now();if(range==='1d'){if(!lastAttempt.has(key(symbol,range)))refreshVisible();return;}if(now-(lastAttempt.get(key(symbol,range))||0)>=PERIOD&&(failureUntil.get(key(symbol,range))||0)<=now)fetchBatch([symbol],range);}
  function widgetSymbol(symbol){
    // Use actual index tickers, not CFD substitutes, for the six indices.
    const fixed={'^HSI':'HSI:HSI','^HSCE':'HSI:HSCEI','HSTECH.HK':'HSI:HSTECH','^DJI':'DJ:DJI','^GSPC':'SP:SPX','^IXIC':'NASDAQ:IXIC','BRK-B':'NYSE:BRK.B',TSM:'NYSE:TSM',JPM:'NYSE:JPM'};
    return fixed[symbol]||itemFor(symbol).tv||(/^\d+\.HK$/.test(symbol)?'HKEX:'+Number(symbol.split('.')[0]):'NASDAQ:'+symbol);
  }
  function shell(symbol,mode='index',options={}){const range=RANGE[options.range]?options.range:'1d';return `<div class="chart-slot chart-${mode==='modal'?'detail':safe(mode)}" data-chart-symbol="${safe(symbol)}" data-chart-mode="${safe(mode)}" data-chart-range="${range}"${options.tv?' data-chart-tv="true"':''}></div>`;}
  function indicesHTML(options={}){return `<div class="charts-index-grid">${[...(config().HK_MARKET||[]).slice(0,3),...(config().US_MARKET||[]).slice(0,3)].map(x=>shell(x.yahoo,'index',options)).join('')}</div>`;}
  function preferredWatchlist(){const hk=(config().HK_MARKET||[]).slice(3),us=(config().US_MARKET||[]).slice(3);const usTrading=window.InfoDeskCalendar?.status('US',Date.now())?.trading;return(usTrading?[...us,...hk]:[...hk,...us]).map(x=>x.yahoo);}
  function metadataHTML(symbol,record,mode){
    const quote=[...document.querySelectorAll('#hkMarket .quote,#usMarket .quote')].find(node=>node.dataset.symbol===symbol);
    const livePrice=Number(quote?.querySelector('.quote-price')?.textContent.replaceAll(',','')),livePct=parseFloat(quote?.querySelector('.quote-change')?.textContent),liveDelta=Number(quote?.dataset.delta);
    const price=livePrice>0?livePrice:record?.price,delta=Number.isFinite(liveDelta)?liveDelta:record?.delta,pct=Number.isFinite(livePct)?livePct:record?.pct,cls=delta>0?'up':delta<0?'down':'flat',arrow=delta>0?'▲':delta<0?'▼':'—';
    return `<div class="chart-card-heading"><b class="chart-name">${safe(translatedName(symbol))}</b><span class="chart-session ${trading(symbol)?'trading':''}">${L(trading(symbol)?'交易中':'收市',trading(symbol)?'OPEN':'CLOSED')}</span></div><div class="chart-quote"><strong>${fmt(price)}</strong><span class="${cls}">${delta==null?'—':arrow+' '+fmt(Math.abs(delta))+' '+fmt(Math.abs(pct))+'%'}</span></div>${mode==='focus'||mode==='modal'?`<div class="chart-high-low"><span>${L('即日最高','DAY HIGH')} <b>${fmt(record?.high)}</b></span><span>${L('即日最低','DAY LOW')} <b>${fmt(record?.low)}</b></span></div>`:''}`;
  }
  function mountedVisible(node){return node.isConnected&&node.getClientRects().length>0&&node.clientWidth>0&&node.clientHeight>0;}
  function plotSize(node){return {width:Math.max(0,Math.floor(Number(node?.clientWidth)||0)),height:Math.max(0,Math.floor(Number(node?.clientHeight)||0))};}
  function resizeChart(entry){
    if(!entry.chart||!entry.plot?.isConnected)return;const size=plotSize(entry.plot);
    if(!size.width||!size.height||(entry.lastSize?.width===size.width&&entry.lastSize?.height===size.height))return;
    // These are unscaled logical dimensions; bounding rectangles include the
    // outer AirPlay transform and therefore must never size the inner canvas.
    entry.lastSize=size;entry.chart.resize(size.width,size.height);
  }
  function observeChartSize(entry){
    if(typeof ResizeObserver!=='function')return;
    entry.resizeObserver=new ResizeObserver(()=>{if(entry.resizeFrame!=null)return;entry.resizeFrame=requestAnimationFrame(()=>{entry.resizeFrame=null;resizeChart(entry);});});
    entry.resizeObserver.observe(entry.plot);
  }
  function clearChart(entry){entry.resizeObserver?.disconnect();entry.resizeObserver=null;if(entry.resizeFrame!=null)cancelAnimationFrame(entry.resizeFrame);entry.resizeFrame=null;entry.lastSize=null;try{entry.chart?.remove()}catch{}entry.chart=null;entry.series=null;entry.markers=null;entry.line=null;entry.dataKey=null;entry.kind=null;}
  function cardInit(entry){const {node,mode,symbol}=entry;node.classList.add('chart-card');node.classList.toggle('chart-tv',entry.tv);node.classList.toggle('chart-spark',mode==='spark');node.innerHTML=`${mode==='spark'?'':'<div class="chart-metadata"></div>'}<div class="chart-plot"><div class="chart-loading">${mode==='spark'?'…':L('正在讀取即日走勢','LOADING INTRADAY CHART')}</div></div>${mode==='spark'?'':'<div class="chart-time-axis"></div><div class="chart-caption"></div>'}`;entry.plot=node.querySelector('.chart-plot');entry.axis=node.querySelector('.chart-time-axis');entry.meta=node.querySelector('.chart-metadata');entry.caption=node.querySelector('.chart-caption');node.setAttribute('aria-label',translatedName(symbol)+' '+L('走勢','CHART'));}
  function fallback(entry){
    if(entry.kind==='widget'||entry.kind==='tv-unavailable')return;clearChart(entry);entry.plot.replaceChildren();
    // A cross-origin widget cannot guarantee 26px text. TV must not silently show
    // unreadable vendor labels; retain the real quote and show an honest status.
    if(entry.tv){entry.kind='tv-unavailable';entry.plot.innerHTML='<div class="chart-loading">'+L('即日走勢暫時未能取得','INTRADAY CHART UNAVAILABLE')+'</div>';if(entry.axis)entry.axis.textContent='';return;}
    entry.kind='widget';
    const frame=document.createElement('iframe');const params=new URLSearchParams({symbol:widgetSymbol(entry.symbol),range:entry.range,lang:english()?'en':'zh_TW',compact:entry.mode==='spark'?'1':'0',tv:entry.tv?'1':'0'});
    frame.src='chart-widget.html?'+params.toString();frame.title=translatedName(entry.symbol)+' TradingView';frame.sandbox='allow-scripts allow-popups';frame.referrerPolicy='no-referrer';frame.loading='lazy';frame.className='chart-widget';frame.setAttribute('scrolling','no');entry.plot.append(frame);
    if(entry.axis)entry.axis.textContent='';if(entry.caption)entry.caption.textContent=L('TradingView 備援 · 資料／字體由供應商控制','TradingView fallback · provider controls data / type');
  }
  function axisHTML(record,range){if(!record)return '';const count=Math.min(4,record.points.length);return Array.from({length:count},(_,i)=>record.points[Math.round((record.points.length-1)*i/(count-1))]).map(p=>`<span>${safe(range==='1d'?timeLabel(p.time):dayLabel(p.time))}</span>`).join('');}
  function render(entry){
    if(!mountedVisible(entry.node))return;const record=records.get(key(entry.symbol,entry.range));
    if(entry.meta){const html=metadataHTML(entry.symbol,record,entry.mode);if(entry.cachedMeta!==html){entry.meta.innerHTML=html;entry.cachedMeta=html;}}
    resizeChart(entry);
    if(!record){if(failureUntil.has(key(entry.symbol,entry.range)))fallback(entry);return;}
    if(!window.LightweightCharts){fallback(entry);return;}
    const dataKey=record.received+':'+record.time+':'+record.price+':'+english();if(entry.dataKey===dataKey)return;
    const LC=window.LightweightCharts,compact=entry.mode==='spark',green=record.previous===null||record.price>=record.previous,color=green?'#00C853':'#FF3B30';
    if(entry.kind!=='native'){
      clearChart(entry);entry.plot.replaceChildren();
      const size=plotSize(entry.plot);entry.lastSize=size;
      entry.chart=LC.createChart(entry.plot,{autoSize:false,width:Math.max(1,size.width),height:Math.max(1,size.height),layout:{background:{type:LC.ColorType.Solid,color:'transparent'},textColor:'#bdb8cc',fontSize:entry.tv?26:12,fontFamily:'"Barlow Condensed", "Noto Sans TC", sans-serif',attributionLogo:false},grid:{vertLines:{visible:false},horzLines:{visible:!compact,color:'#ffffff12'}},rightPriceScale:{visible:!compact,borderVisible:false,minimumWidth:entry.tv?92:54,scaleMargins:{top:.12,bottom:.12}},leftPriceScale:{visible:false},timeScale:{visible:false,rightOffset:3,fixLeftEdge:true,fixRightEdge:true,minBarSpacing:.1},localization:{locale:english()?'en-HK':'zh-HK',timeFormatter:timeLabel},crosshair:{mode:LC.CrosshairMode.Hidden},handleScroll:false,handleScale:false,kineticScroll:{mouse:false,touch:false}});
      observeChartSize(entry);
      entry.series=entry.chart.addSeries(LC.AreaSeries,{lineWidth:1,lineColor:color,topColor:green?'rgba(0,200,83,.24)':'rgba(255,59,48,.24)',bottomColor:green?'rgba(0,200,83,.01)':'rgba(255,59,48,.01)',priceLineVisible:!compact,lastValueVisible:!compact,priceLineWidth:1,priceLineStyle:LC.LineStyle.Dashed,crosshairMarkerVisible:false,lastPriceAnimation:LC.LastPriceAnimationMode.Disabled});entry.kind='native';
    }
    entry.series.applyOptions({lineColor:color,topColor:green?'rgba(0,200,83,.24)':'rgba(255,59,48,.24)',bottomColor:green?'rgba(0,200,83,.01)':'rgba(255,59,48,.01)',autoscaleInfoProvider:base=>{const info=base();if(info?.priceRange&&record.previous!==null){info.priceRange.minValue=Math.min(info.priceRange.minValue,record.previous);info.priceRange.maxValue=Math.max(info.priceRange.maxValue,record.previous);}return info;}});
    entry.series.setData(record.points);
    if(entry.line)entry.series.removePriceLine(entry.line);entry.line=record.previous===null?null:entry.series.createPriceLine({price:record.previous,color:'#a2a0aa',lineWidth:1,lineStyle:LC.LineStyle.Dashed,axisLabelVisible:!compact,title:''});
    const last=record.points[record.points.length-1],marker=[{time:last.time,position:'atPriceMiddle',price:last.value,color,shape:'circle',size:compact?.5:1}];
    if(entry.markers)entry.markers.setMarkers(marker);else entry.markers=LC.createSeriesMarkers(entry.series,marker,{autoScale:false});
    entry.chart.timeScale().fitContent();entry.dataKey=dataKey;
    if(entry.axis)entry.axis.innerHTML=axisHTML(record,entry.range);
    if(entry.caption)entry.caption.innerHTML=`${record.stale?L('快取 · ','CACHED · '):''}Yahoo Finance · ${safe(record.granularity)} · ${safe(record.sessionDate||'')} ${safe(timeLabel(record.time))} HKT · ${L('可延遲','MAY BE DELAYED')}`;
    resizeChart(entry);
  }
  function renderAll(){for(const [node,entry]of mounted){if(!node.isConnected){clearChart(entry);mounted.delete(node);continue;}render(entry);}}
  function mount(node,options={}){
    if(!node)return;const symbol=options.symbol||node.dataset.chartSymbol;if(!allItems().some(x=>x.yahoo===symbol))return;
    const mode=options.compact?'spark':options.mode||node.dataset.chartMode||'index',range=RANGE[options.range||node.dataset.chartRange]?options.range||node.dataset.chartRange:'1d',tv=options.tv??(node.dataset.chartTv==='true'||Boolean(window.InfoDeskTV?.enabled()));
    const previous=mounted.get(node);if(previous&&previous.symbol===symbol&&previous.mode===mode&&previous.range===range&&previous.tv===tv){render(previous);ensure(symbol,range);return previous;}
    if(previous)clearChart(previous);const entry={node,symbol,mode,range,tv};mounted.set(node,entry);cardInit(entry);render(entry);ensure(symbol,range);return entry;
  }
  function scan(root=document){for(const [node,entry]of mounted)if(!node.isConnected){clearChart(entry);mounted.delete(node);}if(root.matches?.('[data-chart-symbol]'))mount(root);root.querySelectorAll?.('[data-chart-symbol]').forEach(node=>{if(mountedVisible(node))mount(node);});}
  function destroyWithin(root){for(const [node,entry]of mounted)if(node===root||root.contains(node)){clearChart(entry);mounted.delete(node);}}
  function open(symbol){
    if(window.InfoDeskTV?.enabled()||!allItems().some(x=>x.yahoo===symbol))return;
    if(!modal){modal=document.createElement('dialog');modal.id='chartModal';modal.className='chart-modal';modal.innerHTML='<div class="chart-modal-bar"><strong>INFO//DESK</strong><nav class="chart-range-controls"></nav><button class="chart-close" type="button" aria-label="Close">×</button></div><div class="chart-modal-content"></div><div class="chart-credit"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™</a> · Copyright (с) 2025 TradingView, Inc.</div>';document.body.append(modal);modal.querySelector('.chart-close').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});modal.addEventListener('close',()=>{destroyWithin(modal);modal.querySelector('.chart-modal-content').replaceChildren();document.body.classList.remove('chart-modal-open');modalSymbol=null;});}
    modalSymbol=symbol;document.body.classList.add('chart-modal-open');if(!modal.open)modal.showModal();setModalRange('1d');
  }
  function setModalRange(range){
    modal.dataset.range=range;const content=modal.querySelector('.chart-modal-content');destroyWithin(content);content.innerHTML=shell(modalSymbol,'modal',{range});
    modal.querySelector('.chart-range-controls').innerHTML=Object.entries(RANGE).map(([code,r])=>`<button type="button" data-range="${code}" aria-pressed="${range===code}">${safe(r.label[english()?1:0])}</button>`).join('');modal.querySelectorAll('[data-range]').forEach(btn=>btn.onclick=()=>setModalRange(btn.dataset.range));scan(content);
  }
  function focusTick(){const now=Date.now();if(document.hidden||now-lastFocus<8000)return;lastFocus=now;const symbols=preferredWatchlist();document.querySelectorAll('[data-chart-focus-rotate]').forEach(node=>{if(!mountedVisible(node)||!symbols.length)return;destroyWithin(node);node.innerHTML=shell(symbols[focusCursor%symbols.length],'focus');node.animate?.([{transform:'translateX(4%)',clipPath:'inset(0 0 0 100%)'},{transform:'translateX(0)',clipPath:'inset(0 0 0 0)'}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});scan(node)});focusCursor++;}
  function init(){
    document.addEventListener('click',event=>{if(event.target.closest('button,a')||window.InfoDeskTV?.enabled())return;const target=event.target.closest('[data-symbol],[data-chart-symbol]');if(target)open(target.dataset.symbol||target.dataset.chartSymbol);});
    document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){const symbol=event.target?.dataset?.symbol;if(symbol){event.preventDefault();open(symbol);}}});
    let queued=false;observer=new MutationObserver(list=>{if(queued||!list.some(m=>m.target.closest?.('.stage-deck,#tvMain,#hkMarket,#usMarket,#railIndices')&&!m.target.closest?.('.chart-card')))return;queued=true;requestAnimationFrame(()=>{queued=false;scan(document);});});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    document.addEventListener('infodesk:language',()=>{for(const entry of mounted.values()){entry.dataKey=null;render(entry)}if(modal?.open)setModalRange(modal.dataset.range)});
    document.addEventListener('infodesk:tv',()=>{if(modal?.open)modal.close();for(const entry of mounted.values())clearChart(entry);mounted.clear();scan(document);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){scan(document);refreshVisible()}});window.addEventListener('resize',()=>scan(document));
    scan(document);refreshVisible();timer=setInterval(()=>{refreshVisible();scan(document)},PERIOD);setInterval(focusTick,1000);
  }
  document.addEventListener('DOMContentLoaded',init);
  return {mount,scan,hydrate:scan,destroyWithin,refreshVisible,open,parseSeries,parseResponse,publicError,plotSize,targetURL,widgetSymbol,markup:shell,sparkHTML:(symbol,options={})=>shell(symbol,'spark',options),indicesHTML,indexMarkup:indicesHTML,focusHTML:(symbol,options={})=>shell(symbol,'focus',options),focusMarkup:symbol=>shell(symbol,'focus'),preferredWatchlist,timeLabel,axisHTML,inspect:()=>({mounted:mounted.size,inflight:inflight.size,batch:BATCH,stagger:STAGGER,period:PERIOD,batches:[...batchDiagnostics.values()].map(r=>({...r,symbols:[...r.symbols],missing:[...r.missing]})),records:[...records.values()].map(({points,...r})=>({...r,points:points.length})),failures:[...failureUntil.keys()]})};
})();
