"use strict";
// Stable insertion order with a 60-second deadband. Called only after an ETA refresh or a user toggle.
window.InfoDeskTransitOrder = (routes,results,previous=[],enabled=true) => {
  const configured=routes.map(r=>r.key);if(!enabled)return configured;
  const arrival=new Map(routes.map((r,i)=>{const x=results[i];const t=x?.status==='fulfilled'&&x.value?.length?Date.parse(x.value[0].iso):NaN;return [r.key,Number.isFinite(t)?t:Infinity]}));
  const order=[...previous.filter(k=>configured.includes(k)),...configured.filter(k=>!previous.includes(k))];
  for(let i=1;i<order.length;i++){let j=i;while(j>0){const a=arrival.get(order[j-1]),b=arrival.get(order[j]);if(b!==Infinity&&(a===Infinity||a-b>=60000)){[order[j-1],order[j]]=[order[j],order[j-1]];j--}else break}}
  return order;
};
