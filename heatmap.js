"use strict";
window.InfoDeskHeatmap=(()=>{
  const data=window.INFO_DESK_NASDAQ,quotes=new Map(),failed=new Set(),observed=new Set(),en=()=>window.InfoDeskI18n?.en(),tr=(tc,e)=>en()?e:tc;
  const sectors={
    '半導體|SEMICONDUCTORS':'NVDA MU AMD AVGO INTC LRCX AMAT TXN MRVL KLAC ADI QCOM ASML ARM MPWR NXPI TER ALAB MCHP',
    '科技|TECHNOLOGY':'AAPL MSFT PLTR CSCO PANW CRWD SHOP SNDK STX WDC FTNT ADBE INTU DDOG CDNS SNPS LITE MSTR ADSK NBIS WDAY ROP CRWV',
    '通訊媒體|COMMUNICATION':'META GOOGL GOOG NFLX TMUS APP CMCSA TTWO',
    '消費|CONSUMER':'AMZN TSLA BKNG SBUX MAR MELI DASH ROST ABNB ORLY PDD WMT COST PEP MNST MDLZ CCEP KDP',
    '醫療|HEALTHCARE':'AMGN GILD ISRG VRTX MRNA REGN IDXX GEHC DXCM ALNY',
    '工業能源|INDUSTRIALS / ENERGY':'SPCX LIN ADP CEG CSX CTAS AEP HON FAST PCAR FANG BKR HONA XEL EXC TRI PAYX ODFL FER AXON RKLB CPRT',
    '金融服務|FINANCIAL SERVICES':'PYPL'
  };
  const sectorFor=s=>Object.keys(sectors).find(k=>sectors[k].split(' ').includes(s))||'其他|OTHER';
  const stocks=data.stocks.map(s=>({...s,sector:sectorFor(s.symbol)}));
  let busy=false,timer=null,observer=null,retryAt=0,renderTimer=null,revision=0;
  const renderKeys=new WeakMap();
  // Weighted binary treemap: every security retains its exact proportional area.
  function tile(rows,x,y,w,h,out=[]){if(!rows.length)return out;if(rows.length===1){out.push({...rows[0],x,y,w,h});return out;}
    const total=rows.reduce((a,r)=>a+r.weight,0);let sum=0,cut=0;while(cut<rows.length-1&&sum<total/2)sum+=rows[cut++].weight;
    const fraction=sum/total;if(w>=h){tile(rows.slice(0,cut),x,y,w*fraction,h,out);tile(rows.slice(cut),x+w*fraction,y,w*(1-fraction),h,out)}else{tile(rows.slice(0,cut),x,y,w,h*fraction,out);tile(rows.slice(cut),x,y+h*fraction,w,h*(1-fraction),out)}return out;
  }
  function color(pct){if(!Number.isFinite(pct))return '#272631';const f=Math.min(1,Math.abs(pct)/3),a=[65,63,70],b=pct>=0?[0,135,66]:[186,31,43];return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*f)).join(',')})`;}
  function summary(){const rows=[...quotes.values()],q=state.marketBatch?.get('^IXIC')?.value,up=rows.filter(q=>q.pct>0).length,down=rows.filter(q=>q.pct<0).length;
    const isOpen=window.InfoDeskCalendar?.status('US')?.trading,stale=failed.size||navigator.onLine===false||window.InfoDeskNetwork?.stale('markets');
    return `<div class="heatmap-summary"><b>${tr('納指','NASDAQ')} ${q?Number(q.price).toLocaleString('en-US',{maximumFractionDigits:2}):'—'}</b><span class="${q?.pct>=0?'up':'down'}">${q?`${q.pct>=0?'▲':'▼'} ${Math.abs(q.price*q.pct/(100+q.pct)).toFixed(2)} ${Math.abs(q.pct).toFixed(2)}%`:'—'}</span><span>▲ ${up} / ▼ ${down} · ${rows.length}/${stocks.length}</span><span>${isOpen?tr('交易中・延遲報價','OPEN · DELAYED'):tr('收市','CLOSED')}${stale?' · '+tr('部分快取／缺資料','PARTIAL CACHE / MISSING'):''}</span></div>`;
  }
  function html(compact=false){return `<div class="heatmap-view${compact?' heatmap-mini':''}">${compact?'':summary()}<div class="heatmap-canvas" data-heatmap></div>${compact?'':`<div class="heatmap-note">${tr('QQQ 股票持倉比重參考','QQQ EQUITY WEIGHT REFERENCE')} · ${data.date} · ${tr('灰色＝平收或缺資料','GREY = FLAT / UNAVAILABLE')}</div>`}</div>`;}
  function render(node){const w=node.clientWidth,h=node.clientHeight;if(w<1||h<1)return;const tv=window.InfoDeskTV?.enabled(),font=tv?26:Math.max(12,Math.min(18,w/70));
    const key=[w,h,tv,en(),revision].join(':');if(renderKeys.get(node)===key)return;renderKeys.set(node,key);
    const grouped=Object.keys(sectors).map(sector=>({sector,rows:stocks.filter(s=>s.sector===sector)})).filter(g=>g.rows.length).map(g=>({...g,weight:g.rows.reduce((a,r)=>a+r.weight,0)})).sort((a,b)=>b.weight-a.weight);
    const groups=tile(grouped,0,0,w,h);let markup='';
    for(const group of groups){const label=group.sector.split('|')[en()?1:0],show=group.w>label.length*font*.62&&group.h>font*4,head=show?font+7:0;
      if(show)markup+=`<text x="${group.x+4}" y="${group.y+font}" fill="#fff" style="font-size:${font}px!important">${esc(label)}</text>`;
      for(const r of tile(group.rows,group.x,group.y+head,group.w,group.h-head)){
        const q=quotes.get(r.symbol),pct=q?.pct,known=Number.isFinite(pct),line=known?(pct>0?'+':'')+pct.toFixed(2)+'%':'—';
        const labelVisible=r.w>Math.max(r.symbol.length,line.length)*font*.62+10&&r.h>font*2.5;
        markup+=`<g data-symbol="${esc(r.symbol)}" role="button" tabindex="${tv?-1:0}" aria-label="${esc(r.name+' '+line)}"><title>${esc(r.name)} · ${line} · QQQ ${r.weight.toFixed(3)}%${q?.time?' · '+esc(hkDateTime(q.time)):''}${failed.has(r.symbol)?' · CACHED / UNAVAILABLE':''}</title><rect x="${r.x+1}" y="${r.y+1}" width="${Math.max(0,r.w-2)}" height="${Math.max(0,r.h-2)}" fill="${color(pct)}"/>${labelVisible?`<text x="${r.x+r.w/2}" y="${r.y+r.h/2-font*.15}" text-anchor="middle" fill="white" style="font-size:${font}px!important;font-weight:800">${esc(r.symbol)}</text><text x="${r.x+r.w/2}" y="${r.y+r.h/2+font*1.05}" text-anchor="middle" fill="white" style="font-size:${font}px!important">${line}</text>`:''}</g>`;
      }
    }
    node.innerHTML=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" aria-label="NASDAQ 100 STOCK MATRIX">${markup}</svg>`;
  }
  function scan(root=document){for(const n of observed)if(!n.isConnected){observer?.unobserve(n);observed.delete(n)}root.querySelectorAll('[data-heatmap]').forEach(n=>{if(!observed.has(n)){observer?.observe(n);observed.add(n)}render(n)});}
  function notify(){revision++;if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;const m=document.querySelector('#mobileHeatmap');if(m)m.innerHTML=html();document.dispatchEvent(new CustomEvent('infodesk:heatmap'));scan();},100);}
  async function refresh(){if(busy||document.hidden||Date.now()<retryAt)return;busy=true;const start=Date.now(),cfg=CFG.HEATMAP||{},size=Math.min(20,cfg.BATCH_SIZE||20),extra=[];
    for(const s of stocks){const cached=state.marketBatch?.get(s.symbol);if(cached?.status==='fulfilled'){quotes.set(s.symbol,cached.value);failed.delete(s.symbol)}else extra.push({yahoo:s.symbol});}
    notify();let limited=false;
    try{for(let i=0;i<extra.length;i+=size){const wait=start+Math.floor(i/size)*(cfg.STAGGER_MS||10000)-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));if(document.hidden)break;
        const result=await fetchQuoteBatch(extra.slice(i,i+size));for(const [symbol,r]of result){if(r.status==='fulfilled'){quotes.set(symbol,r.value);failed.delete(symbol)}else{failed.add(symbol);if(String(r.reason?.message).includes('429'))limited=true;}}notify();if(limited){retryAt=Date.now()+120000;break;}}
    }finally{busy=false;}
  }
  function init(){observer=new ResizeObserver(entries=>entries.forEach(e=>render(e.target)));document.querySelector('.stage-tabs').insertAdjacentHTML('beforebegin',`<section class="panel stage heatmap-mobile-page" data-stage="9"><div class="panel-head"><h1 id="mobileHeatmapTitle">${tr('納指熱力圖','NASDAQ 100 HEATMAP')}</h1></div><div id="mobileHeatmap">${html()}</div></section>`);scan();setTimeout(refresh,6000);timer=setInterval(refresh,CFG.HEATMAP?.INTERVAL_MS||60000);
    document.addEventListener('infodesk:language',()=>{document.querySelector('#mobileHeatmapTitle').textContent=tr('納指熱力圖','NASDAQ 100 HEATMAP');notify()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});document.addEventListener('keydown',e=>{const cell=e.target.closest?.('[data-heatmap] [data-symbol]');if(cell&&!window.InfoDeskTV?.enabled()&&['Enter',' '].includes(e.key)){e.preventDefault();window.InfoDeskCharts?.open(cell.dataset.symbol)}});
  }
  document.addEventListener('DOMContentLoaded',init);
  return {html,scan,refresh,tile,color,stocks,inspect:()=>({total:stocks.length,loaded:quotes.size,failed:[...failed],retryAt,date:data.date,quotes:[...quotes.values()]})};
})();
