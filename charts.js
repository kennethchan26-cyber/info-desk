"use strict";
// Public market charts only. No Gmail, OAuth, cookies or private browser state is read.
// Native data: Yahoo's undocumented Spark endpoint via the existing public-data reader.
window.InfoDeskCharts = (() => {
  const RANGE={"1d":{interval:"1m",label:["即日","DAY"]},"5d":{interval:"5m",label:["5 日","5 DAYS"]},"1mo":{interval:"1d",label:["1 個月","1 MONTH"]},"1y":{interval:"1d",label:["1 年","1 YEAR"]}};
  const BATCH=20,PERIOD=60000,STAGGER=24000,START_DELAY=12000,records=new Map(),mounted=new Map(),inflight=new Map(),lastAttempt=new Map();
  const failureUntil=new Map(),scheduled=new Map(),batchDiagnostics=new Map();let timer=null,modal=null,modalSymbol=null,focusCursor=0,lastFocus=0,observer=null;
  const details=new Map(),detailAttempts=new Map(),detailBusy=new Set(),detailTimes=[];let detailNext=0;
  const english=()=>Boolean(window.InfoDeskI18n?.en()),L=(tc,en)=>english()?en:tc;
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const config=()=>window.DASHBOARD_CONFIG||{},allItems=()=>[...(config().HK_MARKET||[]),...(config().US_MARKET||[])];
  const knownSymbol=symbol=>allItems().some(x=>x.yahoo===symbol)||(window.INFO_DESK_NASDAQ?.stocks||[]).some(x=>x.symbol===symbol);
  const itemFor=symbol=>allItems().find(x=>x.yahoo===symbol)||{yahoo:symbol,name:(window.INFO_DESK_NASDAQ?.stocks||[]).find(x=>x.symbol===symbol)?.name||symbol};
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
    const response=row?.response?.[0],meta=response?.meta||{},times=response?.timestamp||[],bars=response?.indicators?.quote?.[0]||{},values=bars.close||[];
    const points=[...new Map(times.flatMap((time,i)=>Number.isFinite(Number(time))&&values[i]!==null&&Number.isFinite(Number(values[i]))&&Number(values[i])>0?[[Number(time),{time:Number(time),value:Number(values[i])}]]:[])).values()].sort((a,b)=>a.time-b.time);
    if(points.length<2)throw new Error('No complete intraday series');
    const previous=Number(meta.previousClose??meta.chartPreviousClose),last=points[points.length-1];
    const regular=meta.currentTradingPeriod?.regular,sessionEnd=Number(regular?.end),sessionStart=Number(regular?.start),session=meta.exchangeTimezoneName||null;
    let sessionDate=null;try{sessionDate=new Intl.DateTimeFormat('en-CA',{timeZone:session||'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(last.time*1000));}catch{}
    const field=name=>[...new Map(times.flatMap((time,i)=>bars[name]?.[i]!=null&&Number.isFinite(Number(bars[name][i]))?[[Number(time),{time:Number(time),value:Number(bars[name][i])}]]:[])).values()].sort((a,b)=>a.time-b.time);
    const highs=field('high'),lows=field('low'),volume=field('volume'),highPoint=highs.reduce((a,b)=>!a||b.value>a.value?b:a,null),lowPoint=lows.reduce((a,b)=>!a||b.value<a.value?b:a,null);
    return {symbol:row.symbol,range,points,volume,highPoint,lowPoint,previous:Number.isFinite(previous)&&previous>0?previous:null,price:last.value,delta:Number.isFinite(previous)&&previous>0?last.value-previous:null,pct:Number.isFinite(previous)&&previous>0?(last.value/previous-1)*100:null,high:highPoint?.value??(Number.isFinite(Number(meta.regularMarketDayHigh))?Number(meta.regularMarketDayHigh):null),low:lowPoint?.value??(Number.isFinite(Number(meta.regularMarketDayLow))?Number(meta.regularMarketDayLow):null),time:last.time,firstTime:points[0].time,session,sessionDate,sessionStart:Number.isFinite(sessionStart)?sessionStart:null,sessionEnd:Number.isFinite(sessionEnd)?sessionEnd:null,closedSessionComplete:range==='1d'&&Number.isFinite(sessionEnd)?Date.now()/1000>=sessionEnd&&last.time+300>=sessionEnd:null,currency:meta.currency||'',granularity:meta.dataGranularity||RANGE[range].interval,received:Date.now(),source:'Yahoo Finance',stale:false};
  }
  function detailURL(symbol,range='1d'){return 'https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?range='+range+'&interval='+RANGE[range].interval;}
  function onScreen(node){if(!mountedVisible(node))return false;const r=node.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;}
  async function fetchDetail(entry){const {symbol,range}=entry,k=key(symbol,range),target=detailURL(symbol,range);detailBusy.add(k);detailAttempts.set(k,Date.now());
    const lb=range==='1d'&&window.InfoDeskLongbridge?.series(symbol);if(lb){try{const r=parseSeries(lb,range);r.source='Longbridge';r.received=Date.parse(lb.fetchedAt);details.set(k,r)}finally{detailBusy.delete(k);renderAll()}return;}
    try{let body;if(location.protocol==='chrome-extension:'){const res=await(window.InfoDeskNetwork?.fetch||fetch)(target,{credentials:'omit',signal:AbortSignal.timeout(25000)});if(!res.ok)throw new Error('HTTP '+res.status);body=await res.json();}else body=parseResponse(await fetchJinaText('https://r.jina.ai/'+target.replace('https:','http:').replaceAll('&','%26'),25000,{'X-Cache-Tolerance':'60'}));
      if(!body.chart?.result?.[0])throw new Error('Missing series');const r=parseSeries({symbol,response:body.chart.result},range);r.stale=Boolean(window.InfoDeskNetwork?.stale('markets'));details.set(k,r);
    }catch(error){const r=details.get(k);if(r)r.stale=true;if(/429|limit/i.test(String(error)))detailAttempts.set(k,Date.now()+4*PERIOD);}
    finally{detailBusy.delete(k);renderAll();}
  }
  function detailTick(){if(document.hidden||Date.now()<detailNext)return;const now=Date.now();while(detailTimes.length&&detailTimes[0]<=now-PERIOD)detailTimes.shift();if(detailTimes.length>=8)return;
    const candidates=[...mounted.values()].filter(e=>e.mode!=='spark'&&onScreen(e.node)&&(!modal?.open||modal.contains(e.node))&&!detailBusy.has(key(e.symbol,e.range))&&now-(detailAttempts.get(key(e.symbol,e.range))||0)>=PERIOD).sort((a,b)=>(detailAttempts.get(key(a.symbol,a.range))||0)-(detailAttempts.get(key(b.symbol,b.range))||0));
    const e=candidates[0];if(e){detailTimes.push(now);detailNext=now+1500;fetchDetail(e);}
  }
  function segmentsFor(record){
    if(market(record.symbol)!=='HK'||!['1d','5d'].includes(record.range))return [record.points];
    const groups=new Map();for(const p of record.points){const t=timeLabel(p.time),minutes=Number(t.slice(0,2))*60+Number(t.slice(3));if(minutes>=720&&minutes<780)continue;const group=Math.floor((p.time+28800)/86400)+':'+(minutes<720?'AM':'PM');if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p);}return [...groups.values()];
  }
  function axisTimes(record,range){if(!record)return [];if(range!=='1d'){const n=Math.min(4,record.points.length);return Array.from({length:n},(_,i)=>record.points[Math.round((record.points.length-1)*i/Math.max(1,n-1))].time);}
    const start=record.firstTime,end=record.time,hours=[];for(let t=Math.ceil(start/3600)*3600;t<=end;t+=3600)hours.push(t);
    if(market(record.symbol)==='HK'){const selected=hours.filter(t=>[10,12,14,16].includes(Number(timeLabel(t).slice(0,2))));if(selected.length)return selected;}
    if(hours.length<=4)return hours;return Array.from({length:4},(_,i)=>hours[Math.round(i*(hours.length-1)/3)]);
  }
  function chartTimeline(record){const times=new Set(record.points.map(p=>p.time));axisTimes(record,record.range).forEach(t=>times.add(t));
    if(market(record.symbol)==='HK'&&['1d','5d'].includes(record.range)){const step=record.granularity==='1m'?60:300,days=new Set(record.points.map(p=>Math.floor((p.time+28800)/86400)));for(const day of days)for(let t=day*86400+4*3600;t<day*86400+5*3600&&t<=record.time;t+=step)times.add(t);}
    return [...times].sort((a,b)=>a-b);
  }
  function parseResponse(body){if(typeof body!=='string')return body;const start=body.indexOf('{'),end=body.lastIndexOf('}');if(start<0||end<start)throw new Error('Invalid chart response');return JSON.parse(body.slice(start,end+1).replace(/\r?\n\s*/g,''));}
  function targetURL(symbols,range='1d'){return 'https://query1.finance.yahoo.com/v7/finance/spark?symbols='+encodeURIComponent(symbols.join(','))+'&range='+range+'&interval='+RANGE[range].interval;}
  async function fetchBatch(symbols,range='1d'){
    await window.InfoDeskLongbridge?.load();
    const unique=[...new Set(symbols)].filter(knownSymbol).filter(symbol=>{const lb=range==='1d'&&window.InfoDeskLongbridge?.series(symbol);if(!lb)return true;try{const r=parseSeries(lb,range);r.source='Longbridge';r.received=Date.parse(lb.fetchedAt);records.set(key(symbol,range),r);details.delete(key(symbol,range));lastAttempt.set(key(symbol,range),Date.now());failureUntil.delete(key(symbol,range));return false}catch{return true}});if(!unique.length){renderAll();return;}
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
    if(modal?.open&&modalSymbol)ensure(modalSymbol,modal.dataset.range||'1d');
  }
  function ensure(symbol,range){const now=Date.now();if(range==='1d'&&allItems().some(x=>x.yahoo===symbol)){if(!lastAttempt.has(key(symbol,range)))refreshVisible();return;}if(now-(lastAttempt.get(key(symbol,range))||0)>=PERIOD&&(failureUntil.get(key(symbol,range))||0)<=now)fetchBatch([symbol],range);}
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
    const price=record?.price??(livePrice>0?livePrice:null),delta=record?.delta??(Number.isFinite(liveDelta)?liveDelta:null),pct=record?.pct??(Number.isFinite(livePct)?livePct:null),cls=delta>0?'up':delta<0?'down':'flat',arrow=delta>0?'▲':delta<0?'▼':'—';
    return `<div class="chart-card-heading"><b class="chart-name">${safe(translatedName(symbol))}</b><span class="chart-session ${trading(symbol)?'trading':''}">${L(trading(symbol)?'交易中':'收市',trading(symbol)?'OPEN':'CLOSED')}</span></div><div class="chart-quote"><strong class="chart-live-price">${fmt(price)}</strong><span class="${cls}">${delta==null?'—':arrow+' '+fmt(Math.abs(delta))+' '+fmt(Math.abs(pct))+'%'}</span></div><div class="chart-high-low"><span>${L('前收','PREV')} <b>${fmt(record?.previous)}</b></span><span>${L('高','H')} <b>${fmt(record?.high)}</b></span><span>${L('低','L')} <b>${fmt(record?.low)}</b></span></div>`;
  }
  function mountedVisible(node){return node.isConnected&&node.getClientRects().length>0&&node.clientWidth>0&&node.clientHeight>0;}
  function plotSize(node){return {width:Math.max(0,Math.floor(Number(node?.clientWidth)||0)),height:Math.max(0,Math.floor(Number(node?.clientHeight)||0))};}
  function resizeChart(entry){
    if(!entry.chart||!entry.plot?.isConnected)return;const size=plotSize(entry.plot);
    if(!size.width||!size.height||(entry.lastSize?.width===size.width&&entry.lastSize?.height===size.height))return;
    // These are unscaled logical dimensions; bounding rectangles include the
    // outer AirPlay transform and therefore must never size the inner canvas.
    entry.lastSize=size;entry.chart.resize(size.width,size.height);entry.chart.applyOptions({rightPriceScale:{tickMarkDensity:Math.max(1,size.height/(5*(entry.tv?26:12)))}});requestAnimationFrame(()=>{positionAxis(entry);positionExtrema(entry)});
  }
  function observeChartSize(entry){
    if(typeof ResizeObserver!=='function')return;
    entry.resizeObserver=new ResizeObserver(()=>{if(entry.resizeFrame!=null)return;entry.resizeFrame=requestAnimationFrame(()=>{entry.resizeFrame=null;resizeChart(entry);});});
    entry.resizeObserver.observe(entry.plot);
  }
  function clearChart(entry){entry.resizeObserver?.disconnect();entry.resizeObserver=null;if(entry.resizeFrame!=null)cancelAnimationFrame(entry.resizeFrame);entry.resizeFrame=null;entry.lastSize=null;try{entry.chart?.remove()}catch{}entry.chart=null;entry.series=null;entry.segments=[];entry.markerSets=[];entry.volumeSeries=null;entry.markers=null;entry.line=null;entry.dataKey=null;entry.kind=null;}
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
  function axisHTML(record,range){return axisTimes(record,range).map(time=>`<span data-axis-time="${time}">${safe(range==='1d'?timeLabel(time):dayLabel(time))}</span>`).join('');}
  function positionAxis(entry){if(!entry.chart||!entry.axis)return;entry.axis.querySelectorAll('[data-axis-time]').forEach(node=>{const x=entry.chart.timeScale().timeToCoordinate(Number(node.dataset.axisTime));node.style.left=Math.max(24,Math.min(entry.axis.clientWidth-35,x??0))+'px';});}
  function positionExtrema(entry){if(!entry.chart||entry.mode==='spark'||!entry.record)return;entry.plot.querySelectorAll('.chart-extreme').forEach(n=>n.remove());
    const right=entry.chart.priceScale('right').width(),width=entry.plot.clientWidth-right,height=entry.plot.clientHeight;
    for(const [point,label]of [[entry.record.highPoint,'H'],[entry.record.lowPoint,'L']]){if(!point)continue;const x=entry.chart.timeScale().timeToCoordinate(point.time),y=entry.series.priceToCoordinate(point.value);if(x==null||y==null)continue;const tag=document.createElement('span');tag.className='chart-extreme';tag.textContent=label+' '+fmt(point.value);entry.plot.append(tag);tag.style.left=Math.max(2,Math.min(width-tag.offsetWidth-2,x-tag.offsetWidth/2))+'px';tag.style.top=Math.max(2,Math.min(height*.78-tag.offsetHeight,y+(label==='H'?-tag.offsetHeight-6:8)))+'px';}
  }
  function render(entry){
    if(!mountedVisible(entry.node))return;const detail=details.get(key(entry.symbol,entry.range)),batch=records.get(key(entry.symbol,entry.range)),record=detail||batch;entry.record=record;
    if(entry.meta){const html=metadataHTML(entry.symbol,record,entry.mode);if(entry.cachedMeta!==html){entry.meta.innerHTML=html;entry.cachedMeta=html;window.InfoDeskView?.flash(entry.meta,'chart:'+entry.mode+':'+entry.symbol,record?.price);}}
    resizeChart(entry);
    if(!record){if(failureUntil.has(key(entry.symbol,entry.range)))fallback(entry);return;}
    if(!window.LightweightCharts){fallback(entry);return;}
    const dataKey=record.received+':'+record.time+':'+record.price+':'+english();if(entry.dataKey===dataKey)return;
    const LC=window.LightweightCharts,compact=entry.mode==='spark',green=record.previous===null||record.price>=record.previous,color=green?'#00C853':'#FF3B30';
    if(entry.kind!=='native'){
      clearChart(entry);entry.plot.replaceChildren();
      const size=plotSize(entry.plot);entry.lastSize=size;
      entry.chart=LC.createChart(entry.plot,{autoSize:false,width:Math.max(1,size.width),height:Math.max(1,size.height),layout:{background:{type:LC.ColorType.Solid,color:'transparent'},textColor:'#bdb8cc',fontSize:entry.tv?26:12,fontFamily:'"Barlow Condensed", "Noto Sans TC", sans-serif',attributionLogo:false},grid:{vertLines:{visible:false},horzLines:{visible:!compact,color:'#ffffff16'}},rightPriceScale:{visible:!compact,borderVisible:false,ticksVisible:true,entireTextOnly:true,tickMarkDensity:Math.max(1,size.height/(5*(entry.tv?26:12))),minimumWidth:entry.tv?100:62,scaleMargins:{top:.16,bottom:compact?.12:.30}},leftPriceScale:{visible:false},timeScale:{visible:false,rightOffset:3,fixLeftEdge:true,fixRightEdge:true,minBarSpacing:.1},localization:{locale:english()?'en-HK':'zh-HK',timeFormatter:timeLabel},crosshair:{mode:entry.tv||compact?LC.CrosshairMode.Hidden:LC.CrosshairMode.Normal,vertLine:{color:'#ffffff75',labelVisible:true},horzLine:{color:'#ffffff75',labelVisible:true}},handleScroll:false,handleScale:false,kineticScroll:{mouse:false,touch:false}});
      observeChartSize(entry);
      entry.segments=[];entry.markerSets=[];entry.volumeSeries=entry.chart.addSeries(LC.HistogramSeries,{priceScaleId:'volume',priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});entry.volumeSeries.priceScale().applyOptions({scaleMargins:{top:.80,bottom:0},visible:false});
      entry.tooltip=document.createElement('div');entry.tooltip.className='chart-crosshair-readout';entry.tooltip.hidden=true;entry.plot.append(entry.tooltip);
      if(!compact&&!entry.tv)entry.chart.subscribeCrosshairMove(param=>{if(!param.time||!param.point){entry.tooltip.hidden=true;return;}const point=entry.record?.points.find(p=>p.time===param.time);if(!point){entry.tooltip.hidden=true;return;}const v=entry.record.volume.find(p=>p.time===param.time)?.value;entry.tooltip.textContent=timeLabel(param.time)+' HKT · '+fmt(point.value)+(v!=null?' · '+L('量 ','VOL ')+v.toLocaleString('en-HK'):'');entry.tooltip.hidden=false;});entry.kind='native';
    }
    const segments=segmentsFor(record),timeline=chartTimeline(record),last=record.points.at(-1);
    if(entry.line&&entry.series)entry.series.removePriceLine(entry.line);entry.line=null;
    while(entry.segments.length>segments.length){entry.markerSets.pop()?.detach();entry.chart.removeSeries(entry.segments.pop());}
    segments.forEach((points,i)=>{let series=entry.segments[i];if(!series){series=entry.chart.addSeries(LC.AreaSeries,{lineWidth:1,priceLineStyle:LC.LineStyle.Dashed,lastPriceAnimation:LC.LastPriceAnimationMode.Disabled});entry.segments.push(series);entry.markerSets.push(LC.createSeriesMarkers(series,[],{autoScale:false}));}
      const isLast=i===segments.length-1;series.applyOptions({lineColor:color,topColor:green?'rgba(0,200,83,.20)':'rgba(255,59,48,.20)',bottomColor:'transparent',priceLineVisible:!compact&&isLast,lastValueVisible:!compact&&isLast,crosshairMarkerVisible:!entry.tv&&!compact,autoscaleInfoProvider:base=>{const info=base();if(info?.priceRange){const ext=[record.previous,record.high,record.low].filter(Number.isFinite);info.priceRange.minValue=Math.min(info.priceRange.minValue,...ext);info.priceRange.maxValue=Math.max(info.priceRange.maxValue,...ext);}return info;}});series.setData(points);
      const markers=[];if(isLast)markers.push({time:last.time,position:'atPriceMiddle',price:last.value,color,shape:'circle',size:compact?.5:1});
      if(!compact)for(const point of [record.highPoint,record.lowPoint])if(point&&points.some(p=>p.time===point.time))markers.push({time:point.time,position:'atPriceMiddle',price:point.value,color:'#c4bdcf',shape:'circle',size:.45});
      entry.markerSets[i].setMarkers(markers.sort((a,b)=>a.time-b.time));
    });
    entry.series=entry.segments.at(-1);entry.line=record.previous===null?null:entry.series.createPriceLine({price:record.previous,color:'#a2a0aa',lineWidth:1,lineStyle:LC.LineStyle.Dashed,axisLabelVisible:!compact,title:compact?'':L('前收','PREV')});
    const volumes=new Map(record.volume.map(p=>[p.time,p.value])),prices=new Map(record.points.map(p=>[p.time,p.value]));let prev=record.previous;
    entry.volumeSeries.setData(timeline.map(time=>{const price=prices.get(time),v=volumes.get(time),up=price!=null&&(prev==null||price>=prev);if(price!=null)prev=price;return !compact&&v!=null?{time,value:v,color:up?'rgba(0,200,83,.24)':'rgba(255,59,48,.24)'}:{time};}));
    entry.chart.timeScale().fitContent();entry.dataKey=dataKey;
    if(entry.axis){entry.axis.innerHTML=axisHTML(record,entry.range);requestAnimationFrame(()=>{positionAxis(entry);positionExtrema(entry)});}
    entry.node.querySelector('.chart-volume-status')?.remove();if(!compact){const status=document.createElement('span');status.className='chart-volume-status';status.textContent=record.volume.some(p=>p.value>0)?L('成交量','VOLUME'):detail?L('來源未提供成交量','VOLUME NOT PROVIDED'):L('成交量載入中','VOLUME LOADING');entry.plot.append(status);}
    if(entry.caption)entry.caption.innerHTML=`${record.stale?L('快取 · ','CACHED · '):''}${safe(record.source)} · ${safe(record.granularity)} · ${safe(record.sessionDate||'')} ${safe(timeLabel(record.time))} HKT · ${L('可延遲','MAY BE DELAYED')}`;
    resizeChart(entry);
  }
  function renderAll(){for(const [node,entry]of mounted){if(!node.isConnected){clearChart(entry);mounted.delete(node);continue;}render(entry);}}
  function mount(node,options={}){
    if(!node)return;const symbol=options.symbol||node.dataset.chartSymbol;if(!knownSymbol(symbol))return;
    const mode=options.compact?'spark':options.mode||node.dataset.chartMode||'index',range=RANGE[options.range||node.dataset.chartRange]?options.range||node.dataset.chartRange:'1d',tv=options.tv??(node.dataset.chartTv==='true'||Boolean(window.InfoDeskTV?.enabled()));
    const previous=mounted.get(node);if(previous&&previous.symbol===symbol&&previous.mode===mode&&previous.range===range&&previous.tv===tv){render(previous);ensure(symbol,range);return previous;}
    if(previous)clearChart(previous);const entry={node,symbol,mode,range,tv};mounted.set(node,entry);cardInit(entry);render(entry);ensure(symbol,range);return entry;
  }
  function scan(root=document){for(const [node,entry]of mounted)if(!node.isConnected){clearChart(entry);mounted.delete(node);}if(root.matches?.('[data-chart-symbol]'))mount(root);root.querySelectorAll?.('[data-chart-symbol]').forEach(node=>{if(mountedVisible(node))mount(node);});}
  function destroyWithin(root){for(const [node,entry]of mounted)if(node===root||root.contains(node)){clearChart(entry);mounted.delete(node);}}
  function open(symbol){
    if(window.InfoDeskTV?.enabled()||!knownSymbol(symbol))return;
    if(!modal){modal=document.createElement('dialog');modal.id='chartModal';modal.className='chart-modal';modal.innerHTML='<div class="chart-modal-bar"><strong>INFO//DESK</strong><nav class="chart-range-controls"></nav><button class="chart-close" type="button" aria-label="Close">×</button></div><div class="chart-modal-content"></div><div class="chart-credit"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™</a> · Copyright (с) 2025 TradingView, Inc.</div>';document.body.append(modal);modal.querySelector('.chart-close').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});modal.addEventListener('close',()=>{destroyWithin(modal);modal.querySelector('.chart-modal-content').replaceChildren();document.body.classList.remove('chart-modal-open');modalSymbol=null;});}
    modalSymbol=symbol;document.body.classList.add('chart-modal-open');if(!modal.open)modal.showModal();setModalRange('1d');
  }
  function setModalRange(range){
    modal.dataset.range=range;const content=modal.querySelector('.chart-modal-content');destroyWithin(content);content.innerHTML=shell(modalSymbol,'modal',{range});
    modal.querySelector('.chart-range-controls').innerHTML=Object.entries(RANGE).map(([code,r])=>`<button type="button" data-range="${code}" aria-pressed="${range===code}">${safe(r.label[english()?1:0])}</button>`).join('');modal.querySelectorAll('[data-range]').forEach(btn=>btn.onclick=()=>setModalRange(btn.dataset.range));scan(content);
  }
  function focusTick(){const now=Date.now();if(document.hidden||now-lastFocus<8000)return;lastFocus=now;const symbols=preferredWatchlist();document.querySelectorAll('[data-chart-focus-rotate]').forEach(node=>{if(!mountedVisible(node)||!symbols.length)return;destroyWithin(node);node.innerHTML=shell(symbols[focusCursor%symbols.length],'focus');node.animate?.([{transform:'translateX(4%)',clipPath:'inset(0 0 0 100%)'},{transform:'translateX(0)',clipPath:'inset(0 0 0 0)'}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});scan(node)});focusCursor++;}
  function init(){
    document.addEventListener('click',event=>{if(event.target.closest('button,a,#chartModal')||window.InfoDeskTV?.enabled())return;const target=event.target.closest('[data-symbol],[data-chart-symbol]');if(target)open(target.dataset.symbol||target.dataset.chartSymbol);});
    document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){const symbol=event.target?.dataset?.symbol;if(symbol){event.preventDefault();open(symbol);}}});
    let queued=false;observer=new MutationObserver(list=>{if(queued||!list.some(m=>m.target.closest?.('.stage-deck,#tvMain,#hkMarket,#usMarket,#railIndices')&&!m.target.closest?.('.chart-card')))return;queued=true;requestAnimationFrame(()=>{queued=false;scan(document);});});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    document.addEventListener('infodesk:language',()=>{for(const entry of mounted.values()){entry.dataKey=null;render(entry)}if(modal?.open)setModalRange(modal.dataset.range)});
    document.addEventListener('infodesk:tv',()=>{if(modal?.open)modal.close();for(const entry of mounted.values())clearChart(entry);mounted.clear();scan(document);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){scan(document);refreshVisible()}});window.addEventListener('resize',()=>scan(document));
    scan(document);refreshVisible();timer=setInterval(()=>{refreshVisible();scan(document)},PERIOD);setInterval(focusTick,1000);setInterval(detailTick,1000);
  }
  document.addEventListener('DOMContentLoaded',init);
  return {mount,scan,hydrate:scan,destroyWithin,refreshVisible,open,parseSeries,parseResponse,publicError,plotSize,targetURL,detailURL,segmentsFor,axisTimes,chartTimeline,widgetSymbol,markup:shell,sparkHTML:(symbol,options={})=>shell(symbol,'spark',options),indicesHTML,indexMarkup:indicesHTML,focusHTML:(symbol,options={})=>shell(symbol,'focus',options),focusMarkup:symbol=>shell(symbol,'focus'),preferredWatchlist,timeLabel,axisHTML,inspect:()=>({mounted:mounted.size,inflight:inflight.size,batch:BATCH,stagger:STAGGER,period:PERIOD,details:[...details.values()].map(({points,volume,...r})=>({...r,points:points.length,volume:volume.length})),detailRequestsLastMinute:detailTimes.length,batches:[...batchDiagnostics.values()].map(r=>({...r,symbols:[...r.symbols],missing:[...r.missing]})),records:[...records.values()].map(({points,volume,...r})=>({...r,points:points.length,volume:volume.length})),failures:[...failureUntil.keys()]})};
})();
