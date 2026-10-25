"""Public-only Lite snapshot. No Longbridge login/SDK and no private account APIs.

Reuses the existing anonymous market snapshot, then falls back to Yahoo prices.
All times are epoch milliseconds for Safari 9. Failed sources retain their OLD
timestamps; the client suppresses old ETAs instead of freshening cached records.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import math
import pathlib
import time
import urllib.parse
import urllib.request

SYMBOLS = ('^HSI', '^GSPC', '^IXIC')


def clock():
    return int(time.time() * 1000)


def epoch(value):
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(dt.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() * 1000)
    except (ValueError, TypeError, AttributeError):
        return 0


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'INFO-DESK-Lite/1.0 public-data', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=16) as response:
        return json.load(response)


def recent(value, limit=1200000):
    age = clock() - epoch(value)
    return -60000 <= age <= limit


def weather():
    j = get('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc')
    temperature = next((r['value'] for r in j.get('temperature', {}).get('data', []) if r.get('place') == '沙田'), None)
    humidity = next((r['value'] for r in j.get('humidity', {}).get('data', [])), None)
    if temperature is None and humidity is None:
        raise ValueError('weather')
    return {'temperature': temperature, 'humidity': humidity, 'icon': next(iter(j.get('icon', [])), None),
            'observedAt': epoch(j.get('updateTime')), 'fetchedAt': clock(), 'source': '天文台同源快照'}


def markets(config):
    result = []
    try:
        data = get(config['marketUrl'] + '?lite=' + str(clock() // 60000))
        if data.get('publisher') == 'INFO-DESK-LONGBRIDGE' and recent(data.get('collectedAt')):
            for symbol in SYMBOLS:
                q = data.get('quotes', {}).get(symbol, {})
                if recent(q.get('fetchedAt')) and number(q.get('price')) and number(q.get('pct')) is not None:
                    result.append({'symbol': symbol, 'price': q['price'], 'pct': q['pct'],
                                   'fetchedAt': epoch(q['fetchedAt']), 'source': '長橋同源快照'})
    except Exception:
        pass
    for symbol in SYMBOLS:
        if any(row['symbol'] == symbol for row in result):
            continue
        for host in ('query1.finance.yahoo.com', 'query2.finance.yahoo.com'):
            try:
                url = 'https://' + host + '/v8/finance/chart/' + urllib.parse.quote(symbol, safe='') + '?interval=1m&range=1d'
                meta = get(url)['chart']['result'][0]['meta']
                price, previous = number(meta.get('regularMarketPrice')), number(meta.get('previousClose', meta.get('chartPreviousClose')))
                if not price or not previous:
                    raise ValueError('quote')
                result.append({'symbol': symbol, 'price': price, 'pct': (price / previous - 1) * 100,
                               'fetchedAt': clock(), 'quoteTime': (meta.get('regularMarketTime') or 0) * 1000, 'source': 'Yahoo 後備快照'})
                break
            except Exception:
                continue
    if not result:
        raise ValueError('markets')
    return result


def fx(config):
    codes = ','.join(c['code'] for c in config['currencies'])
    rows = get(config['fxUrl'] + '?base=HKD&quotes=' + codes)
    result = []
    for currency in config['currencies']:
        matches = [r for r in rows if r.get('base') == 'HKD' and r.get('quote') == currency['code'] and number(r.get('rate')) and float(r['rate']) > 0]
        if matches:
            row = max(matches, key=lambda r: r['date'])
            result.append({'code': currency['code'], 'name': currency['name'], 'units': currency['units'],
                           'price': currency['units'] / float(row['rate']), 'date': row['date'],
                           'fetchedAt': clock(), 'source': 'Frankfurter 同源快照'})
    if not result:
        raise ValueError('fx')
    return result


def route_requests(route):
    kmb = 'https://data.etabus.gov.hk/v1/transport/kmb/eta/'
    ctb = 'https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/'
    name = route['route']
    if route['api'] == 'gmb':
        return [('https://data.etagmb.gov.hk/eta/route-stop/{routeId}/{routeSeq}/{stopSeq}'.format(**route), 'gmb', '', '小巴')]
    if route['api'] == 'joint':
        return [(kmb + route['kmbStopId'] + '/' + name + '/' + route['kmbServiceType'], 'kmb', route['kmbDirection'], '九巴'),
                (ctb + route['ctbStopId'] + '/' + name, 'ctb', route['ctbDirection'], '城巴')]
    if route['api'] == 'kmb':
        return [(kmb + route['stopId'] + '/' + name + '/' + route.get('serviceType', '1'), 'kmb', route['direction'], '九巴')]
    return [(ctb + route['stopId'] + '/' + name, 'ctb', route['direction'], '城巴')]


def parse_etas(data, kind, direction, operator):
    rows = data['data']['eta'] if kind == 'gmb' else data['data']
    out = []
    for row in rows:
        if kind != 'gmb' and row.get('dir') != direction:
            continue
        t = epoch(row.get('timestamp') if kind == 'gmb' else row.get('eta'))
        if t and clock() - 30000 <= t <= clock() + 3600000:
            out.append({'time': t, 'operator': operator})
    return out


def transit(route):
    requests = route_requests(route)
    out, good, fetched = [], 0, clock()
    for url, kind, direction, operator in requests:
        try:
            out.extend(parse_etas(get(url), kind, direction, operator))
            good += 1
        except Exception:
            pass
    if not good:
        raise ValueError('transit')
    unique = {(r['time'], r['operator']): r for r in out}
    return {'items': sorted(unique.values(), key=lambda r: r['time'])[:3], 'fetchedAt': fetched,
            'source': '同源快照（非即時）', 'partial': good < len(requests)}


def collect(config, old):
    result = {'schema': 1, 'kind': 'INFO-DESK-LITE', 'config': config, 'weather': old.get('weather'),
              'markets': old.get('markets', []), 'fx': old.get('fx', []), 'transit': dict(old.get('transit', {})),
              'sources': {}, 'snapshotIntervalSeconds': 300}
    jobs = {'weather': weather, 'markets': lambda: markets(config), 'fx': lambda: fx(config)}
    for route in config['routes']:
        jobs['bus:' + route['key']] = lambda r=route: transit(r)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        pending = {pool.submit(fn): key for key, fn in jobs.items()}
        for future in concurrent.futures.as_completed(pending):
            key = pending[future]
            try:
                value = future.result()
                if key.startswith('bus:'):
                    result['transit'][key[4:]] = value
                elif key in ('markets', 'fx'):
                    field = 'symbol' if key == 'markets' else 'code'
                    merged = {r[field]: r for r in result[key]}
                    merged.update({r[field]: r for r in value})
                    result[key] = list(merged.values())
                else:
                    result[key] = value
                result['sources'][key] = 'ok'
            except Exception:
                result['sources'][key] = 'unavailable; retained original timestamp if cached'
    result['generatedAt'] = clock()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='lite-config.json')
    parser.add_argument('--output', default='data/lite.json')
    parser.add_argument('--previous-url', default='https://kennethchan26-cyber.github.io/info-desk/data/lite.json')
    args = parser.parse_args()
    config = json.loads(pathlib.Path(args.config).read_text('utf-8'))
    old = {}
    try:
        candidate = get(args.previous_url)
        if candidate.get('kind') == 'INFO-DESK-LITE':
            old = candidate
    except Exception:
        pass
    data = collect(config, old)
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')), 'utf-8')
    print(json.dumps({'generatedAt': data['generatedAt'], 'sources': data['sources'], 'bytes': output.stat().st_size}))


if __name__ == '__main__':
    main()
