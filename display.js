"use strict";
// Shared display controls only. Original data/auth modules remain the source of truth.
window.InfoDeskDisplay=(()=>{
  const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],en=()=>window.InfoDeskI18n?.en(),tr=(a,b)=>en()?b:a;
  let region=localStorage.getItem('dashboard_transit_region')||'all',railPage=0,railAt=0,ready=false;
  const tv=()=>Boolean(window.InfoDeskTV?.enabled()),paged=()=>tv()||innerWidth>=768;
  function regionLabel(value){return en()?({'沙田':'SHA TIN','九龍':'KOWLOON','港島':'HK ISLAND','其他':'OTHER'}[value]||value):value;}
  function regionControls(){const available=[...new Set(CFG.TRANSIT.map(r=>r.region||'其他'))],preferred=['沙田','九龍','港島'];return `<div class="region-filters">${['all',...preferred.filter(r=>available.includes(r)),...available.filter(r=>!preferred.includes(r))].map(r=>`<button data-region-filter="${esc(r)}" aria-pressed="${region===r}">${r==='all'?tr('全部','ALL'):esc(regionLabel(r))}</button>`).join('')}</div>`;}
  function applyRegion(){all('#transit .route-card').forEach(e=>e.classList.toggle('region-hidden',region!=='all'&&e.dataset.region!==region));all('[data-region-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.regionFilter===region)));}
  function setRegion(value){region=value;localStorage.setItem('dashboard_transit_region',region);applyRegion();window.InfoDeskTVPanels?.refresh();window.InfoDeskView?.transit(state.transitResults||[]);}
  const shortWarning=(w)=>{if(en())return w.name||w.code;const code=w.code||'';return ({WRAINY:'黃雨',WRAINR:'紅雨',WRAINB:'黑雨',TC1:'一號風球',TC3:'三號風球',TC8NE:'八號風球',TC8SE:'八號風球',TC8SW:'八號風球',TC8NW:'八號風球',TC9:'九號風球',TC10:'十號風球',WHOT:'酷熱',WCOLD:'寒冷',WTS:'雷暴',WFROST:'霜凍',WFIREY:'黃色火災',WFIRER:'紅色火災'}[code]||w.name||code);};
  function headerWeather(){const node=q('#headerWeather');if(!node)return;const data=state.weatherCache[en()?'en':'tc'],now=data?.[0],warnings=Object.values(data?.[3]||{}).filter(w=>w&&w.actionCode!=='CANCEL');
    const temps=all('#weather .temp').map(e=>e.textContent),icon=Number(now?.icon?.[0]),glyph=icon===65?'⛈':icon>=62&&icon<=64?'🌧':icon===50?'☀':icon>=51&&icon<=54?'🌤':icon>=70&&icon<=77?'☾':icon>=83&&icon<=85?'🌫':icon===80?'≋':icon===82?'💧':icon===93?'❄':icon>=90?'☀':'☁';
    node.innerHTML=`<span class="weather-symbol" role="img" aria-label="${tr('香港天氣','HK WEATHER')}">${glyph}</span><span>${tr('沙田','SHA TIN')} <b>${esc(temps[0]||'—')}</b></span><span>${tr('數碼港','CYBERPORT')} <b>${esc(temps[1]||'—')}</b></span><span class="header-warnings">${warnings.map(w=>`<b class="header-warning" title="${esc(w.name||'')}">${esc(shortWarning(w))}</b>`).join('')}</span>`;
    const corner=q('#cornerWeather');if(corner)corner.innerHTML=node.innerHTML;
  }
  function fit(){document.documentElement.classList.toggle('paged-display',paged());if(!tv())document.documentElement.classList.toggle('desktop-pages',innerWidth>=768);else document.documentElement.classList.remove('desktop-pages');if(ready){window.InfoDeskTVPanels?.start();railTick(true);}}
  function railTick(force=false){if(!ready||tv()||innerWidth<768){all('.data-rail>.panel').forEach(e=>e.classList.remove('rail-hidden'));all('.rail-item-hidden').forEach(e=>e.classList.remove('rail-item-hidden'));return;}
    if(!force&&Date.now()<railAt)return;if(!force)railPage++;railAt=Date.now()+8000;
    const groups=[['.rail-countdowns','.rail-indices'],['.fx-panel'],['.rail-weather','.gmail-panel','.whatsapp-panel','.crypto-panel']];
    // Expanded message/crypto panels get a complete page, not a cramped scrollbox.
    const expanded=all('.gmail-panel:not(.collapsed),.whatsapp-panel:not(.collapsed),.crypto-panel:has(#cryptoContent:not([hidden]))');
    for(const e of expanded){for(const g of groups){const i=g.findIndex(s=>e.matches(s));if(i>=0)g.splice(i,1)}groups.push(['.'+[...e.classList].find(c=>c.endsWith('-panel'))]);}
    const pages=groups.filter(g=>g.length),chosen=pages[railPage%pages.length];all('.data-rail>.panel').forEach(e=>e.classList.toggle('rail-hidden',!chosen.some(s=>e.matches(s))));
    q('#railPageIndicator').textContent=`${railPage%pages.length+1}/${pages.length}`;
    all('.rail-item-hidden').forEach(e=>e.classList.remove('rail-item-hidden'));
    const sub=Math.floor(Date.now()/8000);
    for(const [selector,capacity]of [['#fx .fx',6],['#gmail .mail',3],['#cryptoMain .crypto-quote',1]]){const nodes=all(selector),start=(sub%Math.max(1,Math.ceil(nodes.length/capacity)))*capacity;nodes.forEach((e,i)=>e.classList.toggle('rail-item-hidden',i<start||i>=start+capacity));}
    if(!force)q('.data-rail').animate([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:300,easing:'ease-out'});
  }
  function init(){q('.status').insertAdjacentHTML('beforebegin','<div id="headerWeather" aria-label="香港天氣"></div>');q('.transit-stage .panel-head').insertAdjacentHTML('afterend',regionControls());q('.data-rail').insertAdjacentHTML('beforeend','<div class="rail-pagination"><button id="railPrevious" aria-label="Previous">‹</button><b id="railPageIndicator">1/3</b><button id="railNext" aria-label="Next">›</button></div>');ready=true;
    q('.stage-tabs').insertAdjacentHTML('beforebegin',`<section class="panel stage chart-mobile-page" data-stage="7"><div class="panel-head"><h1>${tr('指數走勢','INDEX CHARTS')}</h1></div><div id="mobileIndexCharts">${window.InfoDeskCharts?.indicesHTML()||''}</div></section><section class="panel stage chart-mobile-page" data-stage="8"><div class="panel-head"><h1>${tr('焦點股走勢','FOCUS STOCK CHART')}</h1></div><div class="focus-chart-slot" data-chart-focus-rotate>${window.InfoDeskCharts?.focusHTML(window.InfoDeskCharts.preferredWatchlist()[0])||''}</div></section>`);
    q('#railPrevious').onclick=()=>{railPage=Math.max(0,railPage-1);railTick(true)};q('#railNext').onclick=()=>{railPage++;railTick(true)};
    document.addEventListener('click',e=>{const b=e.target.closest('[data-region-filter]');if(b)setRegion(b.dataset.regionFilter)});
    new MutationObserver(headerWeather).observe(q('#weather'),{childList:true});document.addEventListener('infodesk:language',()=>{headerWeather();q('.transit-stage .region-filters').outerHTML=regionControls();all('.chart-mobile-page h1').forEach((e,i)=>e.textContent=i?tr('焦點股走勢','FOCUS STOCK CHART'):tr('指數走勢','INDEX CHARTS'));applyRegion()});
    document.addEventListener('infodesk:tv',fit);window.addEventListener('resize',fit);fit();headerWeather();applyRegion();setInterval(()=>{if(!document.hidden)railTick()},1000);
  }
  document.addEventListener('DOMContentLoaded',init);return {regionLabel,regionControls,applyRegion,setRegion,region:()=>region,headerWeather,paged,railTick};
})();
