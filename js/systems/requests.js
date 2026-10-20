/* TALL GRASS — js/systems/requests.js
 * OAK'S REQUESTS: a rotating task board so there is always something to chase.
 *  - Exactly one active request (state.request), shown as a compact card on the Grass tab under the
 *    stats row: text, progress bar, reward, SKIP (2-minute cooldown, state.requestSkipAt).
 *  - Templates scale with the current act/progress and only use things the player can reach:
 *    catch N of a type present on an owned route, catch N of a species, add N of a visible producer,
 *    evolve any, unlock an area, tap N times, throw N balls by hand, register a new species, spend X RD.
 *  - Rewards vary: 60–180 s of RD/sec, Poké Balls, 5 candy for an owned family, and now and then a
 *    Rare Candy fragment (cosmetic counter, stats.rcFragments). Act 3+: sometimes the other voice asks
 *    (lowercase, story.request_*_glitch) and pays in Glitch Bytes.
 *  - Lines: story.request_new / request_done (Oak), request_new_glitch / request_done_glitch.
 *  - Completed count: stats.requests (Trainer Card; survives prestige with the other stats).
 * Optional system: nothing else references it. Events used: catch, dex, buy, evolve, route, tap,
 * throw, spend, load, tick.
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.systems = TG.systems || {};

  var SKIP_COOLDOWN = 120000;
  var GLITCH_VOICE = 0.3;
  var S = null;
  var refs = {};
  var lastUi = 0, lastSec = 0, lastKind = null;

  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : (d || 0); }
  function now() { return Date.now(); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a && a.length ? a[(Math.random() * a.length) | 0] : undefined; }
  function fmt(n) { return TG.fmt ? TG.fmt(n) : String(Math.floor(n)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function setText(e, s) { if (e && e._t !== s) { e._t = s; e.textContent = s; } }
  function setHidden(e, h) { h = !!h; if (e && e.hidden !== h) e.hidden = h; }
  function setClass(e, c, on) { on = !!on; if (e && e.classList.contains(c) !== on) e.classList.toggle(c, on); }
  function story(k) { var s = (TG.data.story || {})[k]; return Array.isArray(s) ? s : []; }

  // ------------------------------------------------------------ state
  function ensure() {
    S = TG.state;
    if (!S) return;
    if (!S.request || typeof S.request !== 'object' || !S.request.kind) S.request = null;
    S.requestSkipAt = num(S.requestSkipAt, 0);
    if (!S.stats) S.stats = {};
    S.stats.requests = num(S.stats.requests, 0);
    S.stats.rcFragments = num(S.stats.rcFragments, 0);
  }

  // ------------------------------------------------------------ what the player can reach
  function ownedSpecies() {
    var out = {}, champ = !!S.flags.champion;
    (TG.data.routes || []).forEach(function (r) {
      if (!S.routes[r.id] || r.special === 'glitch_city') return;
      [r.encounters || [], r.night || []].forEach(function (t) {
        t.forEach(function (row) {
          if (row.id === 150 && !champ) return;
          var sp = TG.species(row.id);
          if (sp && !sp.glitch) out[row.id] = (out[row.id] || 0) + num(row.weight, 1);
        });
      });
    });
    return out;
  }
  function routeOf(id) {
    var cur = TG.route(S.currentRoute);
    var has = function (r) { return [r.encounters || [], r.night || []].some(function (t) { return t.some(function (x) { return x.id === id; }); }); };
    if (cur && has(cur)) return cur;
    return (TG.data.routes || []).find(function (r) { return S.routes[r.id] && has(r); });
  }
  function rate() { return TG.rates.rd || 0; }
  // what the player can earn in `secs` seconds, counting taps for the early game
  function income(secs) { return Math.max(rate(), TG.tapPower()) * secs; }

  // ------------------------------------------------------------ templates
  var T = {
    catch_type: function (glitch) {
      var types = {}, total = 0;
      var sp = ownedSpecies();
      for (var id in sp) { total += sp[id]; (TG.species(id).types || []).forEach(function (t) { types[t] = (types[t] || 0) + sp[id]; }); }
      var t = pick(Object.keys(types));
      if (!t) return null;
      // rare types (a DRAGON among PIDGEYs) ask for fewer
      var share = total > 0 ? types[t] / total : 1;
      var n = Math.max(1, Math.round((rnd(2, 4) + S.act * 1.5) * Math.min(1, share * 4)));
      return { key: t, goal: n, text: glitch ? 'catch ' + n + ' ' + t.toLowerCase() + ' things' : 'Catch ' + n + ' ' + t.toUpperCase() + '-type POKéMON' };
    },
    catch_species: function (glitch) {
      var sp = ownedSpecies(), list = [];
      for (var id in sp) list.push({ id: Number(id), weight: sp[id] });
      var row = TG.util.weighted(list);
      if (!row) return null;
      var s = TG.species(row.id), r = routeOf(row.id);
      var n = Math.max(1, Math.round(rnd(1, 3) * (row.weight >= 20 ? 1.5 : 1)));
      var where = r ? ' (' + r.name.toUpperCase() + ')' : '';
      return { key: row.id, goal: n, text: glitch ? 'bring me ' + n + ' ' + s.name.toLowerCase() : 'Catch ' + n + ' ' + s.name.toUpperCase() + where };
    },
    buy_producer: function (glitch) {
      var wallet = function (p) { return TG.producerCurrency(p.id) === 'gb' ? S.gb + (TG.rates.gb || 0) * 300 : S.rd + income(300); };
      var ps = (TG.data.producers || []).filter(function (p) {
        if (!TG.producerVisible(p)) return false;
        if ((TG.producerCurrency(p.id) === 'gb') !== !!glitch) return false;
        return TG.producerPrice(p.id, 1) <= wallet(p);
      });
      var p = ps[ps.length - 1 - Math.floor(Math.random() * Math.min(2, ps.length))];
      if (!p) return null;
      var n = 1;
      while (n < 10 && TG.producerPrice(p.id, n + 1) <= wallet(p)) n++;
      n = Math.max(1, Math.round(n * rnd(0.5, 1)));
      return { key: p.id, goal: n, text: glitch ? 'make ' + n + ' more ' + p.name.toLowerCase() : 'Add ' + n + ' × ' + p.name + ' in TOWN' };
    },
    evolve: function (glitch) {
      if (!TG.evolutionUnlocked()) return null;
      var close = (TG.data.pokemon || []).some(function (sp) {
        if (!sp.evolvesTo || !sp.candyToEvolve || !(S.dex[sp.id] && S.dex[sp.id].caught)) return false;
        return num(S.candy[sp.family]) >= sp.candyToEvolve * 0.5;
      });
      if (!close) return null;
      return { key: null, goal: 1, text: glitch ? 'make something grow' : 'Evolve any POKéMON' };
    },
    unlock_route: function (glitch) {
      var ok = (TG.data.routes || []).some(function (r) { return !S.routes[r.id] && TG.meets(r.requires) && num(r.cost) <= S.rd + income(600); });
      if (!ok) return null;
      return { key: null, goal: 1, text: glitch ? 'open a new place' : 'Unlock a new area on the MAP' };
    },
    tap: function (glitch) {
      var n = S.taps < 60 ? 25 : 100;
      return { key: null, goal: n, text: glitch ? 'tap the grass ' + n + ' times it tickles' : 'Tap the tall grass ' + n + ' times' };
    },
    throw: function (glitch) {
      if (S.balls < 5 && !S.flags.mart) return null;
      var n = S.flags.mart ? 20 : 8;
      return { key: null, goal: n, text: glitch ? 'throw ' + n + ' balls at them yourself' : 'Throw ' + n + ' POKé BALLS by hand' };
    },
    new_species: function (glitch) {
      var sp = ownedSpecies(), any = false;
      for (var id in sp) if (!(S.dex[id] && S.dex[id].caught)) { any = true; break; }
      if (!any) return null;
      return { key: null, goal: 1, text: glitch ? 'find one i havent seen' : 'Register a new species in the POKéDEX' };
    },
    spend: function (glitch) {
      var x = Math.max(50, income(rnd(60, 120)));
      x = Number(x.toPrecision(2));
      return { key: null, goal: x, text: glitch ? 'spend ' + fmt(x) + ' rd i like the sound' : 'Spend ' + fmt(x) + ' RD on anything' };
    }
  };
  var WEIGHTS = { catch_type: 3, catch_species: 3, buy_producer: 3, evolve: 2, unlock_route: 2, tap: 1.5, throw: 1.5, new_species: 2, spend: 1.5 };

  function makeReward(glitch) {
    var secs = Math.round(rnd(60, 180));
    if (glitch) {
      return { type: 'gb', amount: Math.max(50, Math.round((TG.rates.gb || 0) * secs)) };
    }
    var r = Math.random();
    var fams = TG.ownedFamilies ? TG.ownedFamilies() : [];
    var reward;
    if (r < 0.2 && (S.flags.mart || S.balls < 10)) {
      var auto = (TG.effects && TG.effects.autoCatch) || 0;
      reward = { type: 'balls', amount: S.flags.mart ? Math.max(10, Math.min(200, Math.round(auto * 90))) : 5 };
    } else if (r < 0.4 && fams.length) {
      // prefer a family that can still evolve
      var evo = fams.filter(function (f) { return (TG.data.pokemon || []).some(function (p) { return p.family === f && p.evolvesTo && S.dex[p.id] && S.dex[p.id].caught; }); });
      reward = { type: 'candy', amount: 5, family: pick(evo.length ? evo : fams) };
    } else {
      reward = { type: 'rd', amount: Math.max(30, Math.round(income(secs))) };
    }
    if (Math.random() < 0.1) reward.frag = 1;
    return reward;
  }
  function familyName(f) {
    var p = (TG.data.pokemon || []).find(function (x) { return x.family === f && x.stage === 1; }) || (TG.data.pokemon || []).find(function (x) { return x.family === f; });
    return p ? p.name.toUpperCase() : String(f).toUpperCase();
  }
  function rewardText(rw) {
    if (!rw) return '';
    var t = rw.type === 'rd' ? '+' + fmt(rw.amount) + ' RD'
      : rw.type === 'balls' ? '+' + fmt(rw.amount) + ' ◓'
      : rw.type === 'candy' ? '+' + rw.amount + ' ' + familyName(rw.family) + ' candy'
      : rw.type === 'gb' ? '+▓' + fmt(rw.amount) : '';
    return t + (rw.frag ? ' + ✦' : '');
  }

  function generate(silent) {
    var glitch = S.act >= 3 && Math.random() < GLITCH_VOICE;
    var kinds = Object.keys(WEIGHTS).filter(function (k) {
      if (k === lastKind) return false;
      // nothing that needs a tab the player hasn't found yet
      if ((k === 'spend' || k === 'buy_producer') && !(S.tabs && S.tabs.town)) return false;
      if (k === 'unlock_route' && !(S.tabs && S.tabs.map)) return false;
      return true;
    });
    // a brand-new run starts with the gentlest one
    if (S.taps < 25 && TG.mults.dexCount === 0 && !glitch) kinds = ['tap'];
    var tries = 0, req = null, kind;
    while (!req && tries++ < 20) {
      var list = kinds.map(function (k) { return { id: k, weight: WEIGHTS[k] }; });
      var row = TG.util.weighted(list);
      kind = row.id;
      req = T[kind](glitch);
      if (!req) kinds = kinds.filter(function (k) { return k !== kind; });
      if (!kinds.length) break;
    }
    if (!req) { kind = 'tap'; req = T.tap(glitch); }
    lastKind = kind;
    req.kind = kind;
    req.progress = 0;
    req.voice = glitch ? 'glitch' : 'oak';
    req.reward = makeReward(glitch);
    req.uid = now();
    S.request = req;
    if (!silent) {
      var line = pick(story(glitch ? 'request_new_glitch' : 'request_new'));
      if (line) TG.queueLog(line, glitch ? 'glitch' : (TG.storyCls ? TG.storyCls('request_new', line) : 'oak'));
    }
    if (refs.card) renderCard();
    return req;
  }

  function grant(rw) {
    if (!rw) return;
    if (rw.type === 'rd') TG.addRD(rw.amount);
    else if (rw.type === 'balls') S.balls += rw.amount;
    else if (rw.type === 'candy') { S.candy[rw.family] = (S.candy[rw.family] || 0) + rw.amount; TG.emit('candy', rw.amount); }
    else if (rw.type === 'gb') { S.gb += rw.amount; S.gbLifetime = num(S.gbLifetime) + rw.amount; }
    if (rw.frag) S.stats.rcFragments++;
  }

  function complete() {
    var req = S.request;
    if (!req) return;
    S.request = null;
    grant(req.reward);
    S.stats.requests++;
    var glitch = req.voice === 'glitch';
    var line = pick(story(glitch ? 'request_done_glitch' : 'request_done'));
    if (line) TG.log(line, glitch ? 'glitch' : (TG.storyCls ? TG.storyCls('request_done', line) : 'oak'));
    TG.log('Request complete: ' + rewardText(req.reward) + (req.reward && req.reward.frag ? ' (a RARE CANDY fragment)' : '') + '.', 'sys');
    if (TG.ui && TG.ui.toast) TG.ui.toast('REQUEST DONE · ' + rewardText(req.reward), 3000);
    if (TG.sfx) TG.sfx.play('badge');
    TG.emit('request', { type: 'done', request: req });
    if (refs.card && !(S.settings && S.settings.reduceMotion)) { refs.card.classList.remove('done'); void refs.card.offsetWidth; refs.card.classList.add('done'); }
    generate(false);
  }

  function bump(n) {
    var req = S && S.request;
    if (!req || !(n > 0)) return;
    req.progress = Math.min(req.goal, req.progress + n);
    if (req.progress >= req.goal) complete();
  }

  function skip() {
    if (!S.request) { generate(false); return; }
    var left = SKIP_COOLDOWN - (now() - S.requestSkipAt);
    if (left > 0) { if (TG.ui) TG.ui.toast('You can skip again in ' + TG.fmtTime(left / 1000) + '.'); return; }
    S.requestSkipAt = now();
    TG.log(S.request.voice === 'glitch' ? 'fine' : 'OAK: Not that one? Fair enough. I have others.', S.request.voice === 'glitch' ? 'glitch' : 'oak');
    generate(true);
  }

  // ------------------------------------------------------------ events -> progress
  function onCatch(e) {
    var req = S && S.request;
    if (!req || !e || !e.enc || e.enc.evolved) return;
    var w = Math.max(1, num(e.weight, 1));
    if (req.kind === 'catch_species' && e.enc.id === req.key) bump(w);
    else if (req.kind === 'catch_type') {
      var sp = TG.species(e.enc.id);
      if (sp && (sp.types || []).indexOf(req.key) >= 0) bump(w);
    }
  }
  function on(kind, fn) { return function (e) { if (S && S.request && S.request.kind === kind) fn(e); }; }

  // ------------------------------------------------------------ card (Grass tab, under the stats row)
  function buildCard() {
    if (refs.card && refs.card.isConnected) return true;
    var stats = document.querySelector('#tab-grass .grass-stats');
    if (!stats) return false;
    var c = el('div', 'box req-card');
    c.id = 'g-req';
    var top = el('div', 'req-top');
    refs.from = el('span', 'req-from', "OAK'S REQUEST");
    refs.reward = el('span', 'req-reward', '');
    top.appendChild(refs.from); top.appendChild(refs.reward);
    refs.text = el('div', 'req-text', '');
    var row = el('div', 'req-row');
    var bar = el('div', 'bar req-bar');
    refs.fill = el('i');
    bar.appendChild(refs.fill);
    refs.prog = el('span', 'req-prog', '');
    refs.skip = el('button', 'btn small req-skip', 'SKIP');
    refs.skip.type = 'button';
    refs.skip.addEventListener('click', skip);
    row.appendChild(bar); row.appendChild(refs.prog); row.appendChild(refs.skip);
    c.appendChild(top); c.appendChild(refs.text); c.appendChild(row);
    stats.parentNode.insertBefore(c, stats.nextSibling);
    refs.card = c;
    return true;
  }
  function renderCard() {
    if (!buildCard()) return;
    var req = S.request;
    setHidden(refs.card, !req);
    if (!req) return;
    var g = req.voice === 'glitch';
    setClass(refs.card, 'glitchy', g);
    setText(refs.from, g ? 'a request' : "OAK'S REQUEST");
    setText(refs.text, req.text);
    setText(refs.reward, rewardText(req.reward));
    refs.card._uid = req.uid;
    updateCard();
  }
  function updateCard() {
    var req = S.request;
    if (!refs.card) return;
    if (!req) { setHidden(refs.card, true); return; }
    if (refs.card._uid !== req.uid) { renderCard(); return; }
    var pct = Math.round(100 * Math.min(1, req.progress / req.goal));
    if (refs.fill._w !== pct) { refs.fill._w = pct; refs.fill.style.width = pct + '%'; }
    setText(refs.prog, req.kind === 'spend' ? fmt(req.progress) + '/' + fmt(req.goal) : Math.floor(req.progress) + '/' + req.goal);
    var left = SKIP_COOLDOWN - (now() - S.requestSkipAt);
    setText(refs.skip, left > 0 ? 'SKIP ' + Math.ceil(left / 1000) + 's' : 'SKIP');
    setClass(refs.skip, 'no', left > 0);
  }

  function onTick() {
    if (S !== TG.state) { ensure(); if (refs.card) renderCard(); }
    if (!S) return;
    var t = now();
    if (t - lastSec >= 1000) {
      lastSec = t;
      // exactly one request at all times (new games, prestige, old saves)
      if (!S.request) generate(false);
    }
    if (t - lastUi >= 250 && S.settings && S.settings.tab === 'grass') { lastUi = t; updateCard(); }
  }

  TG.systems.requests = {
    init: function () {
      ensure();
      TG.on('catch', onCatch);
      TG.on('dex', on('new_species', function (e) { if (e && e.caught) bump(1); }));
      TG.on('buy', on('buy_producer', function (e) { if (e && e.kind === 'producer' && e.id === S.request.key) bump(num(e.n, 1)); }));
      TG.on('evolve', on('evolve', function () { bump(1); }));
      TG.on('route', on('unlock_route', function (e) { if (e && e.type === 'unlock') bump(1); }));
      TG.on('tap', on('tap', function () { bump(1); }));
      TG.on('throw', on('throw', function (r) { if (r && !r.auto && r.ok) bump(1); }));
      TG.on('spend', on('spend', function (c) { if (c && c.rd > 0) bump(c.rd); }));
      TG.on('load', function () { ensure(); renderCard(); });
      TG.on('tick', onTick);
      if (!S.request) generate(false);
      renderCard();
    },
    current: function () { return S && S.request; },
    complete: function () { if (S && S.request) { S.request.progress = S.request.goal; complete(); } },
    skip: skip,
    generate: function () { return generate(false); },
    config: { SKIP_COOLDOWN: SKIP_COOLDOWN }
  };
})();
