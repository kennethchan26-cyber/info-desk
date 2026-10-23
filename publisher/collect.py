"""INFO//DESK public market publisher. Python stdlib only; CLI owns all credentials.

No auth file is opened. No account/trading command is allowed. Raw CLI output and
stderr are never persisted. Only explicit public fields enter market.json.
"""
from __future__ import annotations
import argparse, concurrent.futures, datetime as dt, json, math, os, pathlib
import shutil, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[1]
LOCAL = pathlib.Path(os.environ.get('LOCALAPPDATA', str(pathlib.Path.home()))) / 'INFO-DESK' / 'publisher'
REPO = 'https://github.com/kennethchan26-cyber/info-desk.git'
ALLOWED = {'quote','intraday','market-temp','market-status','capital','anomaly','ah-premium','finance-calendar','screener'}
UTC = dt.timezone.utc
HKT = dt.timezone(dt.timedelta(hours=8))
CLI = pathlib.Path(os.environ.get('LOCALAPPDATA','')) / 'Programs/longbridge/longbridge.exe'
FAILURES = []
CREATE_NO_WINDOW = 0x08000000 if os.name == 'nt' else 0

def stamp(): return dt.datetime.now(UTC).isoformat(timespec='seconds').replace('+00:00','Z')
def epoch(value):
    try: return dt.datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()
    except (ValueError, TypeError, AttributeError): return 0
def num(value):
    try:
        x=float(value)
        return x if math.isfinite(x) else None
    except (TypeError,ValueError): return None
def run(args, input=None, timeout=50):
    result=subprocess.run([str(x) for x in args],input=input,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=timeout,creationflags=CREATE_NO_WINDOW)
    if result.returncode: raise RuntimeError('COMMAND_FAILED')
    return result.stdout
def call(*args):
    if not args or args[0] not in ALLOWED or '--filter' in args or any(x in args for x in ('positions','watchlist','--verbose','-v')):
        raise ValueError('FORBIDDEN_COMMAND')
    try: return json.loads(run([CLI,*args,'--format','json','--lang','en']))
    except Exception:
        FAILURES.append(args[0])  # Classification only: never exception bodies/headers.
        return None
def parallel(jobs):
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(lambda f:f(),jobs))
def fresh(obj, seconds): return isinstance(obj,dict) and 0<=time.time()-epoch(obj.get('fetchedAt'))<seconds
def public_quote(row, fetched):
    price,previous=num(row.get('last')),num(row.get('prev_close'))
    if price is None or price<=0 or previous is None or previous<=0:return None
    # Keep regular-session prices consistent with the existing daily-change board.
    # Extended-hours prices are separate, never silently mixed into regular returns.
    extended={}
    for name in ('pre_market','post_market','overnight'):
        x=row.get(name)
        if isinstance(x,dict) and num(x.get('last')):
            extended[name]={'price':num(x['last']),'time':x.get('timestamp')}
    return {'symbol':row['symbol'],'price':price,'previous':previous,'change':price-previous,'pct':(price/previous-1)*100,'high':num(row.get('high')),'low':num(row.get('low')),'volume':num(row.get('volume')),'turnover':num(row.get('turnover')),'fetchedAt':fetched,'quoteTime':None,'extended':extended}

