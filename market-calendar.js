/* Cash-equity calendars, verified 21/10/2026; no live halt feed.
 * https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2025/ce_SEHK_CT_075_2025.pdf
 * https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2026/ce_SEHK_CT_077_2026.pdf
 * https://www.nyse.com/trade/hours-calendars
 * HK closes continuous trading at 16:00 / 12:00 half-day, excluding closing auction.
 */
"use strict";
window.InfoDeskCalendar = (() => {
  const calendars = {
    HK: {name:"港股",zone:"Asia/Hong_Kong",closed:[
      "2026-01-01","2026-02-17","2026-02-18","2026-02-19","2026-04-03","2026-04-06","2026-04-07","2026-05-01","2026-05-25","2026-06-19","2026-07-01","2026-10-01","2026-10-19","2026-12-25",
      "2027-01-01","2027-02-08","2027-02-09","2027-03-26","2027-03-29","2027-04-05","2027-05-13","2027-06-09","2027-07-01","2027-09-16","2027-10-01","2027-10-08","2027-12-27"
    ],early:{"2026-02-16":"12:00","2026-12-24":"12:00","2026-12-31":"12:00","2027-02-05":"12:00","2027-12-24":"12:00","2027-12-31":"12:00"}},
    US: {name:"美股",zone:"America/New_York",closed:[
      "2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25",
      "2027-01-01","2027-01-18","2027-02-15","2027-03-26","2027-05-31","2027-06-18","2027-07-05","2027-09-06","2027-11-25","2027-12-24"
    ],early:{"2026-11-27":"13:00","2026-12-24":"13:00","2027-11-26":"13:00"}}
  };
  const formatters=new Map();
  function parts(time,zone){if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}));return Object.fromEntries(formatters.get(zone).formatToParts(new Date(time)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));}
  function dateKey(time,zone){const p=parts(time,zone);return `${p.year}-${p.month}-${p.day}`;}
  function instant(day,hm,zone){const [y,m,d]=day.split("-").map(Number),[h,n]=hm.split(":").map(Number);const target=Date.UTC(y,m-1,d,h,n);let guess=target;for(let i=0;i<3;i++){const p=parts(guess,zone);const wall=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);guess+=target-wall;}return guess;}
  const addDay=(day,n)=>new Date(Date.parse(day+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
  function schedule(market,day){const c=calendars[market];if(!/^202[67]-/.test(day))return null;const dow=new Date(day+"T12:00:00Z").getUTCDay();if(dow===0||dow===6||c.closed.includes(day))return [];
    const e=c.early[day];let rows=[['開市','09:30'],['收市',e||'16:00']];if(market==='HK'&&!e)rows=[['開市','09:30'],['午休','12:00'],['午市開市','13:00'],['收市','16:00']];
    return rows.map(([type,hm])=>({type,time:instant(day,hm,c.zone),day,early:!!e}));
  }
  function status(market,now=Date.now()) {const c=calendars[market],day=dateKey(now,c.zone),today=schedule(market,day);if(today===null)return {market,name:c.name,unknown:true,trading:false,reason:'交易日曆待更新'};
    const open=today[0],close=today.at(-1);const trading=!!open&&now>=open.time&&now<close.time&&!(market==='HK'&&today.length===4&&now>=today[1].time&&now<today[2].time);
    let next=today.find(e=>e.time>now),session=today;
    if(!next)for(let i=1;i<=16;i++){const s=schedule(market,addDay(day,i));if(s===null)break;if(s.length){next=s[0];session=s;break;}}
    if(!next)return {market,name:c.name,unknown:true,trading,reason:'下一年度交易日曆待更新'};
    const hkFmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const start=session[0].time,end=session.at(-1).time,cross=dateKey(start,'Asia/Hong_Kong')!==dateKey(end,'Asia/Hong_Kong');
    return {market,name:c.name,next,trading,remaining:Math.max(0,next.time-now),reason:trading?'交易中':today.length===4&&now>=today[1].time&&now<today[2].time?'休市・午休':'休市',hours:`香港時間 ${hkFmt.format(start)} – ${cross?'翌日 ':''}${hkFmt.format(end)}${session[0].early?'（半日市）':''}`,sessionDay:session[0].day};
  }
  function duration(ms){const s=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;return h?`${h}<small>小時</small> ${String(m).padStart(2,'0')}<small>分</small>`:`${m}<small>分</small> ${String(sec).padStart(2,'0')}<small>秒</small>`;}
  function commute(now=Date.now()){const p=parts(now,'Asia/Hong_Kong'),day=dateKey(now,'Asia/Hong_Kong'),dow=new Date(day+'T12:00:00Z').getUTCDay(),min=+p.hour*60+ +p.minute;return dow>0&&dow<6&&((min>=420&&min<570)||(min>=1050&&min<1200));}
  return {calendars,parts,dateKey,instant,schedule,status,duration,commute};
})();
