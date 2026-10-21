"use strict";
// Presentation only: URL overrides the saved preference; no data/auth state is changed.
window.InfoDeskTV = (() => {
  const key='dashboard_tv_mode',root=document.documentElement;
  let enabled=false,lock=null,pending=false,epoch=0,pageHidden=false,fitFrame=0;
  const WIDTH=1920,HEIGHT=1080;
  try { const value=new URL(location.href).searchParams.get('tv');enabled=value==='1'||(value!=='0'&&localStorage.getItem(key)==='1');if(value==='1'||value==='0')localStorage.setItem(key,enabled?'1':'0'); } catch {}
  root.classList.toggle('tv-mode',enabled);
  const english=()=>window.InfoDeskI18n?.en()||false;
  function fit(){
    if(!enabled)return;
    const viewport=window.visualViewport,w=viewport?.width||innerWidth,h=viewport?.height||innerHeight;
    // Native 1080-high canvas follows the viewport aspect, including 19.5:9 iPhones.
    root.style.setProperty('--tv-width',(HEIGHT*w/h)+'px');
    root.style.setProperty('--tv-scale',String(h/HEIGHT));
    root.style.setProperty('--tv-center-x',((viewport?.offsetLeft||0)+w/2)+'px');
    root.style.setProperty('--tv-center-y',((viewport?.offsetTop||0)+h/2)+'px');
  }
  function scheduleFit(){if(fitFrame)return;fitFrame=requestAnimationFrame(()=>{fitFrame=0;fit()});}
  function tickerChanged(){
    if(enabled)window.InfoDeskTVPanels?.refresh();
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
  function visibility(){root.classList.toggle('tv-background',Boolean(document.hidden||pageHidden));if(document.hidden||pageHidden)release();else wake();}
  function set(value,{url=true}={}){
    enabled=Boolean(value);root.classList.toggle('tv-mode',enabled);try{localStorage.setItem(key,enabled?'1':'0')}catch{}
    if(url)try{const next=new URL(location.href);next.searchParams.set('tv',enabled?'1':'0');history.replaceState(null,'',next)}catch{}
    fit();label();if(enabled)wake();else release();
    document.dispatchEvent(new CustomEvent('infodesk:tv',{detail:{enabled}}));window.dispatchEvent(new Event('resize'));
  }
  function init(){document.querySelector('#tvToggle').addEventListener('click',()=>set(!enabled));fit();label();wake();
    // Do not depend on CSS :has() support on older Safari; preserve crypto's saved state.
    const crypto=document.querySelector('#cryptoToggle');if(crypto){const sync=()=>crypto.closest('.crypto-panel')?.classList.toggle('tv-collapsed',crypto.getAttribute('aria-expanded')!=='true');new MutationObserver(sync).observe(crypto,{attributes:true,attributeFilter:['aria-expanded']});sync();}
    document.addEventListener('infodesk:language',label);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',()=>{pageHidden=true;visibility()});window.addEventListener('pageshow',()=>{pageHidden=false;fit();visibility()});
    window.addEventListener('popstate',()=>{const value=new URL(location.href).searchParams.get('tv');if(value==='0'||value==='1')set(value==='1',{url:false})});
    // Retry a silent policy refusal only after a user gesture, never in a polling loop.
    document.addEventListener('pointerdown',wake,{passive:true});
  }
  window.addEventListener('resize',scheduleFit);window.addEventListener('orientationchange',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('scroll',scheduleFit);
  document.fonts?.ready.then(()=>{fit();tickerChanged()});
  document.addEventListener('DOMContentLoaded',init);fit();
  return {enabled:()=>enabled,set,fit,tickerChanged};
})();
