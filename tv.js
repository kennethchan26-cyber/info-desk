"use strict";
// Presentation only: URL overrides the saved preference; no data/auth state is changed.
window.InfoDeskTV = (() => {
  const key='dashboard_tv_mode',root=document.documentElement;
  let enabled=false,lock=null,pending=false,epoch=0,pageHidden=false,scrollTimer=null;
  let lastStage=null,stageStarted=0,railStarted=0;
  try { const value=new URL(location.href).searchParams.get('tv');enabled=value==='1'||(value!=='0'&&localStorage.getItem(key)==='1');if(value==='1'||value==='0')localStorage.setItem(key,enabled?'1':'0'); } catch {}
  root.classList.toggle('tv-mode',enabled);
  const english=()=>window.InfoDeskI18n?.en()||false;
  function fit(){
    if(!enabled)return;
    const viewport=window.visualViewport,w=viewport?.width||innerWidth,h=viewport?.height||innerHeight;
    root.style.setProperty('--tv-scale',String(Math.min(w/1536,h/864)));
    root.style.setProperty('--tv-center-x',((viewport?.offsetLeft||0)+w/2)+'px');
    root.style.setProperty('--tv-center-y',((viewport?.offsetTop||0)+h/2)+'px');
  }
  function label(){const button=document.querySelector('#tvToggle');if(!button)return;button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',english()?(enabled?'Exit TV mode':'Enter TV mode'):(enabled?'離開 TV 模式':'開啟 TV 模式'));button.title=button.getAttribute('aria-label');button.dataset.awake=String(Boolean(lock&&!lock.released));}
  async function release(){epoch++;const previous=lock;lock=null;label();if(previous)try{await previous.release()}catch{}}
  async function wake(){
    if(!enabled||pageHidden||document.visibilityState!=='visible'||pending||lock||!navigator.wakeLock?.request)return;
    pending=true;const generation=epoch;
    try {const acquired=await navigator.wakeLock.request('screen');
      if(!enabled||pageHidden||document.visibilityState!=='visible'||generation!==epoch){await acquired.release();return}
      lock=acquired;label();acquired.addEventListener('release',()=>{if(lock===acquired){lock=null;label()}});
    }catch{}finally{pending=false;}
  }
  function automaticScroll(){
    if(!enabled||document.hidden)return;
    const now=performance.now(),stage=document.querySelector('.stage.active'),rail=document.querySelector('.data-rail');
    if(stage!==lastStage){lastStage=stage;stageStarted=now;stage?.querySelectorAll('.panel-body,.news-columns').forEach(e=>e.scrollTop=0);if(stage)stage.scrollTop=0;}
    // Read the beginning for 3 seconds, then reveal overflowing rows before the next slide.
    const ratio=Math.min(1,Math.max(0,(now-stageStarted-3000)/10000));
    for(const node of [stage,...(stage?.querySelectorAll('.panel-body,.news-columns')||[])])if(node&&node.scrollHeight>node.clientHeight+2)node.scrollTop=ratio*(node.scrollHeight-node.clientHeight);
    if(rail){const cycle=(now-railStarted)%44000,progress=cycle<3000?0:cycle<21000?(cycle-3000)/18000:cycle<25000?1:1-(cycle-25000)/19000;rail.scrollTop=Math.max(0,rail.scrollHeight-rail.clientHeight)*progress;}
  }
  function startScroll(){clearInterval(scrollTimer);scrollTimer=null;lastStage=null;railStarted=performance.now();if(enabled)scrollTimer=setInterval(automaticScroll,100);}
  function set(value,{url=true}={}){
    enabled=Boolean(value);root.classList.toggle('tv-mode',enabled);try{localStorage.setItem(key,enabled?'1':'0')}catch{}
    if(url)try{const next=new URL(location.href);next.searchParams.set('tv',enabled?'1':'0');history.replaceState(null,'',next)}catch{}
    fit();label();startScroll();if(enabled)wake();else{release();document.querySelectorAll('.stage,.data-rail,.stage .panel-body,.news-columns').forEach(e=>e.scrollTop=0)}
    document.dispatchEvent(new CustomEvent('infodesk:tv',{detail:{enabled}}));window.dispatchEvent(new Event('resize'));
  }
  function init(){document.querySelector('#tvToggle').addEventListener('click',()=>set(!enabled));fit();label();startScroll();wake();
    document.addEventListener('infodesk:language',label);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)release();else wake()});
    window.addEventListener('pagehide',()=>{pageHidden=true;release()});window.addEventListener('pageshow',()=>{pageHidden=false;fit();wake()});
    window.addEventListener('popstate',()=>{const value=new URL(location.href).searchParams.get('tv');if(value==='0'||value==='1')set(value==='1',{url:false})});
    // Retry a silent policy refusal only after a user gesture, never in a polling loop.
    document.addEventListener('pointerdown',wake,{passive:true});
  }
  window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);
  document.addEventListener('DOMContentLoaded',init);fit();
  return {enabled:()=>enabled,set,fit};
})();
