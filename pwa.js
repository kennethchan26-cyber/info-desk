"use strict";
window.InfoDeskPWA=(()=>{
  let installPrompt=null,registration=null,updating=false;
  const q=s=>document.querySelector(s),english=()=>window.InfoDeskI18n?.en(),t=s=>window.InfoDeskI18n?.t(s)||s;
  const mobile=()=>/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function offlineStatus(){const rows=window.InfoDeskNetwork?.status()||[],stale=rows.filter(x=>x.stale),offline=navigator.onLine===false,node=q('#offlineNotice');if(!node)return;node.hidden=!offline&&!stale.length;if(node.hidden)return;
    const times=(stale.length?stale:rows).map(x=>x.time).filter(Boolean),time=times.length?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Math.min(...times))):'—';
    node.textContent=offline?(english()?`OFFLINE · SHOWING DATA FROM ${time}`:`離線中・顯示 ${time} 的數據`):(english()?`SOME SOURCES OFFLINE · CACHED DATA FROM ${time}`:`部分來源未連線・顯示 ${time} 的快取數據`);
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if(q('#installApp'))q('#installApp').hidden=false});
  window.addEventListener('appinstalled',()=>{installPrompt=null;q('#installApp').hidden=true});
  function shortcuts(){document.querySelectorAll('.quickbar [data-app]').forEach(a=>a.onclick=e=>{
    if(!mobile())return;
    // Threads uses its supported HTTPS universal/app link. The OS selects the installed app.
    if(a.dataset.app==='threads'){e.preventDefault();location.href=a.href;return}
    e.preventDefault();const scheme=a.dataset.app==='gmail'?'googlegmail:///':'whatsapp://',fallback=a.href;
    let left=false;const hide=()=>{if(document.hidden)left=true};document.addEventListener('visibilitychange',hide);
    location.href=scheme;setTimeout(()=>{document.removeEventListener('visibilitychange',hide);if(!left&&!document.hidden)location.href=fallback},1800);
  })}
  async function init(){
    shortcuts();offlineStatus();document.addEventListener('infodesk:network',offlineStatus);document.addEventListener('infodesk:language',offlineStatus);window.addEventListener('online',offlineStatus);window.addEventListener('offline',offlineStatus);
    if(location.protocol==='chrome-extension:'||!('serviceWorker' in navigator)||!window.isSecureContext)return;
    q('#installApp').hidden=matchMedia('(display-mode:standalone)').matches||Boolean(navigator.standalone);
    q('#installApp').onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}q('#installHelp').hidden=false;q('#installHelp').textContent=mobile()?t('Safari：分享 → 加入主畫面'):t('Chrome：選單 → 投放、儲存及分享 → 安裝網頁為應用程式');};
    try{
      registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      const ready=()=>{if(registration.waiting&&navigator.serviceWorker.controller)q('#updateApp').hidden=Boolean(window.InfoDeskTV?.enabled())};ready();
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',ready)});
      q('#updateApp').onclick=()=>{if(!registration.waiting){registration.update();return}updating=true;registration.waiting.postMessage({type:'SKIP_WAITING'})};
      document.addEventListener('infodesk:pagechange',()=>{if(window.InfoDeskTV?.enabled()&&registration.waiting&&!updating){updating=true;registration.waiting.postMessage({type:'SKIP_WAITING'})}});
      document.addEventListener('infodesk:tv',ready);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload()});
      registration.update().catch(()=>{});setInterval(()=>registration.update().catch(()=>{}),900000);
    }catch{q('#installHelp').hidden=false;q('#installHelp').textContent=t('離線介面未能儲存；請保持網絡連線並重新整理。')}
  }
  document.addEventListener('DOMContentLoaded',init);
  return {offlineStatus};
})();
