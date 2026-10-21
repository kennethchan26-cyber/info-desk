"use strict";
// Only anonymous, explicitly allowlisted PUBLIC data enters this cache.
// Gmail/Google identity requests use native fetch, never this module or the SW cache.
window.InfoDeskNetwork = (() => {
  const CACHE='infodesk-public-v1',records=new Map(),MAX=180;
  function group(url){try{
    const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)return null;
    if([...u.searchParams.keys()].some(k=>/token|key|secret|auth|password/i.test(k)))return null;
    if(u.hostname==='r.jina.ai')return group(u.href.slice('https://r.jina.ai/'.length).replace(/^http:/,'https:').replaceAll('%26','&'));
    if(u.hostname==='data.weather.gov.hk'&&u.pathname==='/weatherAPI/opendata/weather.php')return 'weather';
    if((u.hostname==='data.etagmb.gov.hk'&&u.pathname.startsWith('/eta/route-stop/'))||(u.hostname==='data.etabus.gov.hk'&&u.pathname.startsWith('/v1/transport/kmb/eta/'))||(u.hostname==='rt.data.gov.hk'&&u.pathname.startsWith('/v2/transport/citybus/eta/')))return 'transit';
    if(u.hostname==='api.frankfurter.dev'&&u.pathname==='/v2/rates')return 'fx';
    if(u.hostname==='query1.finance.yahoo.com'&&u.pathname==='/v7/finance/spark')return 'markets';
    if(u.hostname==='trends.google.com'&&u.pathname==='/trending/rss')return 'trends';
    if(u.hostname==='news.google.com'&&u.pathname==='/rss/search'&&/^site:(news\.now\.com|i-cable\.com)$/.test(u.searchParams.get('q')))return 'localNews';
    if(u.hostname==='search.cnbc.com'&&u.pathname==='/rs/search/combinedcms/view.xml'&&['100003114','15839069','20910258','19832390'].includes(u.searchParams.get('id')))return 'usNews';
    if(['news.rthk.hk','rthk.hk'].includes(u.hostname)&&/\/rthk\/(ch\/latest-news\/|news\/rss\/)/.test(u.pathname))return /local|elocal/.test(u.pathname)?'localNews':'worldNews';
  }catch{}return null;}
  function allowed(url,options={}){const h=new Headers(options.headers||{});return (options.method||'GET').toUpperCase()==='GET'&&!h.has('Authorization')&&!h.has('Cookie')&&Boolean(group(url));}
  function valid(url,body){const g=group(url);try{
    if(['localNews','worldNews','trends','usNews'].includes(g))return /<rss[\s>][\s\S]*<item[\s>]/i.test(body)||(/rthk\.hk/.test(url)&&/https:\/\/news\.rthk\.hk\/rthk\/(?:ch|en)\/component\/k2\//.test(body));
    const start=body.indexOf('{'),end=body.lastIndexOf('}'),json=g==='markets'?JSON.parse(body.slice(start,end+1).replace(/\r?\n\s*/g,'')):JSON.parse(body);
    if(g==='fx')return Array.isArray(json)&&json.some(x=>Number(x.rate)>0);
    if(g==='markets')return Array.isArray(json.spark?.result)&&json.spark.result.some(x=>Number(x.response?.[0]?.meta?.regularMarketPrice)>0);
    if(g==='transit')return Array.isArray(json.data)||Array.isArray(json.data?.eta);
    if(g==='weather'){const type=new URL(url).searchParams.get('dataType');return type==='warnsum'?Boolean(json&&typeof json==='object'&&!Array.isArray(json)):type==='rhrread'?Array.isArray(json.temperature?.data):type==='fnd'?Array.isArray(json.weatherForecast):Boolean(json.forecastDesc||json.generalSituation)}
  }catch{}return false;}
  function report(url,time,stale){records.set(url,{group:group(url),time,stale});document.dispatchEvent(new CustomEvent('infodesk:network'));}
  async function publicFetch(url,options={}){
    if(!allowed(url,options))throw new Error('Not an anonymous public-data request');
    let cache;try{cache=await caches.open(CACHE)}catch{}
    try{
      const response=await fetch(url,{...options,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const body=await response.clone().text();if(!valid(url,body))throw new Error('Invalid public response');
      const time=Date.now();report(url,time,false);
      if(cache){try{if(body.length<5*1024*1024){const headers=new Headers({'Content-Type':response.headers.get('Content-Type')||'text/plain;charset=utf-8','X-InfoDesk-Fetched':String(time)});await cache.put(url,new Response(body,{headers,status:200}));const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-MAX)))await cache.delete(key)}}catch{}}
      return response;
    }catch(error){
      let saved=await cache?.match(url);
      // FX request dates roll forward at midnight; use the last successful reference set offline.
      if(!saved&&cache&&group(url)==='fx'){const keys=await cache.keys();for(const key of keys.reverse()){if(group(key.url)==='fx'){saved=await cache.match(key);break}}}
      if(!saved||!valid(url,await saved.clone().text()))throw error;
      report(url,Number(saved.headers.get('X-InfoDesk-Fetched'))||0,true);return saved;
    }
  }
  const relevant=g=>[...records.values()].filter(x=>x.group===g);
  function stamp(g){const rows=relevant(g),old=rows.filter(x=>x.stale);return (old.length?Math.min(...old.map(x=>x.time)):Math.max(0,...rows.map(x=>x.time)))||Date.now()}
  function begin(g){for(const [url,r]of records)if(r.group===g)records.delete(url)}
  return {fetch:publicFetch,group,allowed,valid,begin,stamp,stale:g=>relevant(g).some(x=>x.stale),status:()=>[...records.values()].map(x=>({...x})),CACHE};
})();
