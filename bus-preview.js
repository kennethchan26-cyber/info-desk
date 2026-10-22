"use strict";
// ETA APIs do not expose vehicle IDs. Track each continuous next-departure observation
// instead of exact timestamps (which drift). A later departure after the first is due
// or an empty service result starts a new observation. No persistent/private storage.
window.InfoDeskBusPreview = (() => {
  const tracks=new Map();
  function observe(route,eta,minutes=12,now=Date.now()) {
    const key=route.key,previous=tracks.get(key),time=Date.parse(eta?.iso);
    if(!eta||!Number.isFinite(time)){tracks.set(key,{empty:true});return false;}
    const remaining=(time-now)/60000;
    const fresh=!previous||previous.empty||
      (previous.remaining<=3&&remaining>6&&time-previous.time>240000);
    const row=fresh?{time,remaining,notified:false}:previous;
    const first=!previous;row.time=time;row.remaining=remaining;
    const near=remaining>minutes-1&&remaining<=minutes+.5;
    const fire=!first&&!row.notified&&near&&route.previewAlert!==false;
    // First successful load is a silent baseline, including an already-due preview.
    if(near&&(first||fire))row.notified=true;
    tracks.set(key,row);return fire;
  }
  return {observe,reset:()=>tracks.clear()};
})();
