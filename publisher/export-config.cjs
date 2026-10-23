'use strict';
// Export public configuration, never browser storage or CLI authentication files.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.createContext(context);
for(const file of ['config.js','nasdaq100.js','market-calendar.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const c=context.window.DASHBOARD_CONFIG,calendar=context.window.InfoDeskCalendar;
const watch=[...c.HK_MARKET,...c.US_MARKET];
const symbols=[...new Set([...watch.map(x=>x.yahoo),...(context.window.INFO_DESK_NASDAQ?.stocks||[]).map(x=>x.symbol)])];
const map=s=>c.LONGBRIDGE.SYMBOLS[s]||(/\.HK$/.test(s)?String(Number(s.split('.')[0]))+'.HK':s+'.US');
const now=Date.now();
const day=calendar.dateKey(now,'America/New_York'),tomorrow=calendar.dateKey(now+86400000,'America/New_York'),p=calendar.parts(now,'America/New_York'),minutes=+p.hour*60+ +p.minute;
const regular=calendar.schedule('US',day)||[],next=calendar.schedule('US',tomorrow)||[];
const active=calendar.status('HK',now).trading || (regular.length>0&&minutes<1200) || (next.length>0&&minutes>=1200);
console.log(JSON.stringify({active,settings:c.LONGBRIDGE,symbols:Object.fromEntries(symbols.map(s=>[s,map(s)])),watch:watch.map(x=>({yahoo:x.yahoo,name:x.name,symbol:map(x.yahoo),index:Boolean(x.yahoo.startsWith('^')||x.yahoo==='HSTECH.HK')})),sessions:Object.fromEntries(['HK','US'].map(m=>[m,calendar.status(m,now)]))}));
