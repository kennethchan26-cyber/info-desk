"use strict";
/* User-editable bus routes + watchlist, stored ONLY in this browser's localStorage.
   Must load right after config.js and before app.js: it swaps CFG.TRANSIT / HK_MARKET / US_MARKET.
   No keys or private data. Bus lookups use the public KMB / Citybus open data APIs. */
(()=>{
  const CFG=window.DASHBOARD_CONFIG,KT='infodesk_user_transit_v1',KW='infodesk_user_watchlist_v1';
  // NR83 is a residents' service: neither KMB nor Citybus open data lists it (checked 30/10/2026),
  // so it is a schedule-only card. 17:45 is Kenneth's usual departure, not an API value.
  CFG.TRANSIT.push({key:'nr83',region:'港島',operator:'居民巴士',route:'NR83',destination:'廣源',destinationEn:'Kwong Yuen',stopName:'中環',stopNameEn:'Central',api:'schedule',times:['17:45'],previewAlert:false});
  const isIndex=x=>x.yahoo.startsWith('^')||x.yahoo==='HSTECH.HK';
  const defaults={transit:CFG.TRANSIT.slice(),hk:CFG.HK_MARKET.filter(x=>!isIndex(x)),us:CFG.US_MARKET.filter(x=>!isIndex(x))};
  const read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
  const t=read(KT);if(Array.isArray(t)&&t.length)CFG.TRANSIT=t.filter(r=>r&&r.key&&r.route);
  const w=read(KW);
  if(w&&Array.isArray(w.hk))CFG.HK_MARKET=[...CFG.HK_MARKET.filter(isIndex),...w.hk];
  if(w&&Array.isArray(w.us))CFG.US_MARKET=[...CFG.US_MARKET.filter(isIndex),...w.us];

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getJSON=async u=>{const r=await fetch(u,{credentials:'omit',cache:'no-store'});if(!r.ok)throw new Error(r.status);return r.json()};
  let draft=null;
  const fresh=()=>({transit:CFG.TRANSIT.map(r=>({...r})),hk:CFG.HK_MARKET.filter(x=>!isIndex(x)).map(x=>({...x})),us:CFG.US_MARKET.filter(x=>!isIndex(x)).map(x=>({...x}))});
  const rowHTML=(list,i,label)=>`<li><span>${label}</span><button type="button" data-act="up" data-list="${list}" data-i="${i}" aria-label="上移">▲</button><button type="button" data-act="down" data-list="${list}" data-i="${i}" aria-label="下移">▼</button><button type="button" data-act="del" data-list="${list}" data-i="${i}" aria-label="刪除">✕</button></li>`;
  function render(){const d=document.getElementById('settingsDialog');
    d.querySelector('#setBusList').innerHTML=draft.transit.map((r,i)=>rowHTML('transit',i,`<b>${esc(r.route)}</b> 往 ${esc(r.destination)} <small>${esc(r.stopName)}</small>`)).join('');
    d.querySelector('#setHkList').innerHTML=draft.hk.map((x,i)=>rowHTML('hk',i,`<b>${esc(x.name)}</b>`)).join('');
    d.querySelector('#setUsList').innerHTML=draft.us.map((x,i)=>rowHTML('us',i,`<b>${esc(x.name)}</b>`)).join('');}
  async function lookupStops(){const d=document.getElementById('settingsDialog'),op=d.querySelector('#busOp').value,route=d.querySelector('#busRoute').value.trim().toUpperCase(),dir=d.querySelector('#busDir').value,sel=d.querySelector('#busStop'),msg=d.querySelector('#busMsg');
    sel.innerHTML='';msg.textContent='查詢中…';if(!/^[A-Z0-9]{1,5}$/.test(route)){msg.textContent='路線號碼不正確';return}
    try{let stops;
      if(op==='kmb'){const j=await getJSON(`https://data.etabus.gov.hk/v1/transport/kmb/route-stop/${route}/${dir==='O'?'outbound':'inbound'}/1`);
        stops=await Promise.all((j.data||[]).map(async x=>{const s=(await getJSON('https://data.etabus.gov.hk/v1/transport/kmb/stop/'+x.stop)).data;return {id:x.stop,name:s.name_tc,en:s.name_en}}));}
      else{const j=await getJSON(`https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/${route}/${dir==='O'?'outbound':'inbound'}`);
        stops=await Promise.all((j.data||[]).map(async x=>{const s=(await getJSON('https://rt.data.gov.hk/v2/transport/citybus/stop/'+x.stop)).data;return {id:x.stop,name:s.name_tc,en:s.name_en}}));}
      if(!stops.length){msg.textContent='官方資料沒有此路線／方向';return}
      const dest=stops[stops.length-1];sel.innerHTML=stops.map((s,i)=>`<option value="${i}">${i+1}. ${esc(s.name)}</option>`).join('');sel._stops=stops;msg.textContent=`往 ${dest.name}：請選上車站`;
    }catch{msg.textContent='暫時未能取得官方站表'}}
  function addBus(){const d=document.getElementById('settingsDialog'),sel=d.querySelector('#busStop'),stops=sel._stops;if(!stops)return;const s=stops[+sel.value];if(draft.transit.some(r=>r.key===`u_${d.querySelector('#busOp').value}_${d.querySelector('#busRoute').value.trim().toUpperCase()}_${d.querySelector('#busDir').value}_${s.id}`)){d.querySelector('#busMsg').textContent='已在清單中';return}const dest=stops[stops.length-1],op=d.querySelector('#busOp').value,route=d.querySelector('#busRoute').value.trim().toUpperCase(),dir=d.querySelector('#busDir').value;
    draft.transit.push({key:`u_${op}_${route}_${dir}_${s.id}`,region:'其他',operator:op==='kmb'?'九巴':'城巴',route,destination:dest.name,destinationEn:dest.en,stopName:s.name,stopNameEn:s.en,api:op,stopId:s.id,direction:dir,serviceType:'1',previewAlert:true});render()}
  function addStock(market){const d=document.getElementById('settingsDialog'),inp=d.querySelector(market==='hk'?'#hkCode':'#usCode');let v=inp.value.trim().toUpperCase();if(!v)return;
    const msg=d.querySelector('#stockMsg');msg.textContent='';const dup=y=>{if([...draft.hk,...draft.us].some(x=>x.yahoo===y)){msg.textContent='已在清單中';return true}};
    if(market==='hk'){if(!/^\d{1,5}$/.test(v))return;v=v.padStart(4,'0');if(dup(v+'.HK'))return;draft.hk.push({yahoo:v+'.HK',name:v})}else{if(!/^[A-Z.\-]{1,6}$/.test(v))return;if(dup(v.replace('.','-')))return;draft.us.push({yahoo:v.replace('.','-'),name:v})}inp.value='';render()}
  function build(){const d=document.createElement('dialog');d.id='settingsDialog';d.className='settings-dialog';d.innerHTML=`<form method="dialog"><h2>設定 <small>只儲存在此瀏覽器</small></h2>
<h3>巴士路線</h3><ol id="setBusList" class="set-list"></ol>
<div class="set-add"><select id="busOp"><option value="kmb">九巴 KMB</option><option value="ctb">城巴 Citybus</option></select><input id="busRoute" placeholder="路線 e.g. 680" size="6"><select id="busDir"><option value="O">去程</option><option value="I">回程</option></select><button type="button" id="busLookup">找站</button></div>
<div class="set-add"><select id="busStop"></select><button type="button" id="busAdd">加入</button></div><p id="busMsg" class="set-msg"></p>
<h3>港股自選</h3><ol id="setHkList" class="set-list"></ol><div class="set-add"><input id="hkCode" placeholder="代號 e.g. 0700" size="8"><button type="button" data-add="hk">加入</button></div>
<h3>美股自選</h3><ol id="setUsList" class="set-list"></ol><div class="set-add"><input id="usCode" placeholder="代號 e.g. AAPL" size="8"><button type="button" data-add="us">加入</button></div>
<p id="stockMsg" class="set-msg"></p><p class="set-msg">指數固定顯示。新增股票如不在長橋快照內，會自動改用後備報價。</p>
<div class="set-actions"><button type="button" id="setReset">還原預設</button><button value="cancel">取消</button><button type="button" id="setSave" class="primary">儲存</button></div></form>`;
    document.body.append(d);
    d.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.act;
      if(a){const L=draft[b.dataset.list],i=+b.dataset.i;if(a==='del')L.splice(i,1);else{const j=a==='up'?i-1:i+1;if(j>=0&&j<L.length)[L[i],L[j]]=[L[j],L[i]]}render();return}
      if(b.dataset.add)addStock(b.dataset.add);else if(b.id==='busLookup')lookupStops();else if(b.id==='busAdd')addBus();
      else if(b.id==='setReset'){draft={transit:defaults.transit.map(r=>({...r})),hk:defaults.hk.map(x=>({...x})),us:defaults.us.map(x=>({...x}))};render()}
      else if(b.id==='setSave'){const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);/* defaults are not frozen into storage, so future config.js edits still apply */
        same(draft.transit,defaults.transit)?localStorage.removeItem(KT):localStorage.setItem(KT,JSON.stringify(draft.transit));
        same(draft.hk,defaults.hk)&&same(draft.us,defaults.us)?localStorage.removeItem(KW):localStorage.setItem(KW,JSON.stringify({hk:draft.hk,us:draft.us}));location.reload()}});
    return d}
  document.addEventListener('DOMContentLoaded',()=>{const bar=document.querySelector('.header-actions');if(!bar)return;const b=document.createElement('button');b.id='settingsOpen';b.className='btn';b.type='button';b.textContent='設定';bar.prepend(b);
    b.onclick=()=>{const d=document.getElementById('settingsDialog')||build();draft=fresh();render();d.showModal()}});
  window.InfoDeskUserSettings={defaults,isIndex};
})();
