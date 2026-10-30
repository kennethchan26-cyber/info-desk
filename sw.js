"use strict";
const VERSION='20261023-longbridge4',SHELL='infodesk-shell-'+VERSION,FONTS='infodesk-fonts-v1';
const ASSETS=['longbridge-data.js','market-pulse.js','market-pulse.css','bus-preview.js','user-settings.js','nasdaq100.js','heatmap.js','tv-rail.js','index.html','styles.css','tv.css','tv.js','tv-panels.js','display.js','display.css','charts.js','charts.css','chart-widget.html','chart-widget.js','lightweight-charts.standalone.production.js','config.js','i18n.js','public-data.js','market-calendar.js','forex.js','transit-order.js','app.js','news-extra.js','broadcast.js','signals.js','pwa.js','app.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','icon-maskable-512.png','barlow-condensed.woff2'];
const base=new URL('./',self.location.href);
const FONT_CSS='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Noto+Sans+TC:wght@500;700;900&display=swap';
async function warmFonts(){
  try{const cache=await caches.open(FONTS),r=await fetch(FONT_CSS,{credentials:'omit'});if(!r.ok)return;await cache.put(FONT_CSS,r.clone());const css=await r.text(),urls=[...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m=>m[1]))];
    // Optional CJK font subsets; a bundled Latin font and system CJK fallback are always available.
    let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<urls.length){const url=urls[cursor++];if(await cache.match(url))continue;try{const res=await fetch(url,{credentials:'omit'});if(res.ok)await cache.put(url,res)}catch{}}}));
  }catch{}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(SHELL);await Promise.all(ASSETS.map(async path=>{const url=new URL(path,base),fetchURL=new URL(url);fetchURL.searchParams.set('build',VERSION);const response=await fetch(fetchURL,{cache:'reload',credentials:'omit'});if(!response.ok)throw new Error('Missing shell asset '+path);await cache.put(url,response)}));})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('infodesk-shell-')&&name!==SHELL)await caches.delete(name);await self.clients.claim();await warmFonts()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Never intercept personal/auth requests, POSTs or arbitrary same-origin URLs.
  if(request.method!=='GET'||request.headers.has('Authorization'))return;
  if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)){
    const relative=url.pathname.slice(base.pathname.length),asset=relative===''?'index.html':relative;
    if(!ASSETS.includes(asset))return;
    event.respondWith((async()=>{const cache=await caches.open(SHELL),cached=await cache.match(new URL(asset,base));return cached||fetch(request)})());return;
  }
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    event.respondWith((async()=>{const cache=await caches.open(FONTS),cached=await cache.match(request);if(cached)return cached;const res=await fetch(request);if(res.ok)await cache.put(request,res.clone());return res})());
  }
  // Anonymous data are network-first in public-data.js (also used by the extension).
  // Gmail and all Google Identity endpoints deliberately pass straight through.
});