def collect(config, old):
    now=stamp(); data={'schema':1,'publisher':'INFO-DESK-LONGBRIDGE','collectedAt':now,'quotes':dict(old.get('quotes',{})),'intraday':dict(old.get('intraday',{})),'extras':dict(old.get('extras',{})),'fx':{'provider':'Frankfurter','reason':'Longbridge public exchange-rate returned no rates'},'regularSessionPrices':True}
    mapping=config['symbols']; reverse={v:k for k,v in mapping.items()}; symbols=list(reverse)
    result=parallel([lambda batch=symbols[i:i+100]:call('quote',*batch) for i in range(0,len(symbols),100)])
    successes=0
    for batch in result:
        if not isinstance(batch,list):continue
        for row in batch:
            q=public_quote(row,now)
            if q and row.get('symbol') in reverse:
                data['quotes'][reverse[row['symbol']]]=q;successes+=1
    if not successes: raise RuntimeError('NO_QUOTES')  # Never freshen an old snapshot on failure.
    due=[x for x in config['watch'] if not fresh(data['intraday'].get(x['yahoo']),config['settings']['INTRADAY_SECONDS'])]
    lines=parallel([lambda x=x:call('intraday',x['symbol']) for x in due])
    for item,rows in zip(due,lines):
        if not isinstance(rows,list):continue
        points=[]
        for r in rows:
            t=epoch(r.get('time')); p=num(r.get('price')); v=num(r.get('volume'))
            if t and p and p>0:points.append([int(t),p,v])
        if len(points)>1:data['intraday'][item['yahoo']]={'fetchedAt':stamp(),'points':sorted(points),'granularity':'1m'}
    extras=data['extras']; interval=config['settings']['EXTRAS_SECONDS']
    old_pulse=extras.get('pulse',{})
    needs_temperature=not fresh(old_pulse,interval) or any(not fresh(old_pulse.get('temperature',{}).get(m),interval) for m in ('HK','US'))
    if needs_temperature:
        # Serial quote contexts avoid intermittent provider rejection of simultaneous temperature calls.
        temps=[call('market-temp',m) for m in ('HK','US')]; statuses=call('market-status')
        temperature={m:{**v,'fetchedAt':v.get('fetchedAt',old_pulse.get('fetchedAt'))} for m,v in old_pulse.get('temperature',{}).items()}
        for m,rows in zip(('HK','US'),temps):
            if not isinstance(rows,list):continue
            d={r.get('field'):r.get('value') for r in rows}
            if num(d.get('Temperature')) is not None:temperature[m]={'temperature':num(d.get('Temperature')),'valuation':num(d.get('Valuation')),'sentiment':num(d.get('Sentiment')),'description':str(d.get('Description',''))[:180],'fetchedAt':stamp()}
        if temperature:extras['pulse']={'fetchedAt':stamp(),'temperature':temperature,'status':{r['market']:r['status'] for r in (statuses or []) if r.get('market') in ('HK','US')}}
    if not fresh(extras.get('capital'),interval):
        watch=[x for x in config['watch'] if not x['index']]; capital=parallel([lambda x=x:call('capital',x['symbol']) for x in watch]); items=[]
        for x,r in zip(watch,capital):
            if not isinstance(r,dict):continue
            ci,co=r.get('capital_in',{}),r.get('capital_out',{})
            # Definition is explicit: large orders only, not a fabricated institutional flow.
            a,b=num(ci.get('large')),num(co.get('large'))
            if a is not None and b is not None:items.append({'symbol':x['symbol'],'name':x['name'],'net':a-b,'time':r.get('timestamp'),'currency':'HKD' if x['symbol'].endswith('.HK') else 'USD'})
        if items:extras['capital']={'fetchedAt':stamp(),'items':items,'definition':'large-order inflow minus large-order outflow'}
    if not fresh(extras.get('anomalies'),120):
        results=parallel([lambda m=m:call('anomaly','--market',m,'--count','8') for m in ('HK','US')]); items=[]
        for r in results:
            for x in (r or {}).get('changes',[]):
                items.append({k:x.get(k) for k in ('symbol','name','alert_name','alert_time','change_values')})
        if any(r is not None for r in results):extras['anomalies']={'fetchedAt':stamp(),'items':items}
    if not fresh(extras.get('ah'),interval):
        items=[]
        for symbol in config['settings']['AH']:
            r=call('ah-premium',symbol,'--count','1'); rows=(r or {}).get('klines',[])
            if rows:
                x=rows[-1]; a,h,fx=num(x.get('aprice')),num(x.get('hprice')),num(x.get('currency_rate'))
                # Published ratio is H price in CNY / A price - 1. Show that exact definition.
                items.append({'symbol':symbol,'aPrice':a,'hPrice':h,'rate':fx,'hVsAPct':num(x.get('ahpremium_rate'))*100 if num(x.get('ahpremium_rate')) is not None else None,'time':x.get('timestamp')})
        if items:extras['ah']={'fetchedAt':stamp(),'items':items}
    if not fresh(extras.get('calendar'),interval):
        today=dt.datetime.now(HKT).date(); end=today+dt.timedelta(days=7); items=[]
        jobs=[(kind,m) for kind in ('report','dividend') for m in ('HK','US')]+[('macrodata','US')]
        results=parallel([lambda k=k,m=m:call('finance-calendar',k,'--market',m,'--start',str(today),'--end',str(end),'--count','100',*(['--star','3'] if k=='macrodata' else [])) for k,m in jobs])
        watched={x['symbol'] for x in config['watch']}
        for (kind,m),r in zip(jobs,results):
            for group in (r or {}).get('list',[]):
                for x in group.get('infos',[]):
                    t=num(x.get('datetime')); day=dt.datetime.fromtimestamp(t,HKT).date() if t else None
                    if not day or not today<=day<=end:continue
                    # Keep all watchlist events; select other high-profile/macro events for pagination.
                    items.append({'id':str(x.get('id','')),'kind':kind,'symbol':str(x.get('symbol','')),'name':str(x.get('counter_name',''))[:120],'title':str(x.get('content',''))[:350],'time':t,'watched':x.get('symbol') in watched,'market':m})
        if any(r is not None for r in results):
            items=list({(x['kind'],x['id']):x for x in items}.values())
            selected=[x for x in items if x['watched'] or x['kind']=='macrodata']
            selected.extend(sorted([x for x in items if not x['watched'] and x['kind']!='macrodata'],key=lambda x:x['time'])[:20])
            extras['calendar']={'fetchedAt':stamp(),'items':sorted(selected,key=lambda x:x['time']),'start':str(today),'end':str(end)}
    # Last-close screener leaders, explicitly not called live gainers.
    if not fresh(extras.get('leaders'),interval):
        groups={}
        for m in ('HK','US'):
            for order in ('desc','asc'):
                r=call('screener','filter','--market',m,'--sort','prevchg','--order',order,'--count','5')
                if isinstance(r,dict) and r.get('items'):groups[m+'-'+order]=[{k:x.get(k) for k in ('symbol','name','prevclose','prevchg')} for x in r['items'][:5]]
        if groups:extras['leaders']={'fetchedAt':stamp(),'groups':groups,'basis':'screener previous close; not live market ranking'}
    data['collectedAt']=stamp();data['coverage']={'quotes':successes,'requested':len(symbols),'intraday':len(data['intraday'])}
    return data

