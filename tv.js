"use strict";
// Presentation only: URL overrides the saved preference; no data/auth state is changed.
window.InfoDeskTV = (() => {
  const key='dashboard_tv_mode',root=document.documentElement;
  let enabled=false,lock=null,pending=false,epoch=0,pageHidden=false,scrollTimer=null;
  let lastStage=null,stageStarted=0,railStarted=0,lastStep=-1,lastRailStep=-1,fitFrame=0,tickerAnimation=null,tickerNode=null;
  const WIDTH=1920,HEIGHT=1080,TICKER_SPEED=90; // Logical pixels/second: independent of quote count and screen size.
  try { const value=new URL(location.href).searchParams.get('tv');enabled=value==='1'||(value!=='0'&&localStorage.getItem(key)==='1');if(value==='1'||value==='0')localStorage.setItem(key,enabled?'1':'0'); } catch {}
  root.classList.toggle('tv-mode',enabled);
  const english=()=>window.InfoDeskI18n?.en()||false;
  function fit(){
    if(!enabled)return;
    const viewport=window.visualViewport,w=viewport?.width||innerWidth,h=viewport?.height||innerHeight;
    root.style.setProperty('--tv-scale',String(Math.min(w/WIDTH,h/HEIGHT)));
    root.style.setProperty('--tv-center-x',((viewport?.offsetLeft||0)+w/2)+'px');
    root.style.setProperty('--tv-center-y',((viewport?.offsetTop||0)+h/2)+'px');
  }
  function scheduleFit(){if(fitFrame)return;fitFrame=requestAnimationFrame(()=>{fitFrame=0;fit()});}
  function tickerChanged(){
    const node=document.querySelector('#tickerTrack'),width=node?.firstElementChild?.getBoundingClientRect().width;
    // offsetWidth is untransformed: the same speed is used at FHD and on a scaled phone.
    const logicalWidth=node?.firstElementChild?.offsetWidth;
    if(!enabled||!node||!width||!logicalWidth)return;
    const elapsed=Number(tickerAnimation?.currentTime)||0,distance=elapsed*TICKER_SPEED/1000;
    tickerAnimation?.cancel();tickerNode=node;
    const duration=logicalWidth/TICKER_SPEED*1000;
    node.style.setProperty('--tv-ticker-duration',duration+'ms');
    if(node.animate){node.dataset.tvTicker='waapi';tickerAnimation=node.animate([{transform:'translateX(0)'},{transform:`translateX(-${logicalWidth}px)`}],{duration,iterations:Infinity,easing:'linear'});tickerAnimation.currentTime=(distance%logicalWidth)/TICKER_SPEED*1000;if(document.hidden)tickerAnimation.pause();}
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
    if(stage!==lastStage){lastStage=stage;stageStarted=now;lastStep=-1;stage?.querySelectorAll('.panel-body,.news-columns').forEach(e=>e.scrollTop=0);if(stage)stage.scrollTop=0;}
    // Hold still for reading; page overflowing content only every 5/12 seconds.
    // No continuous JS scrolling or repeated layout reads at 10 fps on older phones.
    const step=Math.floor((now-stageStarted)/5000);
    if(step!==lastStep){lastStep=step;for(const node of [stage,...(stage?.querySelectorAll('.panel-body,.news-columns')||[])])if(node&&node.scrollHeight>node.clientHeight+2)node.scrollTop=Math.min(1,step/2)*(node.scrollHeight-node.clientHeight);}
    const railStep=Math.floor((now-railStarted)/12000);
    if(rail&&railStep!==lastRailStep){lastRailStep=railStep;const span=Math.max(0,rail.scrollHeight-rail.clientHeight),pages=Math.ceil(span/(rail.clientHeight*.85))+1;rail.scrollTop=Math.min(span,(railStep%pages)*rail.clientHeight*.85);}
  }
  function startScroll(){clearInterval(scrollTimer);scrollTimer=null;lastStage=null;lastStep=-1;lastRailStep=-1;railStarted=performance.now();if(enabled&&!document.hidden&&!pageHidden)scrollTimer=setInterval(automaticScroll,1000);}
  function visibility(){root.classList.toggle('tv-background',Boolean(document.hidden||pageHidden));startScroll();if(document.hidden||pageHidden){tickerAnimation?.pause();release()}else{tickerAnimation?.play();wake();}}
  function set(value,{url=true}={}){
    enabled=Boolean(value);root.classList.toggle('tv-mode',enabled);try{localStorage.setItem(key,enabled?'1':'0')}catch{}
    if(url)try{const next=new URL(location.href);next.searchParams.set('tv',enabled?'1':'0');history.replaceState(null,'',next)}catch{}
    fit();label();startScroll();if(enabled){tickerChanged();wake()}else{tickerAnimation?.cancel();tickerAnimation=null;if(tickerNode){delete tickerNode.dataset.tvTicker;tickerNode.style.removeProperty('--tv-ticker-duration')}release();document.querySelectorAll('.stage,.data-rail,.stage .panel-body,.news-columns').forEach(e=>e.scrollTop=0)}
    document.dispatchEvent(new CustomEvent('infodesk:tv',{detail:{enabled}}));window.dispatchEvent(new Event('resize'));
  }
  function init(){document.querySelector('#tvToggle').addEventListener('click',()=>set(!enabled));fit();label();startScroll();wake();
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
