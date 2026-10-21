"use strict";
// Executed only inside an opaque-origin sandbox. No parent communication or storage.
(()=>{
  const query=new URLSearchParams(location.search),symbol=query.get('symbol')||'',ranges={'1d':{interval:'5',range:'1D'},'5d':{interval:'5',range:'5D'},'1mo':{interval:'D',range:'1M'},'1y':{interval:'D',range:'12M'}};
  if(!/^[A-Z0-9_]+:[A-Z0-9.]+$/.test(symbol)){document.querySelector('#widget').textContent='Chart unavailable';return;}
  const root=document.querySelector('#widget'),container=document.createElement('div');container.className='tradingview-widget-container';
  const plot=document.createElement('div');plot.className='tradingview-widget-container__widget';container.append(plot);
  const credit=document.createElement('div');credit.className='tradingview-widget-copyright';const link=document.createElement('a');link.href='https://www.tradingview.com/symbols/'+encodeURIComponent(symbol.replace(':','-'))+'/';link.textContent=symbol+' chart by TradingView';link.target='_blank';link.rel='noopener noreferrer';credit.append(link);container.append(credit);root.append(container);
  const script=document.createElement('script');script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';script.async=true;
  const range=ranges[query.get('range')]||ranges['1d'];script.textContent=JSON.stringify({autosize:true,symbol,interval:range.interval,range:range.range,timezone:'Asia/Hong_Kong',theme:'dark',backgroundColor:'rgba(7,6,12,1)',style:'3',hide_top_toolbar:true,hide_legend:true,hide_side_toolbar:true,allow_symbol_change:false,save_image:false,calendar:false,locale:query.get('lang')==='zh_TW'?'zh_TW':'en',support_host:'https://www.tradingview.com'});
  script.onerror=()=>{plot.textContent=query.get('lang')==='zh_TW'?'圖表暫時未能載入':'CHART TEMPORARILY UNAVAILABLE';};container.append(script);
})();
