"use strict";
// Public-only data: no cookies, Gmail tokens, private messages or API keys.
window.InfoDeskSignals = (() => {
  const cryptoQuotes=new Map();
  let trends=[],trendsBusy=false,trendBaseline=null,feed=null,expanded=false,statusCode='paused';
  const text=v=>window.InfoDeskI18n?.t(v)??v;
  const safeURL=value=>{try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)?u.href:null}catch{return null}};
  function parseTrends(text){
    const start=text.indexOf('<rss'),end=text.lastIndexOf('</rss>');
    if(start<0||end<start)throw new Error('熱搜 RSS 格式無效');
    const xml=text.slice(start,end+6);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('不支援的 RSS 宣告');
    let doc=new DOMParser().parseFromString(xml,'application/xml');
    // Reader's browser engine exposes the XML viewer text, which can contain decoded ampersands.
    if(doc.querySelector('parsererror'))doc=new DOMParser().parseFromString(xml,'text/html');
    const tags=(node,name)=>[...node.getElementsByTagNameNS('*',name),...node.getElementsByTagName('ht:'+name)];
    const value=(node,name)=>tags(node,name)[0]?.textContent?.trim()||'';
    const seen=new Set(),rows=[];
    for(const item of doc.querySelectorAll('item')){
      const title=item.querySelector('title')?.textContent?.trim();if(!title||seen.has(title))continue;seen.add(title);
      const articles=[...new Set(tags(item,'news_item'))].map(n=>({title:value(n,'news_item_title'),link:safeURL(value(n,'news_item_url')),source:value(n,'news_item_source')})).filter(n=>n.title&&n.link).slice(0,2);
      rows.push({title,traffic:value(item,'approx_traffic'),published:Date.parse(item.querySelector('pubDate,pubdate')?.textContent||''),articles,link:'https://www.google.com/search?q='+encodeURIComponent(title)+'&tbm=nws'});
      if(rows.length>=CFG.TRENDS.LIMIT)break;
    }
    if(!rows.length)throw new Error('沒有熱搜資料');return rows;
  }
  function trendAlerts(rows){const current=new Set(rows.map(x=>x.title));if(trendBaseline!==null)rows.slice(0,3).filter(x=>!trendBaseline.has(x.title)).forEach(x=>enqueueAlert(text('香港熱搜'),x.title+' · '+text('新上榜熱搜'),5));trendBaseline=current;}
  function renderTrends(){
    if(!trends.length)return;
    $('#trends').innerHTML=trends.map((x,i)=>`<article class="trend-row"><b class="trend-rank">${String(i+1).padStart(2,'0')}</b><div><a class="trend-term" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a><span class="trend-volume">${x.traffic?esc(x.traffic)+' '+text('次搜尋'):text('搜尋量未提供')}</span><div class="trend-articles">${x.articles.length?x.articles.map(a=>`<a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)} <small>${esc(a.source)}</small></a>`).join(''):`<a href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${text('查看相關新聞 ↗')}</a>`}</div></div></article>`).join('');
  }
  async function loadTrends(){
    if(trendsBusy)return;trendsBusy=true;
    try{
      // Same Jina Reader as news, but preserve Google-specific RSS namespace fields.
      const text=await fetchJinaText('https://r.jina.ai/'+CFG.TRENDS.RSS,25000,{'X-Engine':'browser','X-Respond-With':'text','X-No-Cache':'true'});
      const rows=parseTrends(text);trends=rows;trendAlerts(rows);
      renderTrends();
      setStamp('#trendsUpdated');
    }catch{$('#trends').innerHTML='<div class="error">暫時未能取得數據</div>';trends=[]}finally{trendsBusy=false}
  }
  function createCryptoFeed({url,products,onQuote,onStatus,WebSocketImpl=WebSocket,now=Date.now,later=setTimeout,cancel=clearTimeout,random=Math.random}){
    let socket=null,retry=null,watch=null,stopped=true,attempt=0,lastMessage=0,generation=0;
    const sequences=new Map(),allowed=new Set(products);
    function dispose(){cancel(watch);watch=null;if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close()}catch{}socket=null}}
    function reconnect(){if(stopped||retry!==null)return;generation++;dispose();onStatus('reconnecting');const delay=Math.min(30000,1000*2**Math.min(attempt++,5))+Math.floor(random()*500);retry=later(()=>{retry=null;connect()},delay)}
    function watchdog(){cancel(watch);watch=later(()=>{if(now()-lastMessage>20000)reconnect();else watchdog()},5000)}
    function connect(){if(stopped||socket)return;const id=++generation;lastMessage=now();onStatus(attempt?'reconnecting':'connecting');
      try{socket=new WebSocketImpl(url)}catch{reconnect();return}
      const current=socket;watchdog();
      current.onopen=()=>{if(stopped||id!==generation)return;try{current.send(JSON.stringify({type:'subscribe',product_ids:products,channels:['ticker','heartbeat']}))}catch{reconnect()}};
      current.onmessage=e=>{if(stopped||id!==generation)return;let x;try{x=JSON.parse(e.data)}catch{return}lastMessage=now();
        if(x.type==='error'){reconnect();return}if(x.type!=='ticker'||!allowed.has(x.product_id))return;
        const price=Number(x.price),open=Number(x.open_24h),sequence=Number(x.sequence);if(!Number.isFinite(price)||price<=0)return;
        if(Number.isFinite(sequence)&&sequence<=(sequences.get(x.product_id)??-1))return;if(Number.isFinite(sequence))sequences.set(x.product_id,sequence);
        attempt=0;onStatus('live');onQuote({id:x.product_id,price,pct:Number.isFinite(open)&&open>0?(price/open-1)*100:null,time:Number.isFinite(Date.parse(x.time))?Date.parse(x.time):now(),received:now()});
      };
      current.onerror=reconnect;current.onclose=reconnect;
    }
    return {start(){if(!stopped)return;stopped=false;connect()},stop(){stopped=true;generation++;cancel(retry);retry=null;dispose()},restart(){this.stop();attempt=0;this.start()}};
  }
  function status(code){statusCode=code;const labels={paused:'已暫停連線',connecting:'連線中',reconnecting:'重新連線中',live:'即時串流 · USD'};document.querySelectorAll('[data-crypto-status]').forEach(e=>{e.textContent=text(labels[code]||code);e.dataset.state=code});document.querySelectorAll('.crypto-panel').forEach(e=>e.classList.toggle('stale',code!=='live'));}
  function updateCrypto(q){const product=CFG.CRYPTO.PRODUCTS.find(p=>p.id===q.id);if(!product)return;cryptoQuotes.set(q.id,{...product,...q});
    document.querySelectorAll('[data-crypto-id="'+q.id+'"]').forEach(node=>{
      node.querySelector('.crypto-price').textContent=q.price.toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2});
      const pct=node.querySelector('.crypto-change');pct.textContent=q.pct===null?text('24 小時升跌未提供'):`${q.pct>=0?'▲':'▼'} ${Math.abs(q.pct).toFixed(2)}%`;
      pct.className='crypto-change '+(q.pct>0?'up':q.pct<0?'down':'flat');node.querySelector('.crypto-time').textContent=hkTime(q.time)+' HKT';
      window.InfoDeskView?.flash(node,'crypto:'+node.dataset.view+':'+q.id,q.price);
    });
    $('#cryptoUpdated').textContent=hkTime(q.time)+' HKT';
  }
  function cryptoHTML(p,view){return `<div class="crypto-quote" data-crypto-id="${esc(p.id)}" data-view="${view}"><div class="crypto-name"><b>${esc(p.symbol)}</b><span>${esc(text(p.name))}</span></div><div class="crypto-currency">USD</div><strong class="crypto-price">—</strong><div class="crypto-change flat">${text('等待首筆成交')}</div><div class="crypto-time">—</div></div>`;}
  function setExpanded(open,persist=true){expanded=Boolean(open);$('#cryptoToggle').setAttribute('aria-expanded',String(expanded));$('#cryptoContent').hidden=!expanded;if(persist)try{localStorage.setItem('dashboard_crypto_open',String(expanded))}catch{}if(expanded)feed?.start();else{feed?.stop();status('paused')}}
  function init(){
    $('#cryptoMain').innerHTML=CFG.CRYPTO.PRODUCTS.map(p=>cryptoHTML(p,'main')).join('');
    feed=createCryptoFeed({url:CFG.CRYPTO.WS_URL,products:CFG.CRYPTO.PRODUCTS.map(p=>p.id),onQuote:updateCrypto,onStatus:status});
    let saved=false;try{saved=localStorage.getItem('dashboard_crypto_open')==='true'}catch{}setExpanded(saved,false);
    $('#cryptoToggle').addEventListener('click',()=>setExpanded(!expanded));
    window.addEventListener('pagehide',()=>feed.stop());window.addEventListener('pageshow',()=>{if(expanded)feed.start()});window.addEventListener('online',()=>{if(expanded)feed.restart()});
    document.addEventListener('infodesk:language',()=>{renderTrends();$('#cryptoMain').innerHTML=CFG.CRYPTO.PRODUCTS.map(p=>cryptoHTML(p,'main')).join('');cryptoQuotes.forEach(updateCrypto);status(statusCode)});
    loadTrends();setInterval(loadTrends,CFG.TRENDS.INTERVAL_MS);
    // HTTPS Universal Link lets iOS/Android open the installed Threads app; otherwise opens the web.
    $('#threadsOpen').href='https://www.threads.com/';
  }
  document.addEventListener('DOMContentLoaded',init);
  return {parseTrends,trendAlerts,loadTrends,createCryptoFeed,updateCrypto,setExpanded,getTrends:()=>trends,getCrypto:()=>[...cryptoQuotes.values()]};
})();