def git_publish(data):
    runtime=json.loads((LOCAL/'runtime.json').read_text('utf-8')) if (LOCAL/'runtime.json').exists() else {}
    git=shutil.which('git') or str(pathlib.Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe')
    gh=shutil.which('gh') or runtime.get('gh','')
    if not gh or not pathlib.Path(gh).is_file():raise RuntimeError('GITHUB_LOGIN_REQUIRED')
    # gh uses its own protected local credential store; never print/export a token.
    run([gh,'auth','status','--hostname','github.com'])
    path=LOCAL/'data-git'; path.mkdir(parents=True,exist_ok=True)
    helper='!"'+gh.replace('\\','/')+'" auth git-credential'
    def g(*args,input=None):return run([git,'-C',path,'-c','credential.helper=','-c','credential.helper='+helper,*args],input,timeout=90).strip()
    if not (path/'.git').exists():g('init','--initial-branch=data')
    head=g('ls-remote',REPO,'refs/heads/data').split(); expected=head[0] if head else ''
    if expected:
        g('fetch','--depth=1',REPO,'refs/heads/data')
        previous=json.loads(g('show','FETCH_HEAD:market.json'))
        if previous.get('publisher')!='INFO-DESK-LONGBRIDGE':raise RuntimeError('UNRECOGNISED_DATA_BRANCH')
    blob=g('hash-object','-w','--stdin',input=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    tree=g('mktree',input='100644 blob '+blob+'\tmarket.json\n')
    commit=g('-c','user.name=INFO-DESK Publisher','-c','user.email=infodesk@users.noreply.github.com','commit-tree',tree,input='Public market snapshot\n')
    g('push','--force-with-lease=refs/heads/data:'+expected,REPO,commit+':refs/heads/data')
    return commit

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--publish',action='store_true');parser.add_argument('--scheduled',action='store_true');args=parser.parse_args()
    LOCAL.mkdir(parents=True,exist_ok=True)
    lock=open(LOCAL/'run.lock','a+b');lock.seek(0)
    if os.name=='nt':
        import msvcrt
        try:msvcrt.locking(lock.fileno(),msvcrt.LK_NBLCK,1)
        except OSError:return 0
    try:
        config=json.loads(run([shutil.which('node') or 'node',ROOT/'publisher/export-config.cjs']))
        output=LOCAL/'market.json';old=json.loads(output.read_text('utf-8')) if output.exists() else {}
        # US extended-hours requests continue on weekdays; no account APIs required.
        active=config['active']
        interval=config['settings']['ACTIVE_SECONDS' if active else 'CLOSED_SECONDS']
        if args.scheduled and time.time()-epoch(old.get('collectedAt'))<interval-5:return 0
        data=collect(config,old)
        public=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n'
        temp=output.with_suffix('.tmp');temp.write_text(public,'utf-8');temp.replace(output)
        # Local preview reads the same public snapshot; .gitignore excludes this file from main.
        (ROOT/'market.json').write_text(public,'utf-8')
        sha=git_publish(data) if args.publish else None
        health={'time':stamp(),'result':'published' if sha else 'collected','coverage':data['coverage'],'failedCommandTypes':sorted(set(FAILURES)),'commit':sha}
        (LOCAL/'health.json').write_text(json.dumps(health),'utf-8');print(json.dumps(health));return 0
    except Exception as exc:
        code=str(exc) if str(exc) in {'GITHUB_LOGIN_REQUIRED','UNRECOGNISED_DATA_BRANCH','NO_QUOTES'} else 'PUBLISHER_FAILED'
        (LOCAL/'health.json').write_text(json.dumps({'time':stamp(),'result':code}),'utf-8');print(code);return 1
    finally:lock.close()

if __name__=='__main__':sys.exit(main())
