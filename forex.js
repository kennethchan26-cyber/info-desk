"use strict";
// One public request for all currencies. No rounding until display.
window.InfoDeskFX = (()=>{
  function convert(rows,currencies){
    return currencies.map(currency=>{
      const valid=rows.filter(r=>r.base==='HKD'&&r.quote===currency.code&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(Number(r.rate))&&Number(r.rate)>0);
      const days=[...new Map(valid.map(r=>[r.date,r])).values()].sort((a,b)=>b.date.localeCompare(a.date));
      if(!days.length)return {...currency,error:true};
      const current=currency.units/Number(days[0].rate),previous=days[1]?currency.units/Number(days[1].rate):null;
      return {...currency,price:current,previous,change:previous===null?null:current-previous,pct:previous===null?null:(current/previous-1)*100,date:days[0].date,previousDate:days[1]?.date};
    });
  }
  function query(config,now=Date.now()){
    const to=window.InfoDeskCalendar.dateKey(now,'Asia/Hong_Kong'),from=new Date(Date.parse(to+'T12:00:00Z')-21*86400000).toISOString().slice(0,10);
    return config.API+'?'+new URLSearchParams({base:'HKD',quotes:config.CURRENCIES.map(x=>x.code).join(','),from,to});
  }
  return {convert,query};
})();
