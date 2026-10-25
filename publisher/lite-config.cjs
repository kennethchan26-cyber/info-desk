'use strict';
// Project only public routing/settings, never Gmail configuration or credentials.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'config.js'),'utf8'),context,{timeout:1000});
const c=context.window.DASHBOARD_CONFIG;
const out={schema:1,routes:c.TRANSIT,currencies:c.FX.CURRENCIES,fxUrl:c.FX.API,marketUrl:c.LONGBRIDGE.URL};
const json=JSON.stringify(out,null,2)+'\n';
if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),json);else process.stdout.write(json);
