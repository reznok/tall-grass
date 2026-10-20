/* TALL GRASS — engine.js
 * Game state, fixed-step loop, economy, encounters, story triggers, events,
 * save/load/offline. No DOM access here (ui.js owns the DOM).
 * Contract: docs/ARCHITECTURE.md (see "Engine additions" at the bottom).
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.data = TG.data || {};
  TG.config = Object.assign({
    saveKey: 'tallgrass.save.v1',
    tickMs: 100,
    autosaveMs: 10000,
    eventEverySec: 90,          // mean seconds between random events
    idleEverySec: 210,          // mean seconds between ambient idle_lines
    logLineDelayMs: 900,        // story lines are revealed one by one
    forceNight: null            // true/false to override the real clock (debug/tests)
  }, TG.config || {});

  var SAVE_VERSION = 1;
  var TICK = TG.config.tickMs;
  var DT = TICK / 1000;
  var SHINY_CHANCE = 1 / 4096;
  var BASE_TAP_ENCOUNTER = 0.2;
  var BASE_QUEUE = 5;
  var MAX_FLEE_MISSES = 3;
  var DRIP_SECONDS = 20, DRIP_CAP = 10;
  var BALL_PRICE = 20;
  var DEX_MILESTONES = [10, 25, 50, 100, 150, 151];
  var STORY_CLS = {
    rival: 'rival', rocket: 'rival',
    glitch_first: 'glitch', missingno_caught: 'glitch', glitch_whisper: 'glitch',
    sram_appear: 'glitch', battery_low: 'glitch', battery_dead: 'glitch', prestige_done: 'glitch',
    route_unlock: 'sys', badge: 'sys', credits: 'sys', ending: 'sys', truck_moved: 'sys'
  };

  var S = null;               // live state (=== TG.state)
  var idx = { pokemon: {}, routes: {}, producers: {}, upgrades: {}, gyms: {} };
  var effectsDirty = true;
  var lastTapAt = 0;
  var lastLogReveal = 0;
  var lastSecond = 0;
  var lastAutosave = 0;
  var running = false;
  var rafId = 0;
  var effectSources = [];     // fn(effects) — systems may add effects
  var rateMods = [];          // fn() -> multiplier on rd/sec (global)
  var spawnHooks = [];        // fn(enc, route) -> enc | null (cancel) | undefined (keep)

  TG.rates = { rd: 0, encounters: 0, balls: 0, candy: 0, gb: 0 };
  TG.mults = { dexBonus: 1, badge: 1, rareCandy: 1, event: 1, glitch: 1, mew: 1, extra: 1, global: 1, dexCount: 0, seenCount: 0 };
  TG.effects = null;
  TG.systems = TG.systems || undefined; // systems/*.js create this; engine tolerates undefined

  // ------------------------------------------------------------------ util
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : (d || 0); }
  function now() { return Date.now(); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr && arr.length ? arr[(Math.random() * arr.length) | 0] : undefined; }
  function weighted(list) {
    if (!list || !list.length) return undefined;
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += Math.max(0, num(list[i].weight, 1));
    if (total <= 0) return list[0];
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) { r -= Math.max(0, num(list[i].weight, 1)); if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  TG.util = { clone: clone, weighted: weighted, pick: pick, rand: rand };

  // ------------------------------------------------------------- event bus
  var listeners = {};
  TG.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return function () { TG.off(ev, fn); }; };
  TG.off = function (ev, fn) { var a = listeners[ev]; if (!a) return; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  TG.emit = function (ev, payload) {
    var a = listeners[ev];
    if (!a || !a.length) return;
    a = a.slice();
    for (var i = 0; i < a.length; i++) {
      try { a[i](payload); } catch (e) { console.error('[TG] listener error on "' + ev + '"', e); }
    }
  };

  // ------------------------------------------------------------ data index
  function buildIndex() {
    ['routes', 'producers', 'upgrades', 'gyms'].forEach(function (k) {
      idx[k] = {};
      (TG.data[k] || []).forEach(function (o) { if (o && o.id != null) idx[k][o.id] = o; });
    });
    idx.pokemon = {};
    (TG.data.pokemon || []).forEach(function (p) { if (p && p.id != null) idx.pokemon[p.id] = p; });
    effectsDirty = true;
  }
  TG.reindex = buildIndex;
  TG.species = function (id) {
    var p = idx.pokemon[id];
    if (p) return p;
    var g = TG.systems && TG.systems.glitch;
    if (g && typeof g.species === 'function') { try { return g.species(id) || null; } catch (e) { return null; } }
    return null;
  };
  TG.route = function (id) { return idx.routes[id]; };
  TG.producer = function (id) { return idx.producers[id]; };
  TG.upgrade = function (id) { return idx.upgrades[id]; };
  TG.gym = function (id) { return idx.gyms[id]; };
  TG.speciesName = function (id) { var s = TG.species(id); return s ? s.name : '???'; };

  // ------------------------------------------------------------ state
  function startRouteId() {
    var rs = TG.data.routes || [];
    var r = rs.find(function (x) { return !x.cost; }) || rs[0];
    return r ? r.id : 'pallet';
  }

  function defaultState() {
    var t = now();
    var start = startRouteId();
    var routes = {}; routes[start] = true;
    return {
      v: SAVE_VERSION, name: 'RED', createdAt: t, lastSave: t, lastTick: t,
      rd: 0, rdTotal: 0, rdLifetime: 0,
      balls: 5, gb: 0, instability: 0,
      taps: 0, combo: 1,
      producers: {}, upgrades: {},
      routes: routes, currentRoute: start,
      dex: {}, candy: {},
      badges: 0, badgeIds: [], elite: 0, champion: false,
      flags: {},
      encounters: [],
      storyShown: {}, log: [],
      activeEvent: null,
      truckTaps: 0, titleTaps: 0,
      act: 1,
      prestige: { count: 0, rareCandy: 0 },
      settings: { sound: false, palette: 'dmg', reduceMotion: false, tab: 'grass', buyAmt: 1 },
      stats: { catches: 0, shinies: 0, evolutions: 0, playtime: 0, ballsThrown: 0, eventsSeen: 0, fled: 0 },
      // ---- engine additions (documented in ARCHITECTURE.md "Engine additions")
      tabs: { grass: true, dex: true, lab: true },
      ballsBought: 0,
      logQueue: [],
      acc: { enc: 0, balls: 0, candy: 0, auto: 0, drip: 0 },
      candyRR: 0,
      encUid: 1,
      nextEventAt: t + 60000,
      nextIdleAt: t + 120000,
      lastNight: null,
      producersEverBought: 0
    };
  }
  TG.defaultState = defaultState;

  function deepFill(target, def) {
    for (var k in def) {
      if (!Object.prototype.hasOwnProperty.call(def, k)) continue;
      if (target[k] === undefined) target[k] = clone(def[k]);
      else if (isObj(def[k]) && isObj(target[k])) deepFill(target[k], def[k]);
    }
    return target;
  }

  var MIGRATIONS = {
    // 1: function (s) { ...; s.v = 2; }
  };

  function migrate(obj) {
    if (!isObj(obj)) throw new Error('save is not an object');
    obj.v = num(obj.v, 1);
    var guard = 0;
    while (MIGRATIONS[obj.v] && guard++ < 50) MIGRATIONS[obj.v](obj);
    deepFill(obj, defaultState());
    ['rd', 'rdTotal', 'rdLifetime', 'balls', 'gb', 'instability', 'taps', 'truckTaps', 'titleTaps'].forEach(function (k) { obj[k] = num(obj[k], 0); });
    obj.combo = Math.max(1, num(obj.combo, 1));
    if (!Array.isArray(obj.encounters)) obj.encounters = [];
    obj.encounters = obj.encounters.filter(function (e) { return e && e.id != null; });
    obj.encounters.forEach(function (e) { if (e.uid == null) e.uid = obj.encUid++; e.misses = num(e.misses, 0); });
    if (!Array.isArray(obj.log)) obj.log = [];
    if (!Array.isArray(obj.logQueue)) obj.logQueue = [];
    if (!Array.isArray(obj.badgeIds)) obj.badgeIds = [];
    if (!obj.routes[obj.currentRoute]) obj.currentRoute = Object.keys(obj.routes)[0] || startRouteId();
    if (obj.champion) obj.flags.champion = true;
    if (obj.flags.champion) obj.champion = true;
    return obj;
  }
  TG.migrate = migrate;

  function setState(s) {
    S = s;
    TG.state = s;
    effectsDirty = true;
    recompute();
  }

  Object.defineProperty(TG, 'act', {
    configurable: true,
    get: function () { return S ? S.act : 1; },
    set: function (v) { setAct(v); }
  });

  function setAct(n) {
    if (!S || S.act === n) return;
    S.act = n;
    TG.fire('act', n);
    TG.emit('act', n);
  }
  TG.setAct = setAct;

  // --------------------------------------------------------------- flags
  TG.flag = function (name) { return !!(S && S.flags[name]); };
  TG.setFlag = function (name, value) {
    if (value === undefined) value = true;
    if (!S || S.flags[name] === value) return;
    S.flags[name] = value;
    if (name === 'champion' && value) S.champion = true;
    effectsDirty = true;
    TG.emit('flag', name);
  };

  // ------------------------------------------------------------ logging
  function fmtLine(text) {
    if (typeof text !== 'string') text = String(text == null ? '' : text);
    return text.replace(/\{(\w+)\}/g, function (m, k) {
      if (k === 'name') return S ? S.name : 'RED';
      if (k === 'rival') { var r = pick((TG.data.story || {}).rival); return r ? fmtLine(r) : '...'; }
      if (k === 'route') { var rt = S && idx.routes[S.currentRoute]; return rt ? rt.name : ''; }
      return m;
    });
  }
  TG.fmtLine = fmtLine;

  TG.log = function (text, cls) {
    if (!S) return;
    var entry = { t: now(), text: fmtLine(text), cls: cls || 'sys' };
    S.log.push(entry);
    if (S.log.length > 100) S.log.splice(0, S.log.length - 100);
    TG.emit('log', entry);
    return entry;
  };

  function queueLog(text, cls) {
    S.logQueue.push({ text: text, cls: cls });
  }
  TG.queueLog = queueLog;

  function revealLogQueue(t) {
    if (!S.logQueue.length) return;
    if (t - lastLogReveal < TG.config.logLineDelayMs) return;
    var e = S.logQueue.shift();
    lastLogReveal = t;
    TG.log(e.text, e.cls);
  }

  TG.flushLog = function () { while (S && S.logQueue.length) { var e = S.logQueue.shift(); TG.log(e.text, e.cls); } };

  function storyCls(trigger, line) {
    if (typeof TG.data.storyCls === 'function') {
      try { var c = TG.data.storyCls(trigger, line); if (c) return c; } catch (e) { /* fall through */ }
    }
    return STORY_CLS[trigger] || 'oak';
  }
  TG.storyCls = storyCls;

  TG.fire = function (trigger, subkey) {
    if (!S) return 0;
    var st = TG.data.story || {};
    var lines = st[trigger];
    var key = trigger;
    if (subkey !== undefined && subkey !== null) {
      lines = lines && !Array.isArray(lines) ? lines[subkey] : undefined;
      key = trigger + '.' + subkey;
    }
    if (typeof lines === 'string') lines = [lines];
    if (!Array.isArray(lines) || !lines.length) return 0;
    var shown = S.storyShown[key] || 0;
    if (shown >= lines.length) return 0;
    for (var i = shown; i < lines.length; i++) queueLog(lines[i], storyCls(trigger, lines[i]));
    S.storyShown[key] = lines.length;
    TG.emit('story', { trigger: trigger, subkey: subkey });
    return lines.length - shown;
  };

  TG.storyRandom = function (key, cls) {
    var line = pick((TG.data.story || {})[key]);
    if (line) TG.log(line, cls || storyCls(key, line));
    return line;
  };

  // ------------------------------------------------------------ effects
  function computeEffects() {
    var e = {
      producerMult: {}, allProducerMult: 1, tapMult: 1, tapAddRate: 0, encounterMult: 1,
      catchRateMult: 1, ballCost: 1, dexBonusMult: 1, candyMult: 1, offlineCap: 0, offlineMult: 1,
      autoCatch: 0, encounterQueue: 0, glitchMult: 1, instabilityDecay: 0
    };
    for (var id in S.upgrades) {
      if (!S.upgrades[id]) continue;
      var u = idx.upgrades[id];
      if (u && u.effect) applyEffect(e, u.effect);
    }
    for (var i = 0; i < effectSources.length; i++) {
      try { effectSources[i](e); } catch (err) { console.error('[TG] effect source', err); }
    }
    return e;
  }
  function applyEffect(e, ef) {
    var v = num(ef.value, 1);
    switch (ef.type) {
      case 'producerMult': e.producerMult[ef.target] = (e.producerMult[ef.target] || 1) * v; break;
      case 'allProducerMult': case 'tapMult': case 'encounterMult': case 'catchRateMult':
      case 'ballCost': case 'dexBonusMult': case 'candyMult': case 'offlineMult': case 'glitchMult':
        e[ef.type] *= v; break;
      case 'tapAddRate': case 'autoCatch': case 'encounterQueue': case 'instabilityDecay':
        e[ef.type] += num(ef.value, 0); break;
      case 'offlineCap': e.offlineCap = Math.max(e.offlineCap, num(ef.value, 0)); break;
      default: break; // 'flag' is applied once on purchase
    }
  }
  TG.applyEffect = applyEffect;
  TG.addEffectSource = function (fn) { effectSources.push(fn); effectsDirty = true; };
  TG.addRateMod = function (fn) { rateMods.push(fn); };
  TG.addSpawnHook = function (fn) { spawnHooks.push(fn); };
  TG.invalidate = function () { effectsDirty = true; };

  function activeEffect(type) {
    var a = S && S.activeEvent;
    if (!a || !a.effect || a.effect.type !== type) return null;
    return a.effect;
  }
  TG.activeEffect = activeEffect;

  function recompute() {
    if (!S) return;
    if (effectsDirty || !TG.effects) { TG.effects = computeEffects(); effectsDirty = false; }
    var e = TG.effects, m = TG.mults;
    var dexSum = 0, dexCount = 0, seen = 0;
    for (var id in S.dex) {
      var d = S.dex[id];
      if (!d) continue;
      var sp = idx.pokemon[id];
      if (!sp) continue;
      if (d.seen || d.caught) seen++;
      if (!d.caught) continue;
      dexCount++;
      var b = sp.stage === 3 ? 0.10 : sp.stage === 2 ? 0.05 : 0.02;
      if (d.shiny) b *= 2;
      dexSum += b;
    }
    m.dexCount = dexCount;
    m.seenCount = seen;
    m.dexBonus = 1 + dexSum * e.dexBonusMult;
    var badge = 1;
    for (var i = 0; i < S.badgeIds.length; i++) {
      var g = idx.gyms[S.badgeIds[i]];
      if (g && g.reward && g.reward.globalMult) badge *= g.reward.globalMult;
    }
    m.badge = badge;
    m.rareCandy = Math.pow(1.1, num(S.prestige && S.prestige.rareCandy, 0));
    var rdm = activeEffect('rdMult');
    m.event = rdm ? num(rdm.value, 1) : 1;
    m.mew = S.flags.mew ? 2 : 1;
    var gl = 1, gs = TG.systems && TG.systems.glitch;
    if (gs && typeof gs.rdMult === 'function') { try { gl = num(gs.rdMult(), 1); } catch (err) { gl = 1; } }
    m.glitch = gl;
    var extra = 1;
    for (i = 0; i < rateMods.length; i++) { try { extra *= num(rateMods[i](), 1); } catch (err) { /* ignore */ } }
    m.extra = extra;
    m.global = m.dexBonus * m.badge * m.rareCandy * m.event * m.glitch * m.mew * m.extra;

    var rd = 0, enc = 0, balls = 0, candy = 0, gb = 0;
    var prods = TG.data.producers || [];
    for (i = 0; i < prods.length; i++) {
      var p = prods[i];
      var n = S.producers[p.id] || 0;
      if (!n) continue;
      var pm = e.producerMult[p.id] || 1;
      rd += num(p.rd) * n * pm;
      enc += num(p.encounters) * n * pm;
      balls += num(p.balls) * n * pm;
      candy += num(p.candy) * n * pm;
      gb += num(p.gb) * n * pm;
    }
    var r = TG.rates;
    r.rd = rd * e.allProducerMult * m.global;
    r.encounters = enc * e.encounterMult * routeEncMult() * eventEncMult();
    r.balls = balls;
    r.candy = candy * e.candyMult;
    r.gb = gb * e.glitchMult;
  }
  TG.recompute = recompute;

  function routeEncMult() {
    var rt = idx.routes[S.currentRoute];
    return rt ? num(rt.encounterRateMult, 1) : 1;
  }
  function eventEncMult() {
    var em = activeEffect('encounterMult');
    return em ? num(em.value, 1) : 1;
  }

  TG.tapPower = function () {
    var e = TG.effects;
    var base = 1 * e.tapMult * (S.flags.bike ? 5 : 1) + e.tapAddRate * TG.rates.rd;
    return base * (S.flags.bike ? S.combo : 1);
  };
  TG.tapEncounterChance = function () {
    return Math.min(0.9, BASE_TAP_ENCOUNTER * TG.effects.encounterMult * routeEncMult() * eventEncMult());
  };
  TG.queueMax = function () { return BASE_QUEUE + Math.floor(TG.effects.encounterQueue); };
  TG.offlineCap = function () { return Math.max(2 * 3600, S.flags.fly ? 8 * 3600 : 0, TG.effects.offlineCap); };
  TG.offlineMult = function () { return (S.flags.fly ? 1 : 0.5) * TG.effects.offlineMult; };

  // ------------------------------------------------------- currency / cost
  function costParts(cost) {
    if (typeof cost === 'number') return { rd: cost, gb: 0, balls: 0 };
    if (!isObj(cost)) return { rd: 0, gb: 0, balls: 0 };
    return { rd: num(cost.rd), gb: num(cost.gb), balls: num(cost.balls) };
  }
  TG.costParts = costParts;
  TG.canAfford = function (cost) {
    var c = costParts(cost);
    return S.rd >= c.rd - 1e-9 && S.gb >= c.gb - 1e-9 && S.balls >= c.balls;
  };
  TG.spend = function (cost) {
    if (!TG.canAfford(cost)) return false;
    var c = costParts(cost);
    S.rd = Math.max(0, S.rd - c.rd);
    S.gb = Math.max(0, S.gb - c.gb);
    S.balls = Math.max(0, S.balls - c.balls);
    return true;
  };
  function addRD(x) {
    if (!(x > 0)) return;
    S.rd += x; S.rdTotal += x; S.rdLifetime += x;
  }
  TG.addRD = addRD;

  // ------------------------------------------------------- requirements
  function dexTypeCount(type) {
    var n = 0;
    for (var id in S.dex) {
      if (!S.dex[id] || !S.dex[id].caught) continue;
      var sp = idx.pokemon[id];
      if (sp && sp.types && sp.types.indexOf(type) >= 0) n++;
    }
    return n;
  }
  TG.dexTypeCount = dexTypeCount;

  // returns [{label, ok, key}] for UI
  TG.reqStatus = function (req) {
    var out = [];
    if (!req) return out;
    if (req.badges) out.push({ key: 'badges', label: req.badges + ' badge' + (req.badges > 1 ? 's' : ''), ok: S.badges >= req.badges });
    if (req.dexCount) out.push({ key: 'dex', label: 'Dex ' + Math.min(TG.mults.dexCount, req.dexCount) + '/' + req.dexCount, ok: TG.mults.dexCount >= req.dexCount });
    if (req.types) for (var t in req.types) {
      var have = dexTypeCount(t);
      out.push({ key: 'type_' + t, label: t + ' ' + Math.min(have, req.types[t]) + '/' + req.types[t], ok: have >= req.types[t] });
    }
    (req.routes || []).forEach(function (r) {
      var rt = idx.routes[r];
      out.push({ key: 'route_' + r, label: rt ? rt.name : r, ok: !!S.routes[r] });
    });
    (req.flags || []).forEach(function (f) {
      out.push({ key: 'flag_' + f, label: flagLabel(f), ok: !!S.flags[f] });
    });
    if (req.producers) for (var p in req.producers) {
      var pr = idx.producers[p];
      var own = S.producers[p] || 0;
      out.push({ key: 'prod_' + p, label: (pr ? pr.name : p) + ' ' + Math.min(own, req.producers[p]) + '/' + req.producers[p], ok: own >= req.producers[p] });
    }
    (req.upgrades || []).forEach(function (u) {
      var up = idx.upgrades[u];
      out.push({ key: 'upg_' + u, label: up ? up.name : u, ok: !!S.upgrades[u] });
    });
    (req.gyms || []).forEach(function (gid) {
      var g = idx.gyms[gid];
      out.push({ key: 'gym_' + gid, label: g ? (g.leader || g.name) : gid, ok: S.badgeIds.indexOf(gid) >= 0 });
    });
    if (req.rdTotal) out.push({ key: 'rdTotal', label: TG.fmt(req.rdTotal) + ' RD earned', ok: S.rdTotal >= req.rdTotal });
    return out;
  };
  TG.meets = function (req) {
    var st = TG.reqStatus(req);
    for (var i = 0; i < st.length; i++) if (!st[i].ok) return false;
    return true;
  };
  var FLAG_LABELS = {
    mart: 'Poké Mart', daycare: 'Day Care', bike: 'Bicycle', cut: 'HM Cut', surf: 'HM Surf', fly: 'HM Fly',
    strength: 'HM Strength', pokeflute: 'Poké Flute', lab_cinnabar: 'Cinnabar Lab', victory_road: 'Victory Road',
    champion: 'Champion', oldman: '???', gbc: 'Color'
  };
  function flagLabel(f) { return FLAG_LABELS[f] || f.replace(/_/g, ' '); }
  TG.flagLabel = flagLabel;

  // ------------------------------------------------------------ producers
  TG.producerVisible = function (p) {
    if (typeof p === 'string') p = idx.producers[p];
    if (!p) return false;
    if ((S.producers[p.id] || 0) > 0) return true;
    if (num(p.act, 1) > S.act) return false;
    var u = p.unlock || {};
    if (u.badges && S.badges < u.badges) return false;
    if (u.routes && u.routes.some(function (r) { return !S.routes[r]; })) return false;
    if (u.flags && u.flags.some(function (f) { return !S.flags[f]; })) return false;
    if (u.producers) for (var k in u.producers) if ((S.producers[k] || 0) < u.producers[k]) return false;
    if (u.rdTotal && S.rdTotal < u.rdTotal) return false;
    return true;
  };
  // currency a producer is bought with: 'rd' (baseCost) or 'gb' (cost: {gb})
  function producerCurrency(p) { return (isObj(p.cost) && p.cost.gb) ? 'gb' : 'rd'; }
  TG.producerCurrency = function (id) { var p = idx.producers[id]; return p ? producerCurrency(p) : 'rd'; };
  function producerBase(p) { return producerCurrency(p) === 'gb' ? num(p.cost.gb, 10) : num(p.baseCost, 10); }
  // numeric price in the producer's currency
  TG.producerPrice = function (id, n) {
    var p = idx.producers[id];
    if (!p) return Infinity;
    n = n || 1;
    var k = S.producers[id] || 0;
    var m = num(p.costMult, 1.15);
    var c0 = producerBase(p) * Math.pow(m, k);
    if (m === 1) return c0 * n;
    return c0 * (Math.pow(m, n) - 1) / (m - 1);
  };
  // cost in canAfford/spend format (number = RD, or {gb})
  TG.producerCost = function (id, n) {
    var p = idx.producers[id];
    var price = TG.producerPrice(id, n);
    return p && producerCurrency(p) === 'gb' ? { gb: price } : price;
  };
  TG.maxAffordable = function (id) {
    var p = idx.producers[id];
    if (!p) return 0;
    var wallet = producerCurrency(p) === 'gb' ? S.gb : S.rd;
    var k = S.producers[id] || 0;
    var m = num(p.costMult, 1.15);
    var c0 = producerBase(p) * Math.pow(m, k);
    if (wallet < c0) return 0;
    var n = m === 1 ? Math.floor(wallet / c0) : Math.floor(Math.log(wallet * (m - 1) / c0 + 1) / Math.log(m));
    while (n > 0 && TG.producerPrice(id, n) > wallet + 1e-9) n--;
    return Math.max(0, n);
  };
  TG.producerOutput = function (id) {
    // per-unit rates after multipliers (for display)
    var p = idx.producers[id];
    if (!p) return { rd: 0, encounters: 0, balls: 0, candy: 0, gb: 0 };
    var e = TG.effects, pm = e.producerMult[id] || 1;
    return {
      gb: num(p.gb) * pm * e.glitchMult,
      rd: num(p.rd) * pm * e.allProducerMult * TG.mults.global,
      encounters: num(p.encounters) * pm * e.encounterMult,
      balls: num(p.balls) * pm,
      candy: num(p.candy) * pm * e.candyMult
    };
  };
  TG.buyProducer = function (id, n) {
    var p = idx.producers[id];
    if (!p || !TG.producerVisible(p)) return false;
    if (n === 'max') n = TG.maxAffordable(id);
    n = Math.floor(num(n, 1));
    if (n < 1) return false;
    var cost = TG.producerCost(id, n);
    if (!TG.spend(cost)) return false;
    S.producers[id] = (S.producers[id] || 0) + n;
    S.producersEverBought += n;
    recompute();
    TG.fire('first_producer');
    if (TG.sfx) TG.sfx.play('buy');
    TG.emit('buy', { kind: 'producer', id: id, n: n, cost: cost });
    return true;
  };

  // ------------------------------------------------------------ upgrades
  TG.upgradeAvailable = function (u) {
    if (typeof u === 'string') u = idx.upgrades[u];
    if (!u || S.upgrades[u.id]) return false;
    return TG.meets(u.requires);
  };
  TG.buyUpgrade = function (id) {
    var u = idx.upgrades[id];
    if (!u || !TG.upgradeAvailable(u)) return false;
    if (!TG.spend(u.cost)) return false;
    S.upgrades[id] = true;
    effectsDirty = true;
    if (u.effect && u.effect.type === 'flag' && u.effect.value) TG.setFlag(u.effect.value);
    recompute();
    if (TG.sfx) TG.sfx.play('buy');
    TG.log('Got ' + u.name + '!', 'sys');
    TG.fire('first_upgrade');
    TG.emit('buy', { kind: 'upgrade', id: id });
    return true;
  };

  // ------------------------------------------------------------ Poké Mart
  TG.ballPrice = function (n) {
    n = n || 1;
    var b = S.ballsBought || 0;
    // linear mild scaling: each ball bought raises the price by 0.1%
    var sum = n + 0.001 * (n * b + n * (n - 1) / 2);
    return BALL_PRICE * TG.effects.ballCost * sum;
  };
  TG.buyBalls = function (n) {
    n = Math.max(1, Math.floor(num(n, 1)));
    if (!S.flags.mart) return false;
    var cost = TG.ballPrice(n);
    if (!TG.spend(cost)) return false;
    S.balls += n;
    S.ballsBought = (S.ballsBought || 0) + n;
    if (TG.sfx) TG.sfx.play('buy');
    TG.emit('buy', { kind: 'balls', n: n, cost: cost });
    return true;
  };

  // ------------------------------------------------------------ routes
  TG.routeAvailable = function (r) {
    if (typeof r === 'string') r = idx.routes[r];
    if (!r) return false;
    if (S.routes[r.id]) return true;
    return TG.meets(r.requires);
  };
  TG.unlockRoute = function (id) {
    var r = idx.routes[id];
    if (!r) return false;
    if (S.routes[id]) return TG.setRoute(id);
    if (!TG.meets(r.requires)) return false;
    if (!TG.spend(num(r.cost, 0))) return false;
    S.routes[id] = true;
    TG.log('New area: ' + r.name + '!', 'sys');
    TG.fire('route_unlock', id);
    if (TG.sfx) TG.sfx.play('buy');
    TG.emit('route', { type: 'unlock', id: id });
    TG.setRoute(id);
    return true;
  };
  TG.setRoute = function (id) {
    var r = idx.routes[id];
    if (!r || !S.routes[id]) return false;
    S.currentRoute = id;
    recompute();
    if (r.special === 'truck' && !S.flags.truck_moved) TG.fire('truck_found');
    TG.emit('route', { type: 'enter', id: id });
    TG.emit('route_enter', r);
    return true;
  };

  // ------------------------------------------------------------ encounters
  function markSeen(id) {
    var d = S.dex[id];
    if (!d) { d = S.dex[id] = { caught: 0, shiny: 0, seen: true }; TG.emit('dex', { id: id, seen: true }); }
    else if (!d.seen) { d.seen = true; TG.emit('dex', { id: id, seen: true }); }
  }
  TG.markSeen = markSeen;

  function encounterTable(route) {
    if (!route) return [];
    var night = TG.isNight() && route.night && route.night.length;
    var table = night ? route.night : (route.encounters || []);
    if (route.special === 'cerulean_cave' && !S.flags.champion) table = table.filter(function (t) { return t.id !== 150; });
    return table.filter(function (t) { return t && TG.species(t.id); });
  }
  TG.encounterTable = function (routeId) { return encounterTable(idx.routes[routeId || S.currentRoute]); };

  function spawnEncounter(opts) {
    opts = opts || {};
    if (!opts.force && S.encounters.length >= TG.queueMax()) return null;
    var route = idx.routes[S.currentRoute];
    var id = opts.id;
    if (id == null) {
      var em = activeEffect('encounterMult');
      if (em && em.forceSpecies != null) id = em.forceSpecies;
    }
    if (id == null) { var row = weighted(encounterTable(route)); id = row ? row.id : null; }
    if (id == null) return null;
    var enc = { uid: S.encUid++, id: id, shiny: opts.shiny != null ? !!opts.shiny : Math.random() < SHINY_CHANCE, misses: 0 };
    if (opts.catchRate != null) enc.catchRate = opts.catchRate;
    if (opts.noFlee) enc.noFlee = true;
    for (var i = 0; i < spawnHooks.length; i++) {
      var res;
      try { res = spawnHooks[i](enc, route); } catch (e) { console.error('[TG] spawn hook', e); res = undefined; }
      if (res === null) return null;
      if (res && typeof res === 'object') enc = res;
    }
    if (enc.uid == null) enc.uid = S.encUid++;
    S.encounters.push(enc);
    markSeen(enc.id);
    if (enc.shiny) {
      TG.log('Something in the grass is SPARKLING...', 'sys');
      if (TG.sfx) TG.sfx.play('shiny');
    }
    TG.emit('encounter', { type: 'spawn', enc: enc });
    return enc;
  }
  TG.spawnEncounter = spawnEncounter;

  TG.tap = function () {
    var t = now();
    if (S.flags.bike) {
      if (t - lastTapAt < 400) S.combo = Math.min(3, S.combo + 0.08);
    }
    lastTapAt = t;
    var gain = TG.tapPower();
    addRD(gain);
    S.taps++;
    if (S.taps === 1) TG.fire('first_tap');
    var spawned = null;
    if (Math.random() < TG.tapEncounterChance()) spawned = spawnEncounter();
    if (TG.sfx) TG.sfx.play('tap');
    var res = { gain: gain, spawned: spawned, combo: S.combo };
    TG.emit('tap', res);
    return res;
  };

  function registerCatch(enc, weight, silent) {
    weight = weight || 1;
    var sp = TG.species(enc.id);
    var d = S.dex[enc.id];
    if (!d) d = S.dex[enc.id] = { caught: 0, shiny: 0, seen: true };
    var isNew = !d.caught;
    d.caught += weight;
    d.seen = true;
    if (enc.shiny) { d.shiny = (d.shiny || 0) + 1; S.stats.shinies++; }
    if (isNew || enc.shiny) recompute();
    var gain = num(sp && sp.baseValue, 10) * TG.mults.global * (enc.shiny ? 10 : 1) * weight;
    addRD(gain);
    if (sp && sp.family) S.candy[sp.family] = (S.candy[sp.family] || 0) + TG.effects.candyMult * weight;
    S.stats.catches += weight;
    if (!silent) {
      TG.fire('first_catch');
      if (enc.shiny) TG.fire('shiny');
      if (isNew && sp) TG.log('New Pokédex entry: ' + sp.name.toUpperCase() + ' (#' + String(enc.id).padStart(3, '0') + ')', 'sys');
    }
    if (isNew) { checkDexMilestones(); TG.emit('dex', { id: enc.id, caught: true }); }
    if (enc.id === 151 && !S.flags.mew) { TG.setFlag('mew'); TG.fire('mew'); recompute(); }
    TG.emit('catch', { enc: enc, gain: gain, isNew: isNew, weight: weight, silent: !!silent });
    return { gain: gain, isNew: isNew };
  }
  TG.registerCatch = registerCatch;

  function checkDexMilestones() {
    var c = TG.mults.dexCount;
    DEX_MILESTONES.forEach(function (m) { if (c >= m) TG.fire('dex_' + m); });
  }

  TG.throwBall = function (i, auto) {
    var enc = S.encounters[i];
    if (!enc) return { ok: false, reason: 'none' };
    if (S.balls < 1) { if (!auto && TG.sfx) TG.sfx.play('error'); return { ok: false, reason: 'balls' }; }
    S.balls -= 1;
    S.stats.ballsThrown++;
    var sp = TG.species(enc.id);
    var base = enc.catchRate != null ? enc.catchRate : num(sp && sp.catchRate, 0.3);
    var chance = Math.min(1, base * TG.effects.catchRateMult);
    var res;
    if (Math.random() < chance) {
      S.encounters.splice(i, 1);
      var c = registerCatch(enc, 1, false);
      res = { ok: true, caught: true, enc: enc, gain: c.gain, isNew: c.isNew };
      if (!auto && TG.sfx) TG.sfx.play('catch');
    } else {
      enc.misses++;
      res = { ok: true, caught: false, enc: enc, fled: false };
      if (!enc.noFlee && enc.misses >= MAX_FLEE_MISSES) {
        S.encounters.splice(i, 1);
        res.fled = true;
        S.stats.fled++;
        if (!auto) TG.log('The wild ' + (sp ? sp.name.toUpperCase() : '???') + ' fled!', 'sys');
        TG.fire('first_flee');
        if (!auto && TG.sfx) TG.sfx.play('flee');
      } else if (!auto && TG.sfx) TG.sfx.play('miss');
    }
    res.index = i;
    res.auto = !!auto;
    TG.emit('throw', res);
    TG.emit('encounter', { type: 'throw', res: res });
    return res;
  };
  TG.throwBallUid = function (uid, auto) {
    for (var i = 0; i < S.encounters.length; i++) if (S.encounters[i].uid === uid) return TG.throwBall(i, auto);
    return { ok: false, reason: 'none' };
  };

  // ------------------------------------------------------------ candy / evolution
  function ownedFamilies() {
    var fams = [], seen = {};
    for (var id in S.dex) {
      if (!S.dex[id] || !S.dex[id].caught) continue;
      var sp = idx.pokemon[id];
      if (sp && sp.family && !seen[sp.family]) { seen[sp.family] = 1; fams.push(sp.family); }
    }
    return fams;
  }
  TG.ownedFamilies = ownedFamilies;

  function distributeCandy(n) {
    n = Math.floor(n);
    if (n <= 0) return 0;
    var fams = ownedFamilies();
    if (!fams.length) return 0;
    var each = Math.floor(n / fams.length), rem = n % fams.length;
    for (var i = 0; i < fams.length; i++) {
      if (each) S.candy[fams[i]] = (S.candy[fams[i]] || 0) + each;
    }
    for (i = 0; i < rem; i++) {
      var f = fams[(S.candyRR + i) % fams.length];
      S.candy[f] = (S.candy[f] || 0) + 1;
    }
    S.candyRR = (S.candyRR + rem) % Math.max(1, fams.length);
    TG.emit('candy', n);
    return n;
  }
  TG.distributeCandy = distributeCandy;

  TG.evolutionUnlocked = function () { return !!(S.flags.daycare || S.flags.evolution || S.badges >= 2); };
  TG.evolveTargets = function (id) {
    var sp = idx.pokemon[id];
    if (!sp || !sp.evolvesTo) return [];
    return (Array.isArray(sp.evolvesToAlt) && sp.evolvesToAlt.length) ? sp.evolvesToAlt.slice() : [sp.evolvesTo];
  };
  TG.canEvolve = function (id) {
    var sp = idx.pokemon[id];
    if (!sp || !sp.evolvesTo || !sp.candyToEvolve) return { ok: false, reason: 'none' };
    if (!S.dex[id] || !S.dex[id].caught) return { ok: false, reason: 'notcaught' };
    if (!TG.evolutionUnlocked()) return { ok: false, reason: 'locked' };
    var have = Math.floor(S.candy[sp.family] || 0);
    if (have < sp.candyToEvolve) return { ok: false, reason: 'candy', need: sp.candyToEvolve, have: have };
    return { ok: true, need: sp.candyToEvolve, have: have };
  };
  TG.evolve = function (id, target) {
    var chk = TG.canEvolve(id);
    if (!chk.ok) return false;
    var sp = idx.pokemon[id];
    var targets = TG.evolveTargets(id);
    var toId = (target != null && targets.indexOf(target) >= 0) ? target : sp.evolvesTo;
    var to = TG.species(toId);
    S.candy[sp.family] -= sp.candyToEvolve;
    S.stats.evolutions++;
    TG.log('What? ' + sp.name.toUpperCase() + ' is evolving!', 'sys');
    registerCatch({ id: toId, shiny: false }, 1, true);
    TG.log(sp.name.toUpperCase() + ' evolved into ' + (to ? to.name.toUpperCase() : '???') + '!', 'sys');
    TG.fire('first_evolve');
    if (TG.sfx) TG.sfx.play('evolve');
    TG.emit('evolve', { from: id, to: toId });
    return true;
  };

  // ------------------------------------------------------------ gyms
  TG.gymStatus = function (g) {
    if (typeof g === 'string') g = idx.gyms[g];
    if (!g) return null;
    var beaten = S.badgeIds.indexOf(g.id) >= 0;
    var reqs = TG.reqStatus(g.requires);
    var bi = g.badgeIndex || 0;
    if (bi >= 9 && bi <= 12) {
      reqs.unshift({ key: 'order', label: bi === 9 ? '8 badges' : 'Beat Elite #' + (bi - 9), ok: S.badges >= 8 && S.elite >= bi - 9 });
    } else if (bi === 13) {
      reqs.unshift({ key: 'order', label: 'Beat the Elite Four', ok: S.elite >= 4 });
    }
    var meets = reqs.every(function (r) { return r.ok; });
    return { gym: g, beaten: beaten, reqs: reqs, meets: meets, affordable: TG.canAfford(num(g.cost, 0)), cost: num(g.cost, 0) };
  };
  TG.challengeGym = function (id) {
    var st = TG.gymStatus(id);
    if (!st) return { ok: false, reason: 'unknown' };
    if (st.beaten) return { ok: false, reason: 'beaten' };
    if (!st.meets) { if (TG.sfx) TG.sfx.play('error'); return { ok: false, reason: 'requirements', reqs: st.reqs }; }
    if (!TG.spend(st.cost)) { if (TG.sfx) TG.sfx.play('error'); return { ok: false, reason: 'cost' }; }
    var g = st.gym, bi = g.badgeIndex || 0;
    S.badgeIds.push(g.id);
    if (bi >= 1 && bi <= 8) S.badges++;
    else if (bi >= 9 && bi <= 12) S.elite++;
    if (g.defeatQuote) TG.log((g.leader || g.name).toUpperCase() + ': "' + g.defeatQuote + '"', 'rival');
    else if (g.quote) TG.log((g.leader || g.name).toUpperCase() + ': "' + g.quote + '"', 'rival');
    var rw = g.reward || {};
    (rw.flags || []).forEach(function (f) { TG.setFlag(f); });
    (rw.unlockTabs || []).forEach(function (t) { TG.unlockTab(t); });
    if (rw.log) TG.log(rw.log, 'sys');
    else if (g.badge) TG.log('You received the ' + g.badge + '!', 'sys');
    TG.fire('badge', g.id);
    effectsDirty = true;
    recompute();
    if (TG.sfx) TG.sfx.play('badge');
    if (bi >= 1 && S.act < 2) setAct(2);
    TG.emit('badge', { id: g.id, gym: g });
    if (bi === 13) {
      S.champion = true;
      TG.setFlag('champion');
      TG.fire('champion');
      TG.emit('credits', { lines: (TG.data.story || {}).credits || ['TALL GRASS', 'THE END'] });
    }
    TG.save();
    return { ok: true };
  };

  // ------------------------------------------------------------ truck / secrets
  TG.truckVisible = function () {
    var r = idx.routes[S.currentRoute];
    return !!(r && r.special === 'truck' && !S.flags.truck_moved);
  };
  TG.tapTruck = function () {
    if (!TG.truckVisible()) return { ok: false };
    if (!S.flags.strength) {
      if (Math.random() < 0.25) TG.log('It\'s a truck. It won\'t budge.', 'sys');
      return { ok: true, moved: false, needStrength: true };
    }
    S.truckTaps++;
    if (S.truckTaps % 10 === 0 && S.truckTaps < 50) TG.log('You push the truck with STRENGTH... (' + S.truckTaps + '/50)', 'sys');
    if (S.truckTaps >= 50) {
      TG.setFlag('truck_moved');
      TG.fire('truck_moved');
      spawnEncounter({ id: 151, catchRate: 1, noFlee: true, force: true, shiny: false });
      TG.emit('truck', { moved: true });
      return { ok: true, moved: true };
    }
    TG.emit('truck', { moved: false, taps: S.truckTaps });
    return { ok: true, moved: false, taps: S.truckTaps };
  };

  TG.talkOldMan = function () {
    if (!TG.oldManAvailable()) return false;
    TG.fire('oldman');
    TG.setFlag('oldman');
    return true;
  };
  TG.oldManAvailable = function () {
    if (S.routes.viridian) return true;
    return Object.keys(S.routes).some(function (k) { return k.indexOf('viridian') === 0 && k !== 'viridian_forest'; });
  };

  TG.counterEvent = function () {
    var a = S.activeEvent;
    if (!a || !a.effect || a.effect.type !== 'steal') return false;
    a.countered = true;
    S.activeEvent = null;
    TG.log('You fought them off! TEAM ROCKET is blasting off again!', 'sys');
    recompute();
    TG.emit('event', { type: 'end', event: a, countered: true });
    return true;
  };

  TG.prestige = function () {
    var sr = TG.systems && TG.systems.sram;
    if (sr && typeof sr.prestige === 'function') return sr.prestige();
    TG.log('Nothing happens.', 'sys');
    return false;
  };

  // ------------------------------------------------------------ tabs / time
  TG.unlockTab = function (name) {
    if (!S || S.tabs[name]) return;
    S.tabs[name] = true;
    TG.emit('tabs', name);
  };
  TG.isNight = function () {
    if (TG.config.forceNight === true || TG.config.forceNight === false) return TG.config.forceNight;
    var h = new Date().getHours();
    return h >= 20 || h < 6;
  };

  // ------------------------------------------------------------ random events
  function rollEvent(t) {
    var night = TG.isNight();
    var evs = (TG.data.events || []).filter(function (e) {
      if (!e) return false;
      if ((e.minAct || 1) > S.act) return false;
      if (e.night && !night) return false;
      if (e.requires && !TG.meets(e.requires)) return false;
      return true;
    });
    var ev = weighted(evs);
    if (ev) startEvent(ev, t);
  }
  function startEvent(ev, t) {
    var ef = ev.effect || { type: 'none' };
    var text = fmtLine(ev.text || '');
    S.stats.eventsSeen++;
    if (ef.type === 'freeBalls') S.balls += num(ef.count, 5);
    if (ef.type === 'candyRain') distributeCandy(num(ef.count, 10));
    var timed = num(ev.duration, 0) > 0 && (ef.type === 'steal' || ef.type === 'rdMult' || ef.type === 'encounterMult');
    if (timed) {
      S.activeEvent = { id: ev.id, startedAt: t, endsAt: t + ev.duration * 1000, effect: clone(ef), text: text, countered: false };
      recompute();
    }
    TG.log(text, (ev.id === 'rival' || ef.type === 'steal') ? 'rival' : 'sys');
    if (TG.sfx) TG.sfx.play('event');
    TG.emit('event', { type: 'start', event: ev, active: timed ? S.activeEvent : null, text: text });
  }
  TG.startEvent = function (id) {
    var ev = (TG.data.events || []).find(function (e) { return e.id === id; });
    if (ev) startEvent(ev, now());
    return !!ev;
  };
  function endEvent() {
    var a = S.activeEvent;
    if (!a) return;
    S.activeEvent = null;
    if (a.effect.type === 'steal' && !a.countered) {
      var lost = S.rd * num(a.effect.pct, 0.1);
      S.rd -= lost;
      TG.log('TEAM ROCKET got away with ' + TG.fmt(lost) + ' RD!', 'rival');
    }
    recompute();
    TG.emit('event', { type: 'end', event: a, countered: !!a.countered });
  }

  // ------------------------------------------------------------ periodic checks (1 Hz)
  function perSecond(t) {
    // tab unlocks
    if (!S.tabs.town) {
      var prods = (TG.data.producers || []).filter(TG.producerVisible);
      var cheapest = prods.reduce(function (m, p) { return Math.min(m, num(p.baseCost, 1e99)); }, Infinity);
      if (S.rd >= cheapest || S.producersEverBought > 0) TG.unlockTab('town');
    }
    if (!S.tabs.map) {
      var cheapRoute = Infinity;
      (TG.data.routes || []).forEach(function (r) { if (!S.routes[r.id] && TG.meets(r.requires)) cheapRoute = Math.min(cheapRoute, num(r.cost, 0)); });
      if (Object.keys(S.routes).length > 1 || S.rdTotal >= cheapRoute) TG.unlockTab('map');
    }
    // day / night
    var night = TG.isNight();
    if (S.lastNight !== night) {
      var first = S.lastNight === null;
      S.lastNight = night;
      if (night) TG.fire('night');
      if (!first) TG.emit('daynight', night);
      recompute();
    }
    // events
    if (S.activeEvent && t >= S.activeEvent.endsAt) endEvent();
    if (!S.activeEvent && t >= S.nextEventAt) {
      S.nextEventAt = t + rand(0.66, 1.33) * TG.config.eventEverySec * 1000;
      if (S.taps > 20 || S.producersEverBought > 0) rollEvent(t);
    }
    if (t >= S.nextIdleAt) {
      S.nextIdleAt = t + rand(0.7, 1.3) * TG.config.idleEverySec * 1000;
      if (S.taps > 0 && !S.logQueue.length) TG.storyRandom('idle_lines');
    }
    // autosave
    if (t - lastAutosave >= TG.config.autosaveMs) { lastAutosave = t; TG.save(); }
  }

  // ------------------------------------------------------------ tick
  function step(dt, t) {
    recompute();
    var r = TG.rates, e = TG.effects;
    addRD(r.rd * dt);
    if (r.gb > 0) S.gb += r.gb * dt;
    S.stats.playtime += dt;

    // passive encounters
    if (r.encounters > 0) {
      S.acc.enc += r.encounters * dt;
      var guard = 0;
      while (S.acc.enc >= 1 && guard++ < 20) {
        S.acc.enc -= 1;
        if (!spawnEncounter()) { S.acc.enc = Math.min(S.acc.enc, 1); break; }
      }
    }
    // ball production
    if (r.balls > 0) {
      S.acc.balls += r.balls * dt;
      if (S.acc.balls >= 1) { var nb = Math.floor(S.acc.balls); S.balls += nb; S.acc.balls -= nb; }
    }
    // Oak's ball drip until the Poké Mart opens
    if (!S.flags.mart) {
      S.acc.drip += dt;
      if (S.acc.drip >= DRIP_SECONDS) {
        S.acc.drip -= DRIP_SECONDS;
        if (S.balls < DRIP_CAP) { S.balls += 1; TG.emit('drip', 1); }
      }
    }
    // candy production
    if (r.candy > 0) {
      S.acc.candy += r.candy * dt;
      if (S.acc.candy >= 1) { var nc = Math.floor(S.acc.candy); S.acc.candy -= nc; distributeCandy(nc); }
    }
    // auto-catch
    if (e.autoCatch > 0) {
      S.acc.auto += e.autoCatch * dt;
      var g2 = 0;
      while (S.acc.auto >= 1 && S.encounters.length && S.balls >= 1 && g2++ < 50) {
        S.acc.auto -= 1;
        TG.throwBall(0, true);
      }
      if (S.acc.auto > 1) S.acc.auto = 1;
    }
    // combo decay
    if (S.combo > 1 && t - lastTapAt > 400) S.combo = Math.max(1, S.combo - 1.2 * dt);

    revealLogQueue(t);
    if (t - lastSecond >= 1000) { lastSecond = t; perSecond(t); }
    TG.emit('tick', dt);
  }
  TG.step = function (dt) { step(dt || DT, now()); };

  // ------------------------------------------------------------ offline
  TG.applyOffline = function (seconds) {
    recompute();
    if (S.activeEvent) { S.activeEvent = null; recompute(); }
    var cap = TG.offlineCap();
    var t = Math.max(0, Math.min(seconds, cap));
    var mult = TG.offlineMult();
    var sum = { seconds: seconds, effective: t, capped: seconds > cap, cap: cap, mult: mult, rd: 0, balls: 0, catches: 0, newSpecies: [], candy: 0, lines: [] };
    var rd = TG.rates.rd * t * mult;
    addRD(rd);
    sum.rd = rd;
    if (TG.rates.gb > 0) { sum.gb = TG.rates.gb * t * mult; S.gb += sum.gb; }
    var ballsGain = Math.floor(TG.rates.balls * t * mult);
    if (!S.flags.mart && S.balls < DRIP_CAP) ballsGain += Math.min(DRIP_CAP - S.balls, Math.floor(t / DRIP_SECONDS));
    S.balls += ballsGain;
    sum.balls = ballsGain;
    var candy = Math.floor(TG.rates.candy * t * mult);
    sum.candy = distributeCandy(candy);

    // encounters + auto-catch (expected-value simulation)
    var encAvail = TG.rates.encounters * t * mult;
    var auto = TG.effects.autoCatch;
    if (auto > 0 && (encAvail + S.encounters.length) >= 1 && S.balls >= 1) {
      var table = encounterTable(idx.routes[S.currentRoute]);
      var tw = 0, avg = 0;
      table.forEach(function (row) { var sp = TG.species(row.id); var w = num(row.weight, 1); tw += w; avg += w * Math.min(1, num(sp && sp.catchRate, 0.3) * TG.effects.catchRateMult); });
      avg = tw > 0 ? avg / tw : 0.3;
      if (avg > 0) {
        var throws = Math.min(auto * t, S.balls);
        var catches = Math.floor(Math.min(encAvail, throws * avg));
        if (catches > 0) {
          S.balls = Math.max(0, S.balls - Math.ceil(catches / avg));
          var samples = Math.min(catches, 300);
          var base = Math.floor(catches / samples), rem = catches % samples;
          for (var i = 0; i < samples; i++) {
            var row = weighted(table);
            if (!row) break;
            markSeen(row.id);
            var c = registerCatch({ id: row.id, shiny: Math.random() < SHINY_CHANCE * (base + (i < rem ? 1 : 0)) }, base + (i < rem ? 1 : 0), true);
            sum.rd += c.gain;
            if (c.isNew) sum.newSpecies.push(row.id);
          }
          sum.catches = catches;
        }
      }
    } else if (encAvail >= 1) {
      var n = Math.min(Math.floor(encAvail), TG.queueMax() - S.encounters.length);
      for (var j = 0; j < n; j++) spawnEncounter();
    }
    S.combo = 1;
    S.nextEventAt = now() + 30000;
    if (seconds >= 60) TG.fire('offline_return');
    recompute();
    TG.emit('offline', sum);
    return sum;
  };

  // ------------------------------------------------------------ loop
  function frame() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    var t = now();
    var gap = t - S.lastTick;
    if (gap < 0) { S.lastTick = t; return; }
    if (gap > 15000) {
      // tab was hidden / device slept: treat as offline time
      S.lastTick = t;
      TG.applyOffline(gap / 1000);
      return;
    }
    var n = 0;
    while (t - S.lastTick >= TICK && n < 60) {
      S.lastTick += TICK;
      step(DT, S.lastTick);
      n++;
    }
    if (n >= 60) S.lastTick = t;
  }
  TG.start = function () {
    if (running) return;
    running = true;
    lastAutosave = now();
    rafId = requestAnimationFrame(frame);
  };
  TG.stop = function () { running = false; cancelAnimationFrame(rafId); };

  // ------------------------------------------------------------ save / load
  TG.save = function () {
    if (!S) return false;
    S.lastSave = now();
    try {
      localStorage.setItem(TG.config.saveKey, JSON.stringify(S));
      TG.emit('save', S.lastSave);
      return true;
    } catch (e) {
      console.warn('[TG] save failed', e);
      return false;
    }
  };
  TG.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(TG.config.saveKey); } catch (e) { raw = null; }
    if (!raw) return false;
    try {
      setState(migrate(JSON.parse(raw)));
    } catch (e) {
      console.error('[TG] could not load save', e);
      try { localStorage.setItem(TG.config.saveKey + '.corrupt', raw); } catch (e2) { /* ignore */ }
      return false;
    }
    TG.emit('load', S);
    return true;
  };
  function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64decode(str) { return decodeURIComponent(escape(atob(str))); }
  TG.exportSave = function () {
    S.lastSave = now();
    return b64encode(JSON.stringify(S));
  };
  TG.importSave = function (str) {
    str = String(str || '').trim();
    if (!str) return false;
    var obj;
    try { obj = JSON.parse(str[0] === '{' ? str : b64decode(str.replace(/\s+/g, ''))); } catch (e) { return false; }
    if (!isObj(obj) || typeof obj.rd !== 'number') return false;
    try { obj = migrate(obj); } catch (e) { return false; }
    obj.lastTick = now();
    obj.lastSave = now();
    setState(obj);
    TG.save();
    TG.emit('load', S);
    return true;
  };
  TG.newGame = function () {
    setState(defaultState());
    TG.fire('start');
    TG.emit('load', S);
    TG.save();
  };
  TG.hardReset = function () {
    try { localStorage.removeItem(TG.config.saveKey); } catch (e) { /* ignore */ }
    TG.newGame();
  };

  // ------------------------------------------------------------ init
  TG.init = function () {
    buildIndex();
    var loaded = TG.load();
    if (!loaded) { setState(defaultState()); TG.fire('start'); }
    recompute();
    return loaded;
  };
  // offline progress since the last save; returns summary or null
  TG.catchUp = function () {
    var t = now();
    var away = (t - (S.lastSave || S.lastTick || t)) / 1000;
    S.lastTick = t;
    if (away < 10) return null;
    return TG.applyOffline(away);
  };

  TG.debugInfo = function () {
    recompute();
    var e = TG.effects;
    return {
      act: S.act, night: TG.isNight(), route: S.currentRoute,
      rates: Object.assign({}, TG.rates),
      mults: Object.assign({}, TG.mults),
      tapPower: TG.tapPower(), tapEncounterChance: TG.tapEncounterChance(), combo: S.combo,
      queueMax: TG.queueMax(), catchRateMult: e.catchRateMult, autoCatch: e.autoCatch,
      allProducerMult: e.allProducerMult, encounterMult: e.encounterMult, ballCost: e.ballCost,
      offlineCap: TG.offlineCap(), offlineMult: TG.offlineMult(),
      shinyChance: SHINY_CHANCE, nextEventIn: Math.max(0, (S.nextEventAt - now()) / 1000),
      flags: Object.keys(S.flags).filter(function (k) { return S.flags[k]; })
    };
  };
})();
