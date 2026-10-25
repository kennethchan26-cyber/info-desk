/* INFO//DESK LITE. ES5 only: no polyfills, modules, external libraries or fonts. */
(function (root) {
    'use strict';
    var doc = root.document, state = { config: null, weather: null, markets: [], fx: [], buses: {}, diagnostics: {}, blocked: {}, busPage: 0, fxPage: 0, last: 0, snapshotAt: 0, busBusy: false, snapshotBusy: false };
    var WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    var SYMBOLS = ['^HSI', '^GSPC', '^IXIC'];
    var STATIC_ONLY = /(?:\?|&)static=1(?:&|$)/.test(root.location ? root.location.search : '');
    function now() { return new Date().getTime(); }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    function numeric(n) { return n !== null && n !== '' && typeof n !== 'undefined' && isFinite(Number(n)); }
    function escape(s) { return String(s === null || typeof s === 'undefined' ? '—' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function el(id) { return doc.getElementById(id); }
    function text(id, value) { var n = el(id); if (n) { n.textContent = value; } }
    function safe(fn) { try { fn(); } catch (e) { state.diagnostics.render = '個別區塊未能顯示'; } }
    function epoch(value) {
        var m, time, sign;
        if (typeof value === 'number') { return isFinite(value) ? value : 0; }
        m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.exec(String(value));
        if (!m) { return 0; }
        time = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        if (m[7] !== 'Z') { sign = m[7].charAt(0) === '+' ? 1 : -1; time -= sign * ((+m[7].substr(1, 2)) * 60 + (+m[7].substr(m[7].length - 2))) * 60000; }
        return time;
    }
    function hkt(value, seconds) { var d = new Date(epoch(value) + 28800000); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + (seconds ? ':' + pad(d.getUTCSeconds()) : ''); }
    function fresh(value, limit) { var t = epoch(value), age = now() - t; return t > 0 && age >= -60000 && age <= limit; }
    function price(n, dp) { var parts; if (!numeric(n)) { return '—'; } parts = Number(n).toFixed(dp).split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); return parts.join('.'); }
    function xhr(url, key, callback) {
        var req, finished = false, host = /^https?:\/\/[^/]+/.exec(url), origin = host ? host[0] : '', timer;
        function finish(error, value) {
            if (finished) { return; } finished = true; root.clearTimeout(timer);
            state.diagnostics[key] = error ? '失敗／逾時；使用同源後備或 —' : '成功 ' + hkt(now(), true);
            if (error && origin) { state.blocked[origin] = now() + 300000; }
            try { callback(error, value); } catch (e) { state.diagnostics[key] = '資料格式不符；其他區塊繼續運作'; }
        }
        if (origin && state.blocked[origin] > now()) { origin = ''; finish(true, null); return; }
        try {
            req = new root.XMLHttpRequest(); req.open('GET', url, true); req.timeout = 12000;
            req.onreadystatechange = function () { if (req.readyState === 4) { try { if (req.status >= 200 && req.status < 300) { finish(false, JSON.parse(req.responseText)); } else { finish(true, null); } } catch (e) { finish(true, null); } } };
            req.onerror = function () { finish(true, null); }; req.ontimeout = function () { finish(true, null); };
            timer = root.setTimeout(function () { finish(true, null); try { req.abort(); } catch (e) {} }, 14000);
            req.send(null);
        } catch (e) { finish(true, null); }
    }
    function touch(t) { var stamp = epoch(t); if (stamp > state.last && stamp <= now() + 60000) { state.last = stamp; } }
    function routeRequests(r) {
        var k = 'https://data.etabus.gov.hk/v1/transport/kmb/eta/', c = 'https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/';
        if (r.api === 'gmb') { return [{ url: 'https://data.etagmb.gov.hk/eta/route-stop/' + r.routeId + '/' + r.routeSeq + '/' + r.stopSeq, type: 'gmb', direction: '', operator: '小巴' }]; }
        if (r.api === 'joint') { return [{ url: k + r.kmbStopId + '/' + r.route + '/' + r.kmbServiceType, type: 'kmb', direction: r.kmbDirection, operator: '九巴' }, { url: c + r.ctbStopId + '/' + r.route, type: 'ctb', direction: r.ctbDirection, operator: '城巴' }]; }
        return [{ url: r.api === 'kmb' ? k + r.stopId + '/' + r.route + '/' + (r.serviceType || '1') : c + r.stopId + '/' + r.route, type: r.api, direction: r.direction, operator: r.api === 'kmb' ? '九巴' : '城巴' }];
    }
    function parseEtas(json, request) {
        var rows, out = [], i, row, t;
        if (!json || !json.data || (request.type === 'gmb' && !json.data.eta)) { throw new Error('eta'); }
        rows = request.type === 'gmb' ? json.data.eta : json.data;
        for (i = 0; i < rows.length; i += 1) { row = rows[i]; if (request.type !== 'gmb' && request.direction && row.dir !== request.direction) { continue; } t = epoch(request.type === 'gmb' ? row.timestamp : row.eta); if (t && t >= now() - 30000 && t <= now() + 3600000) { out.push({ time: t, operator: request.operator }); } }
        return out;
    }
    function validEtas(row) {
        var out = [], i, x, seen = {};
        if (!row || !fresh(row.fetchedAt, 180000)) { return out; }
        for (i = 0; i < (row.items || []).length; i += 1) { x = row.items[i]; if (numeric(x.time) && x.time >= now() - 30000 && x.time <= now() + 3600000 && !seen[x.time + ':' + x.operator]) { out.push(x); seen[x.time + ':' + x.operator] = true; } }
        out.sort(function (a, b) { return a.time - b.time; }); return out.slice(0, 3);
    }
    function weatherValue(j) {
        var rows = (j.temperature || {}).data || [], i, temperature = null, humidity = null;
        for (i = 0; i < rows.length; i += 1) { if (rows[i].place === '沙田' || rows[i].place === 'Sha Tin') { temperature = rows[i].value; } }
        if (j.humidity && j.humidity.data && j.humidity.data[0]) { humidity = j.humidity.data[0].value; }
        if (!numeric(temperature) && !numeric(humidity)) { throw new Error('weather'); }
        return { temperature: temperature, humidity: humidity, icon: (j.icon || [])[0], observedAt: epoch(j.updateTime), fetchedAt: now(), source: '天文台直連' };
    }
    function conditions(code) { var names = { 50: '天晴', 51: '間有陽光', 52: '短暫陽光', 53: '間有陽光及幾陣驟雨', 54: '短暫陽光及驟雨', 60: '多雲', 61: '密雲', 62: '微雨', 63: '有雨', 64: '大雨', 65: '雷暴', 70: '天色良好', 71: '天色良好', 72: '天色良好', 73: '天色良好', 74: '天色良好', 75: '天色良好', 76: '大致多雲', 77: '大致天晴', 80: '大風', 81: '乾燥', 82: '潮濕', 83: '有霧', 84: '薄霧', 85: '煙霞', 90: '酷熱', 91: '溫暖', 92: '清涼', 93: '寒冷' }; return names[code] || '—'; }
    function fxValue(rows, cfg) {
        var out = [], i, j, c, best;
        for (i = 0; i < cfg.currencies.length; i += 1) { c = cfg.currencies[i]; best = null; for (j = 0; j < rows.length; j += 1) { if (rows[j].base === 'HKD' && rows[j].quote === c.code && numeric(rows[j].rate) && rows[j].rate > 0 && (!best || rows[j].date > best.date)) { best = rows[j]; } } if (best) { out.push({ code: c.code, name: c.name, units: c.units, price: c.units / best.rate, date: best.date, fetchedAt: now(), source: 'Frankfurter 直連' }); } }
        if (!out.length) { throw new Error('fx'); } return out;
    }
    function marketValue(data) {
        var out = [], i, q;
        if (!data || data.publisher !== 'INFO-DESK-LONGBRIDGE' || !fresh(data.collectedAt, 1200000)) { return out; }
        for (i = 0; i < SYMBOLS.length; i += 1) { q = (data.quotes || {})[SYMBOLS[i]]; if (q && fresh(q.fetchedAt, 1200000) && numeric(q.price) && q.price > 0 && numeric(q.pct)) { out.push({ symbol: SYMBOLS[i], price: q.price, pct: q.pct, fetchedAt: epoch(q.fetchedAt), source: '長橋公開快照' }); } }
        return out;
    }
    function mergeMarkets(rows) { var map = {}, i, old; for (i = 0; i < state.markets.length; i += 1) { map[state.markets[i].symbol] = state.markets[i]; } for (i = 0; i < rows.length; i += 1) { old = map[rows[i].symbol]; if (!old || epoch(rows[i].fetchedAt) >= epoch(old.fetchedAt)) { map[rows[i].symbol] = rows[i]; touch(rows[i].fetchedAt); } } state.markets = []; for (i = 0; i < SYMBOLS.length; i += 1) { if (map[SYMBOLS[i]]) { state.markets.push(map[SYMBOLS[i]]); } } }
    function applySnapshot(data) {
        var key, row;
        if (!data || data.schema !== 1 || data.kind !== 'INFO-DESK-LITE') { throw new Error('snapshot'); }
        state.snapshotAt = epoch(data.generatedAt);
        if (!state.config && data.config) { state.config = data.config; }
        row = data.weather;
        if (row && (!state.weather || epoch(row.fetchedAt) > epoch(state.weather.fetchedAt))) { state.weather = row; touch(row.fetchedAt); }
        mergeMarkets(data.markets || []);
        if (data.fx && data.fx.length && (!state.fx.length || epoch(data.fx[0].fetchedAt) > epoch(state.fx[0].fetchedAt))) { state.fx = data.fx; touch(data.fx[0].fetchedAt); }
        for (key in (data.transit || {})) { if (Object.prototype.hasOwnProperty.call(data.transit, key)) { row = data.transit[key]; if (!state.buses[key] || epoch(row.fetchedAt) > epoch(state.buses[key].fetchedAt)) { state.buses[key] = row; touch(row.fetchedAt); } } }
    }
    function renderWeather() { var w = state.weather; if (!w || !fresh(w.fetchedAt, 7200000)) { text('temperature', '—°'); text('humidity', '—%'); text('condition', '—'); return; } text('temperature', price(w.temperature, 1) + '°'); text('humidity', price(w.humidity, 0) + '%'); text('condition', conditions(w.icon)); text('weatherSource', (w.source || '天文台同源快照') + ' · ' + hkt(w.observedAt || w.fetchedAt, false)); }
    function renderMarkets() {
        var html = '', i, j, q, notes = [], cls;
        for (i = 0; i < SYMBOLS.length; i += 1) { q = null; for (j = 0; j < state.markets.length; j += 1) { if (state.markets[j].symbol === SYMBOLS[i]) { q = state.markets[j]; } } if (!q || !fresh(q.fetchedAt, 1200000) || !numeric(q.price) || !numeric(q.pct)) { html += '<td><div class="market-price">—</div><div class="change flat">暫未取得</div></td>'; continue; } cls = q.pct > 0 ? 'up' : q.pct < 0 ? 'down' : 'flat'; html += '<td><div class="market-price">' + price(q.price, 2) + '</div><div class="change ' + cls + '">' + (q.pct > 0 ? '▲ +' : q.pct < 0 ? '▼ ' : '') + price(q.pct, 2) + '%</div></td>'; notes.push(q.source + ' ' + hkt(q.fetchedAt, false)); }
        el('markets').innerHTML = html; text('marketSource', notes.length ? notes.join(' / ') : '來源暫未取得／資料超過 20 分鐘');
    }
    function renderBuses() {
        var routes = state.config ? state.config.routes : [], list = [], i, r, row, items, html = '', j, pages, mins, note;
        for (i = 0; i < routes.length; i += 1) { row = state.buses[routes[i].key]; items = validEtas(row); list.push({ route: routes[i], row: row, items: items, index: i, next: items.length ? items[0].time : Infinity }); }
        list.sort(function (a, b) { return a.next === b.next ? a.index - b.index : a.next - b.next; }); pages = Math.max(1, Math.ceil(list.length / 5)); state.busPage = state.busPage % pages;
        for (i = state.busPage * 5; i < Math.min(list.length, state.busPage * 5 + 5); i += 1) { r = list[i].route; row = list[i].row; items = list[i].items; note = !row ? '等待資料' : !fresh(row.fetchedAt, 180000) ? '資料逾 3 分鐘' : (row.source || '同源快照') + ' ' + hkt(row.fetchedAt, true) + (row.partial ? '（部分營辦商）' : ''); html += '<div class="bus-row"><div class="bus-route">' + escape(r.route) + '</div><div class="bus-dest">' + escape(r.destination) + '<span class="bus-stop">' + escape(r.stopName) + '</span><div class="bus-note">' + escape(note) + '</div></div><div class="etas">';
            if (!items.length) { html += '<span class="empty">' + (row && fresh(row.fetchedAt, 180000) ? '暫無班次' : '—') + '</span>'; }
            for (j = 0; j < items.length; j += 1) { mins = Math.max(0, Math.ceil((items[j].time - now()) / 60000)); html += '<span class="eta">' + (mins === 0 ? '即到' : mins) + '<small>' + (mins === 0 ? '' : '分 ') + hkt(items[j].time, false) + '</small></span>'; }
            html += '</div></div>';
        }
        el('buses').innerHTML = html || '<div class="empty">—</div>'; text('busPage', (state.busPage + 1) + ' / ' + pages); text('busSource', routes.length + ' 條設定路線 · 每 10 秒換頁 · 過期班次不當即時顯示');
    }
    function renderFx() {
        var currencies = state.config ? state.config.currencies : [], pages = Math.max(1, Math.ceil(currencies.length / 7)), html = '', i, j, c, row, dates = '';
        state.fxPage = state.fxPage % pages;
        for (i = state.fxPage * 7; i < Math.min(currencies.length, state.fxPage * 7 + 7); i += 1) { c = currencies[i]; row = null; for (j = 0; j < state.fx.length; j += 1) { if (state.fx[j].code === c.code && fresh(state.fx[j].fetchedAt, 7200000)) { row = state.fx[j]; } } html += '<div class="fx-row"><div class="fx-name"><b>' + escape(c.code) + '</b>' + escape(c.name) + (c.units === 100 ? ' ×100' : '') + '</div><div class="fx-value">' + price(row ? row.price : null, 4) + '<small>HKD</small></div></div>'; if (row) { dates = row.date + ' · ' + row.source; } }
        el('fx').innerHTML = html || '<div class="empty">—</div>'; text('fxPage', (state.fxPage + 1) + ' / ' + pages); text('fxSource', dates || '—');
    }
    function renderStatus() {
        var lines = [], key;
        text('lastUpdate', '最後更新 ' + (state.last ? hkt(state.last, true) : '—:—:—'));
        text('status', STATIC_ONLY ? '同源模式 · 官方直連已關閉；快照約 5 分鐘更新，可延遲' : '自動模式 · 官方直連優先；失敗使用同源快照（可能延遲）');
        text('errorNote', '快照：' + (state.snapshotAt ? hkt(state.snapshotAt, true) : '—') + ' HKT · 匯率為每日參考價；市場報價不是逐秒串流。');
        for (key in state.diagnostics) { if (Object.prototype.hasOwnProperty.call(state.diagnostics, key)) { lines.push(key + '：' + state.diagnostics[key]); } }
        text('diagnostics', lines.join('\n') + '\nSafari 9 實機 TLS 尚需在該 iPad 驗證；直連失敗會退回同源快照。');
    }
    function render() { safe(renderWeather); safe(renderMarkets); safe(renderBuses); safe(renderFx); safe(renderStatus); }
    function loadSnapshot() {
        if (state.snapshotBusy) { return; } state.snapshotBusy = true;
        xhr('data/lite.json?t=' + Math.floor(now() / 30000), '同源快照', function (error, data) { state.snapshotBusy = false; if (!error) { applySnapshot(data); try { root.localStorage.setItem('infodesk_lite_public_v1', JSON.stringify(data)); } catch (e) {} } render(); });
    }
    function loadWeather() { if (STATIC_ONLY) { return; } xhr('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc', '天文台', function (error, j) { if (!error) { state.weather = weatherValue(j); touch(state.weather.fetchedAt); } safe(renderWeather); safe(renderStatus); }); }
    function loadMarkets() { if (STATIC_ONLY || !state.config) { return; } xhr(state.config.marketUrl + '?minute=' + Math.floor(now() / 60000), '長橋公開 JSON', function (error, j) { if (!error) { mergeMarkets(marketValue(j)); } safe(renderMarkets); safe(renderStatus); }); }
    function loadFx() {
        var codes = [], i; if (STATIC_ONLY || !state.config) { return; }
        for (i = 0; i < state.config.currencies.length; i += 1) { codes.push(state.config.currencies[i].code); }
        xhr(state.config.fxUrl + '?base=HKD&quotes=' + codes.join(','), 'Frankfurter', function (error, j) { if (!error) { state.fx = fxValue(j, state.config); touch(now()); } safe(renderFx); safe(renderStatus); });
    }
    function loadBuses() {
        var routes, tasks = [], groups = {}, cursor = 0, active = 0, done = 0, i, j, requests;
        if (STATIC_ONLY || !state.config || state.busBusy) { return; } state.busBusy = true; routes = state.config.routes;
        for (i = 0; i < routes.length; i += 1) { requests = routeRequests(routes[i]); groups[routes[i].key] = { expected: requests.length, completed: 0, good: 0, items: [], fetchedAt: now() }; for (j = 0; j < requests.length; j += 1) { tasks.push({ route: routes[i], request: requests[j] }); } }
        function pump() {
            var task;
            if (done === tasks.length) { state.busBusy = false; render(); return; }
            while (active < 3 && cursor < tasks.length) { task = tasks[cursor]; cursor += 1; active += 1; start(task); }
        }
        function start(task) {
            xhr(task.request.url, task.route.route + ' ' + task.request.operator, function (error, j) {
                var g = groups[task.route.key], parsed = [], k;
                try { if (!error) { parsed = parseEtas(j, task.request); g.good += 1; for (k = 0; k < parsed.length; k += 1) { g.items.push(parsed[k]); } } } catch (e) { state.diagnostics[task.route.route] = '資料格式不符'; }
                g.completed += 1; if (g.completed === g.expected && g.good) { state.buses[task.route.key] = { fetchedAt: g.fetchedAt, items: g.items, source: '官方直連', partial: g.good < g.expected }; touch(g.fetchedAt); }
                active -= 1; done += 1; root.setTimeout(pump, 0);
            });
        }
        pump();
    }
    function clock() { var d = new Date(now() + 28800000); text('clock', pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds())); text('date', pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + ' ' + WEEK[d.getUTCDay()] + ' · 香港 HKT'); }
    function minute() { safe(render); safe(loadSnapshot); safe(loadWeather); safe(loadMarkets); safe(loadFx); }
    function init() {
        safe(clock); root.setInterval(function () { safe(clock); }, 1000);
        root.setTimeout(function () { root.location.reload(); }, 21600000);
        try { var cached = JSON.parse(root.localStorage.getItem('infodesk_lite_public_v1')); if (cached) { applySnapshot(cached); } } catch (e) {}
        safe(render); xhr('lite-config.json', '本機設定', function (error, cfg) { if (!error && cfg.schema === 1 && cfg.routes && cfg.currencies) { state.config = cfg; } safe(render); safe(loadBuses); safe(loadMarkets); safe(loadFx); });
        minute(); root.setInterval(minute, 60000); root.setInterval(function () { safe(loadBuses); safe(loadSnapshot); safe(renderBuses); }, 30000);
        root.setInterval(function () { state.busPage += 1; state.fxPage += 1; safe(renderBuses); safe(renderFx); }, 10000);
        el('diagnosticToggle').onclick = function () { var box = el('diagnostics'); box.style.display = box.style.display === 'block' ? 'none' : 'block'; safe(renderStatus); };
        root.addEventListener('pageshow', function () { safe(clock); });
    }
    root.InfoDeskLite = { epoch: epoch, hkt: hkt, routeRequests: routeRequests, parseEtas: parseEtas, weatherValue: weatherValue, fxValue: fxValue, marketValue: marketValue, fresh: fresh, state: state, applySnapshot: applySnapshot, render: render };
    if (doc) { safe(init); }
}(typeof window !== 'undefined' ? window : this));
