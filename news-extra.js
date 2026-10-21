"use strict";
window.InfoDeskNews = (() => {
  let filter='all',usItems=[],usBusy=false;
  try{filter=localStorage.getItem('dashboard_local_filter')||'all'}catch{}
  if(!['all','now','cable','other'].includes(filter))filter='all';
  const sourceNames={now:'now',cable:'有線',other:'RTHK'};
  const normalize=t=>t.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
  function merge(rows,limit=10){const titles=new Set(),links=new Set();return rows.filter(x=>x.title&&Number.isFinite(x.published)&&/^https:\/\//.test(x.link)).sort((a,b)=>b.published-a.published).filter(x=>{const t=normalize(x.title);if(titles.has(t)||links.has(x.link))return false;titles.add(t);links.add(x.link);return true}).slice(0,limit)}
  function parseXML(raw,source){
    const start=raw.indexOf('<rss'),end=raw.lastIndexOf('</rss>');if(start<0||end<0)return [];
    const sourceXML=raw.slice(start,end+6);if(/<!DOCTYPE|<!ENTITY/i.test(sourceXML))return [];
    let xml=new DOMParser().parseFromString(sourceXML,'application/xml');
    // The Reader browser engine exposes decoded ampersands from Chrome's XML viewer.
    if(xml.querySelector('parsererror'))xml=new DOMParser().parseFromString(sourceXML.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/gi,'&amp;'),'application/xml');
    if(xml.querySelector('parsererror'))return [];
    return [...xml.querySelectorAll('item')].map(item=>{const val=k=>item.querySelector(k)?.textContent?.trim()||'';let title=val('title'),publisher=val('source');if(publisher&&title.endsWith(' - '+publisher))title=title.slice(0,-publisher.length-3);return {title,link:val('link'),published:Date.parse(val('pubDate')),source}}).filter(x=>{try{const u=new URL(x.link);return u.protocol==='https:'&&(source==='CNBC'?(u.hostname==='www.cnbc.com'||u.hostname==='cnbc.com'):u.hostname==='news.google.com')}catch{return false}});
  }
  function parseGoogleReader(raw,source){
    const xml=parseXML(raw,source);if(xml.length)return xml;
    // Reader returns the RSS as markdown: each article link is followed by its RFC2822 pubDate.
    const matches=[...raw.matchAll(/\[([^\]\n]{3,350})\]\((https:\/\/news\.google\.com\/rss\/articles\/[^\s)]+)\)/g)],rows=[];
    for(let i=0;i<matches.length;i++){const m=matches[i],part=raw.slice(m.index+m[0].length,matches[i+1]?.index??raw.length),date=part.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*\d{1,2}\s+\w{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s*(?:GMT|[+-]\d{4})/);if(!date)continue;const suffix=source==='now'?/\s+-\s+Now新聞$/i:/\s+-\s+(?:i-CABLE|有線新聞)$/i;rows.push({title:m[1].replace(suffix,''),link:m[2].replaceAll('&amp;','&'),published:Date.parse(date[0]),source})}return rows;
  }
  function listHTML(items,badges=false){return `<div class="news-list">${items.map(x=>`<a class="news-item" data-published="${x.published}" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">${badges?`<b class="news-source">${esc(T(sourceNames[x.source]||x.source||'RTHK'))}</b>`:''}<span class="news-title">${esc(x.title)}</span><span class="news-time" data-datetime="${x.published}">${hkDateTime(x.published)}</span></a>`).join('')}</div>`}
  function renderLocal(saved=state.newsCache[lang()]?.local){
    const controls=$('#localFilters');controls.hidden=lang()==='en';
    if(!saved)return;
    controls.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.filter===filter));const status=saved.statuses?.[b.dataset.filter];b.classList.toggle('source-failed',status===false);b.title=status===false?T('此來源暫時未能取得數據'):''});
    const rows=(saved.allItems||saved.items).filter(x=>lang()==='en'||filter==='all'||x.source===filter).slice(0,10);
    $('#localNews').innerHTML=rows.length?listHTML(rows,true):`<div class="empty">${T('此來源暫時未能取得數據')}</div>`;
  }
  async function loadLocal(requested){
    window.InfoDeskNetwork?.begin('localNews');
    const sources=[{id:'other',feeds:requested==='en'?CFG.NEWS.EN_LOCAL:CFG.NEWS.LOCAL},...(requested==='en'?[]:CFG.NEWS.SEARCH_LOCAL)];
    const settled=await Promise.allSettled(sources.map(async source=>{
      const rows=source.feeds? (await Promise.all(source.feeds.map(async f=>parseReaderMarkdown(await fetchJinaText('https://r.jina.ai/'+f,35000,requested==='en'?{'X-Engine':'browser','X-Respond-With':'markdown','X-No-Cache':'true'}:{}),requested)))).flat().map(x=>({...x,source:'other'})) : parseGoogleReader(await fetchJinaText('https://r.jina.ai/'+source.rss,35000,{'X-Engine':'browser','X-Respond-With':'text','X-No-Cache':'true'}),source.id);
      if(!rows.length)throw new Error('empty');return rows;
    }));
    const statuses=Object.fromEntries(sources.map((s,i)=>[s.id,settled[i].status==='fulfilled']));
    const allItems=merge(settled.filter(x=>x.status==='fulfilled').flatMap(x=>x.value),80),items=allItems.slice(0,10);
    const saved={allItems,items,statuses,partial:settled.some(x=>x.status==='rejected')};(state.newsCache[requested]||={}).local=saved;
    if(lang()!==requested)return;
    if(items.length){renderNewsGroup(saved,'#localNews','local',requested);setStamp('#localNewsUpdated')}
    renderLocal(saved);
  }
  async function loadUS(){if(usBusy)return;usBusy=true;window.InfoDeskNetwork?.begin('usNews');try{
    const result=await Promise.allSettled(CFG.NEWS.US.map(async feed=>{const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),22000);try{const response=await window.InfoDeskNetwork.fetch(feed.rss,{signal:ctl.signal});const rows=parseXML(await response.text(),'CNBC');if(!rows.length)throw new Error('empty');return rows}finally{clearTimeout(timer)}}));
    const items=merge(result.filter(x=>x.status==='fulfilled').flatMap(x=>x.value));
    if(!items.length)throw new Error('empty');usItems=items;
    $('#usNews').innerHTML=(result.some(x=>x.status==='rejected')?`<div class="route-error">${T('部分新聞來源暫時未能取得數據')}</div>`:'')+listHTML(items);
    setStamp('#usNewsUpdated');
  }catch{$('#usNews').innerHTML=`<div class="error">${T('暫時未能取得數據')}</div>`}finally{usBusy=false}}
  function init(){document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;localStorage.setItem('dashboard_local_filter',filter);renderLocal()});loadUS();setInterval(loadUS,300000)}
  document.addEventListener('DOMContentLoaded',init);
  document.addEventListener('infodesk:language',()=>{renderLocal();if(usItems.length)$('#usNews').innerHTML=listHTML(usItems)});
  return {loadLocal,renderLocal,loadUS,parseXML,parseGoogleReader,merge};
})();
