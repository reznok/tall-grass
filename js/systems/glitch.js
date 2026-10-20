/* TALL GRASS — systems/glitch.js (late-game agent)
 * ACT 3 — THE GLITCH.
 *  - The door: Cinnabar Coast + surf + champion + oldman -> MISSINGNO. spawns. Catching it duplicates
 *    the 6th producer ever bought ×128, sets flag "glitch", act 3, unlocks the Glitch tab, glitch palette.
 *  - Glitch Bytes (state.gb, engine-produced by corrupt_* producers), lifetime in state.gbLifetime.
 *  - Instability (state.instability 0..100): rises with glitch purchases/catches, decays per second,
 *    drives body.glitch-1..3 and TG.ui.corrupt intensity. At 100 the game "crashes".
 *  - Glitch Dex: 32 entries (#152..#183), 5 fixed + procedurally generated from a save-stable seed
 *    (state.prestige.seed). Registered with ▓ (cost ×2.2 each), +1% RD each.
 *  - Glitch City spawns glitch dex encounters; catching them pays ▓.
 *  - Someone else writes in the log (story.glitch_whisper), Hall of Fame block in the Lab tab.
 * Contract: docs/ARCHITECTURE.md ("Late-game additions").
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.systems = TG.systems || {};

  var BASE_DECAY = 0.2;          // instability / s
  var DEX_BASE_COST = 50;        // ▓ for the first purchased glitch dex entry
  var DEX_COST_MULT = 2.2;
  var DEX_RD_BONUS = 0.01;       // +1% RD per registered entry
  var DEX_INSTABILITY = 3;
  var CRASH_LOSS = 0.1;
  var CRASH_MS = 3000;
  var DUP_FACTOR = 128;
  var DUP_CAP = 1e6;
  var MISSINGNO_GB = 128;        // ▓ seed grant when MISSINGNO. is caught
  var CITY_RISE = 0.25;          // instability / s while standing in Glitch City
  var WHISPER_MIN = 120, WHISPER_MAX = 240; // seconds
  var HINT_MIN = 90, HINT_MAX = 180;

  var S = null;
  var list = [];                 // glitch species (dex order)
  var byId = {};
  var genSeed = null;
  var doorPending = false;
  var crashing = false;
  var lastLevel = -1;
  var lastUi = 0, lastSlow = 0;
  var dirty = { glitch: true, hof: true };
  var refs = {};

  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : (d || 0); }
  function now() { return Date.now(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmt(n) { return TG.fmt ? TG.fmt(n) : String(Math.floor(n)); }
  function pad3(n) { return String(n).padStart(3, '0'); }
  function reduceMotion() {
    return !!((S && S.settings && S.settings.reduceMotion) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  }
  function corrupt(text, i) { return TG.ui && TG.ui.corrupt ? TG.ui.corrupt(text, i) : text; }
  function sfx(n) { if (TG.sfx) TG.sfx.play(n); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function setText(e, s) { if (e && e._t !== s) { e._t = s; e.textContent = s; } }
  function setHidden(e, h) { h = !!h; if (e && e.hidden !== h) e.hidden = h; }
  function setClass(e, c, on) { on = !!on; if (e && e.classList.contains(c) !== on) e.classList.toggle(c, on); }

  // ------------------------------------------------------------ seeded RNG
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function ri(rng, n) { return Math.floor(rng() * n); }

  // ------------------------------------------------------------ procedural glitch dex
  function corruptName(src, rng, other) {
    var D = TG.data.glitch || {};
    var syms = D.nameSymbols || ['▓', "'", '.', '4', 'h'];
    var a = String(src || 'MISSINGNO');
    var len = 2 + ri(rng, Math.min(5, Math.max(1, a.length - 1)));
    var st = ri(rng, Math.max(1, a.length - len + 1));
    var s = a.substr(st, len);
    if (rng() < 0.45 && other) { var b = String(other); var l2 = 1 + ri(rng, 3); s += b.substr(ri(rng, Math.max(1, b.length - l2 + 1)), l2); }
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      out += rng() < 0.5 ? ch.toUpperCase() : ch.toLowerCase();
    }
    var nSym = 1 + ri(rng, 2);
    for (var k = 0; k < nSym; k++) {
      var sym = syms[ri(rng, syms.length)];
      var pos = ri(rng, out.length + 1);
      out = out.slice(0, pos) + sym + out.slice(pos);
    }
    return out.slice(0, 11);
  }

  // scramble a 16x16 grid deterministically (or make noise when there is no base)
  function scrambleGrid(base, seed) {
    var rng = mulberry32(seed);
    var g = [], x, y;
    for (y = 0; y < 16; y++) {
      var row = [];
      var src = base && base[y] ? String(base[y]) : '';
      for (x = 0; x < 16; x++) row.push(src[x] || '.');
      g.push(row);
    }
    if (!base) {
      // symmetric noise blob
      for (y = 2; y < 14; y++) for (x = 2; x < 8; x++) {
        var dx = (x - 7.5) / 6, dy = (y - 7.5) / 6;
        var c = (dx * dx + dy * dy < 1 && rng() < 0.8) ? '123'[ri(rng, 3)] : '.';
        g[y][x] = c; g[y][15 - x] = c;
      }
    }
    // horizontal tears
    var tears = 1 + ri(rng, 3);
    for (var t = 0; t < tears; t++) {
      var y0 = ri(rng, 14), h = 1 + ri(rng, 4), k = 1 + ri(rng, 6);
      for (y = y0; y < Math.min(16, y0 + h); y++) {
        var r = g[y].slice();
        for (x = 0; x < 16; x++) g[y][x] = r[(x + k) % 16];
      }
    }
    // block swap
    if (rng() < 0.7) {
      var bx = ri(rng, 8), by = ri(rng, 8), cx = ri(rng, 8) + 8, cy = ri(rng, 8);
      for (y = 0; y < 6; y++) for (x = 0; x < 6; x++) {
        var ay = (by + y) % 16, ax = (bx + x) % 16, ey = (cy + y) % 16, ex = (cx + x) % 16;
        var tmp = g[ay][ax]; g[ay][ax] = g[ey][ex]; g[ey][ex] = tmp;
      }
    }
    // MISSINGNO.-style staircase of noise in one corner
    var stairs = rng() < 0.6;
    if (stairs) {
      var sx = rng() < 0.5 ? 9 : 1;
      for (y = 6; y < 15; y++) for (x = sx; x < sx + 6; x++) if (x - sx <= y - 6 + 1) g[y][x] = '123'[ri(rng, 3)];
    }
    // pixel noise
    var n = 10 + ri(rng, 25);
    for (var i = 0; i < n; i++) g[ri(rng, 16)][ri(rng, 16)] = '.123'[ri(rng, 4)];
    return g.map(function (row) { return row.join(''); });
  }

  function makeEntry(rng) {
    var D = TG.data.glitch || {};
    var a = D.entryBits || ['It is made of'], b = D.entryEnds || ['nothing.'];
    return a[ri(rng, a.length)] + ' ' + b[ri(rng, b.length)];
  }

  function generate(seed) {
    var D = TG.data.glitch || {};
    var total = D.total || 32;
    var types = D.types || ['Normal', 'Bird', '???'];
    var rng = mulberry32(seed);
    var pool = (TG.data.pokemon || []).filter(function (p) { return p && p.id >= 1 && p.id <= 151; });
    var out = [], used = {};
    (D.fixed || []).forEach(function (f) {
      var sp = {
        id: f.id, no: f.no, name: f.name, types: f.types.slice(), family: null, stage: 1, evolvesTo: null, candyToEvolve: null,
        rarity: 5, catchRate: f.catchRate, baseValue: f.baseValue, entry: f.entry, legendary: false, glitch: true, fixed: true
      };
      var subSeed = (rng() * 4294967296) >>> 0;
      if (f.sprite) sp.sprite = f.sprite;
      else { sp.grid = scrambleGrid(TG.sprites[f.base] || null, subSeed); sp.sprite = f.id; }
      used[sp.name] = 1;
      out.push(sp);
    });
    var no = out.length ? out[out.length - 1].no + 1 : 152;
    var guard = 0;
    while (out.length < total && guard++ < 500) {
      var src = pool.length ? pool[ri(rng, pool.length)] : { id: 0, name: 'MISSINGNO' };
      var other = pool.length ? pool[ri(rng, pool.length)].name : 'PkMn';
      var name = corruptName(src.name, rng, other);
      var tcount = rng() < 0.5 ? 1 : 2;
      var tt = [];
      while (tt.length < tcount) { var ty = types[ri(rng, types.length)]; if (tt.indexOf(ty) < 0) tt.push(ty); }
      var subSeed2 = (rng() * 4294967296) >>> 0;
      var entry = makeEntry(rng);
      if (used[name]) continue;
      used[name] = 1;
      var i = out.length;
      out.push({
        id: 'g' + no, no: no, name: name, types: tt, family: null, stage: 1, evolvesTo: null, candyToEvolve: null,
        rarity: 5, catchRate: 0.15, baseValue: 1e6 * (1 + i * 0.25), entry: entry, legendary: false, glitch: true,
        src: src.id, srcName: src.name, gridSeed: subSeed2, sprite: 'g' + no
      });
      no++;
    }
    // sprites: generated grids are registered as TG.sprites[<id>] so encounter/dex rendering just works
    out.forEach(function (sp) {
      if (sp.fixed && sp.grid) TG.sprites[sp.id] = sp.grid;
      else if (!sp.fixed) { sp.grid = scrambleGrid(TG.sprites[sp.src] || null, sp.gridSeed); TG.sprites[sp.id] = sp.grid; }
    });
    return out;
  }

  function ensureGenerated() {
    var seed = S.prestige.seed;
    if (genSeed === seed && list.length) return;
    genSeed = seed;
    list = generate(seed);
    byId = {};
    list.forEach(function (sp, i) { sp.index = i; byId[sp.id] = sp; });
    // Glitch City: glitch dex encounters, cheaper entries more common
    var gc = (TG.data.routes || []).find(function (r) { return r.special === 'glitch_city'; });
    if (gc) gc.encounters = list.map(function (sp, i) { return { id: sp.id, weight: Math.round(100 / Math.pow(1 + i, 0.6)) }; });
    if (TG.spriteCacheClear) TG.spriteCacheClear();
    dirty.glitch = true;
    if (refs.grid) refs.grid._built = false;
  }

  // ------------------------------------------------------------ state
  function ensureState() {
    S = TG.state;
    if (!S) return;
    S.gb = num(S.gb, 0);
    S.instability = clamp(num(S.instability, 0), 0, 100);
    S.gbLifetime = num(S.gbLifetime, 0);
    if (!S.glitchDex || typeof S.glitchDex !== 'object') S.glitchDex = {};
    if (!S.glitch || typeof S.glitch !== 'object') S.glitch = {};
    var g = S.glitch;
    g.nextWhisperAt = num(g.nextWhisperAt, 0);
    g.nextHintAt = num(g.nextHintAt, 0);
    g.crashes = num(g.crashes, 0);
    g.wild = num(g.wild, 0);
    if (!S.prestige || typeof S.prestige !== 'object') S.prestige = { count: 0, rareCandy: 0 };
    if (!S.prestige.seed) S.prestige.seed = (Math.random() * 2147483646 + 1) | 0;
    if (!S.prestige.glitchEver || typeof S.prestige.glitchEver !== 'object') S.prestige.glitchEver = {};
    if (!Array.isArray(S.prodOrder)) {
      // best guess for older saves: data order of owned normal producers
      S.prodOrder = (TG.data.producers || []).filter(function (p) { return (num(p.act, 1) < 3) && (S.producers[p.id] || 0) > 0; }).map(function (p) { return p.id; });
    }
    for (var id in S.glitchDex) if (S.glitchDex[id]) S.prestige.glitchEver[id] = 1;
    // a save that crossed the door before this system existed
    if (S.flags.glitch) { if (S.act < 3) S.act = 3; if (S.tabs && !S.tabs.glitch) S.tabs.glitch = true; }
  }

  // ------------------------------------------------------------ public helpers
  function dexCount() { var n = 0; for (var k in S.glitchDex) if (S.glitchDex[k] && byId[k]) n++; return n; }
  function everCount() { var n = 0; for (var i = 0; i < list.length; i++) if (S.prestige.glitchEver[list[i].id]) n++; return n; }
  function registerCost() { return DEX_BASE_COST * Math.pow(DEX_COST_MULT, Math.max(0, dexCount() - 1)); }

  function addInstability(v) {
    if (!S || !(v > 0)) return;
    S.instability = clamp(S.instability + v, 0, 100);
  }

  function register(id) {
    var sp = byId[id];
    if (!sp || !S.flags.glitch || S.glitchDex[id]) return false;
    var cost = { gb: registerCost() };
    if (!TG.spend(cost)) { sfx('error'); return false; }
    S.glitchDex[id] = 1;
    S.prestige.glitchEver[id] = 1;
    addInstability(DEX_INSTABILITY);
    TG.log('#' + sp.no + ' ' + sp.name + ' was registered in the GLITCH DEX.', 'glitch');
    sfx('glitch');
    dirty.glitch = true; dirty.hof = true;
    TG.recompute();
    TG.emit('glitchdex', { id: id });
    return true;
  }

  // ------------------------------------------------------------ the door (coast)
  function hasMissingno() { return S.encounters.some(function (e) { return e.id === 'missingno'; }); }
  function onCoast() { var r = TG.route(S.currentRoute); return !!(r && r.special === 'coast'); }

  function checkDoor(entering) {
    if (!S || S.flags.glitch || !onCoast()) return;
    if (!(S.flags.surf && S.flags.champion)) return;
    if (!S.flags.oldman) {
      if (entering) S.glitch.nextHintAt = now() + 8000;
      return;
    }
    if (hasMissingno()) return;
    doorPending = true;
    TG.spawnEncounter({ force: true });
    doorPending = false;
  }

  function missingnoEnc(uid) { return { uid: uid, id: 'missingno', shiny: false, misses: 0, catchRate: 0.3, noFlee: true }; }

  function spawnHook(enc, route) {
    if (!route) return undefined;
    if (route.special === 'coast' && !S.flags.glitch && S.flags.oldman && S.flags.surf && S.flags.champion && (doorPending || !hasMissingno())) {
      doorPending = false;
      if (S.instability < 12) S.instability = 12;
      TG.fire('glitch_first');
      sfx('glitch');
      return missingnoEnc(enc.uid);
    }
    if (route.special === 'coast' && S.flags.glitch && Math.random() < 0.03) return missingnoEnc(enc.uid);
    return undefined;
  }

  // the "6th item" duplication
  function sixthProducer() {
    var normal = function (id) { var p = TG.producer(id); return p && num(p.act, 1) < 3 && TG.producerCurrency(id) !== 'gb'; };
    var order = (S.prodOrder || []).filter(function (id) { return normal(id) && (S.producers[id] || 0) > 0; });
    if (order.length >= 6) return order[5];
    var owned = (TG.data.producers || []).filter(function (p) { return normal(p.id) && (S.producers[p.id] || 0) > 0; }).map(function (p) { return p.id; });
    if (owned.length >= 6) return owned[5];
    return order[order.length - 1] || owned[owned.length - 1] || null;
  }

  function enterAct3() {
    if (S.flags.glitch) return;
    var id = sixthProducer(), dup = null;
    if (id) {
      var from = S.producers[id] || 0;
      var to = Math.min(DUP_CAP, Math.max(from, from * DUP_FACTOR));
      S.producers[id] = to;
      dup = { id: id, from: from, to: to };
      S.glitch.dup = dup;
    }
    TG.setFlag('glitch');
    S.gb += MISSINGNO_GB;
    S.gbLifetime += MISSINGNO_GB;
    S.glitchDex.missingno = 1;
    S.prestige.glitchEver.missingno = 1;
    S.instability = Math.max(S.instability, 25);
    TG.fire('missingno_caught');
    if (S.act < 3) TG.setAct(3);
    TG.unlockTab('glitch');
    TG.invalidate();
    TG.recompute();
    syncPalette();
    sfx('glitch');
    dirty.glitch = true; dirty.hof = true;
    TG.emit('glitch', { type: 'act3', dup: dup });
    TG.save();
    if (TG.ui && TG.ui.modal) {
      var p = dup && TG.producer(dup.id);
      var lines = ['The 6th item in your bag has been duplicated ×' + DUP_FACTOR + '.'];
      if (p) lines.push(p.name.toUpperCase() + ' ×' + TG.fmtInt(dup.from) + ' → ×' + TG.fmtInt(dup.to));
      lines.push('▓' + MISSINGNO_GB + ' GLITCH BYTES leaked into your bag.');
      setTimeout(function () { TG.ui.modal({ title: 'MISSINGNO. was caught!', lines: lines, buttons: [{ label: 'OK', primary: true }] }); }, 300);
    }
  }

  function onCatch(e) {
    var enc = e && e.enc;
    if (!enc) return;
    if (enc.id === 'missingno' && !S.flags.glitch) { enterAct3(); return; }
    if (!byId[enc.id] || !S.flags.glitch) return;
    // a glitch encounter caught in the wild: ▓ burst
    var w = Math.max(1, num(e.weight, 1));
    var per = 5 + TG.rates.gb * 2;
    var gain = Math.min(per * w, 5 * w + TG.rates.gb * 120);
    S.gb += gain;
    S.gbLifetime += gain;
    S.glitch.wild += w;
    addInstability(Math.min(5, w));
    if (!e.silent && TG.ui && TG.ui.floatText) TG.ui.floatText(50, 18, '+▓' + fmt(gain), 'catch');
    dirty.glitch = true;
  }

  function onBuy(e) {
    if (!e) return;
    if (e.kind === 'producer') {
      if (S.prodOrder.indexOf(e.id) < 0) S.prodOrder.push(e.id);
      if (TG.producerCurrency(e.id) === 'gb') { addInstability(Math.min(6, 0.5 * num(e.n, 1))); dirty.glitch = true; }
    } else if (e.kind === 'upgrade') {
      var u = TG.upgrade(e.id);
      if (u && u.glitch) { addInstability(num(u.instability, 0)); dirty.glitch = true; sfx('glitch'); }
    }
  }

  // ------------------------------------------------------------ palette & body classes
  function syncPalette() {
    var b = document.body;
    if (!b || !S) return;
    var want = S.flags.glitch ? 'glitch' : null;
    var changed = false;
    if (want) {
      if (b.dataset.paletteLock !== '1') { b.dataset.paletteLock = '1'; changed = true; }
      if (b.dataset.palette !== want) { b.dataset.palette = want; changed = true; }
    } else if (b.dataset.paletteLock) {
      delete b.dataset.paletteLock;
      b.dataset.palette = (S.settings && S.settings.palette) || 'rse';
      changed = true;
    }
    if (changed && TG.ui && TG.ui.repaint) TG.ui.repaint();
    if (changed && refs.grid && refs.grid._cells) refs.grid._cells.forEach(function (c) { c._k = null; });
  }

  function level() {
    var v = S ? S.instability : 0;
    return v >= 75 ? 3 : v >= 40 ? 2 : v >= 10 ? 1 : 0;
  }
  function syncBodyLevel() {
    var lv = level();
    if (lv === lastLevel) return;
    lastLevel = lv;
    var b = document.body;
    if (!b) return;
    for (var i = 1; i <= 3; i++) setClass(b, 'glitch-' + i, lv === i);
  }

  // ------------------------------------------------------------ crash
  var SCRAMBLE = '▓▒░█▄▀■□◘◙§¶#%&@?!ÿÐÞЖЯ¤0123456789ABCDEF';
  function scrambleScreen(rows, cols) {
    var out = [];
    for (var y = 0; y < rows; y++) {
      var s = '';
      for (var x = 0; x < cols; x++) s += Math.random() < 0.18 ? ' ' : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
      out.push(s);
    }
    return out.join('\n');
  }
  function crash() {
    if (crashing || !S) return;
    crashing = true;
    var lost = S.rd * CRASH_LOSS;
    S.rd = Math.max(0, S.rd - lost);
    S.instability = 50;
    S.glitch.crashes++;
    TG.fire('instability_crash');
    TG.log('▓▓ CRASH ▓▓  ' + fmt(lost) + ' RD was lost in the noise.', 'glitch');
    sfx('glitch');
    TG.emit('glitch', { type: 'crash', lost: lost });
    var b = document.body;
    if (!b) { crashing = false; return; }
    var ov = el('div', 'crash-ov');
    ov.setAttribute('role', 'alert');
    var pre = el('pre', 'crash-noise');
    var msg = el('div', 'crash-msg', 'FATAL ERROR AT 0x' + ((Math.random() * 0xFFFF) | 0).toString(16).toUpperCase().padStart(4, '0'));
    ov.appendChild(pre); ov.appendChild(msg);
    var cols = Math.max(20, Math.ceil(window.innerWidth / 9)), rows = Math.max(20, Math.ceil(window.innerHeight / 15));
    pre.textContent = scrambleScreen(rows, cols);
    b.appendChild(ov);
    var rm = reduceMotion();
    if (!rm) setClass(b, 'crash', true);
    // re-scramble at 2.5 Hz max (photosensitivity: never faster than 3 Hz); static when reduced motion
    var iv = rm ? 0 : setInterval(function () { pre.textContent = scrambleScreen(rows, cols); }, 400);
    setTimeout(function () {
      clearInterval(iv);
      ov.remove();
      setClass(b, 'crash', false);
      crashing = false;
    }, CRASH_MS);
  }

  // ------------------------------------------------------------ tick
  function onTick(dt) {
    if (S !== TG.state) ensureState();
    if (!S) return;
    dt = num(dt, 0.1);
    if (TG.rates.gb > 0) S.gbLifetime += TG.rates.gb * dt;
    var pre = !S.flags.glitch && hasMissingno();
    if (S.flags.glitch || pre) {
      if (pre) {
        // before the catch: light corruption, held between ~9 and 15
        var target = 12 + 3 * Math.sin(now() / 4000);
        S.instability = clamp(target, 5, 15);
      } else if (S.instability >= 100) {
        // check before decaying: purchases clamp instability to exactly 100, and decaying first
        // pulled it back under 100 in the same tick, so the crash could never fire
        if (!crashing) crash();
      } else {
        var decay = BASE_DECAY + num(TG.effects && TG.effects.instabilityDecay, 0);
        var r = TG.route(S.currentRoute);
        var rise = r && r.special === 'glitch_city' ? CITY_RISE : 0;
        S.instability = clamp(S.instability + (rise - decay) * dt, 0, 100);
      }
    } else if (S.instability > 0 && !S.flags.glitch) {
      S.instability = Math.max(0, S.instability - BASE_DECAY * 5 * dt);
    }
    syncBodyLevel();
    var t = now();
    if (t - lastSlow >= 1000) { lastSlow = t; perSecond(t); }
    if (t - lastUi >= 200) { lastUi = t; uiTick(); }
  }

  function perSecond(t) {
    var g = S.glitch;
    if (S.flags.glitch) {
      if (!g.nextWhisperAt) g.nextWhisperAt = t + 60000;
      if (t >= g.nextWhisperAt) {
        g.nextWhisperAt = t + (WHISPER_MIN + Math.random() * (WHISPER_MAX - WHISPER_MIN)) * 1000;
        var wl = (TG.data.story && TG.data.story.glitch_whisper) || [];
        var line = wl[(Math.random() * wl.length) | 0];
        if (line) TG.log(corrupt(line, 0.08), 'glitch');
      }
    } else if (onCoast() && S.flags.champion && S.flags.surf && !S.flags.oldman) {
      if (g.nextHintAt && t >= g.nextHintAt) {
        g.nextHintAt = t + (HINT_MIN + Math.random() * (HINT_MAX - HINT_MIN)) * 1000;
        TG.log('The waves keep breaking on the same tile. The OLD MAN in VIRIDIAN said something about this coast...', 'sys');
      } else if (!g.nextHintAt) g.nextHintAt = t + 20000;
    }
  }

  function onOffline(sum) {
    if (!sum || !S) return;
    if (sum.gb > 0) S.gbLifetime += sum.gb;
    if (S.flags.glitch && sum.effective > 0) {
      var decay = BASE_DECAY + num(TG.effects && TG.effects.instabilityDecay, 0);
      S.instability = clamp(S.instability - decay * sum.effective, 0, 99);
    }
  }

  // ------------------------------------------------------------ header ▓
  function buildHeader() {
    var stats = document.querySelector('.hdr-stats');
    if (!stats || document.getElementById('hdr-gb')) { refs.hdrGb = document.getElementById('hdr-gb'); return; }
    refs.hdrGb = el('div', 'hdr-gb');
    refs.hdrGb.id = 'hdr-gb';
    refs.hdrGb.hidden = true;
    stats.appendChild(refs.hdrGb);
  }
  function updateHeader() {
    if (!refs.hdrGb) return;
    var show = !!S.flags.glitch;
    setHidden(refs.hdrGb, !show);
    if (show) setText(refs.hdrGb, '▓' + fmt(S.gb) + (TG.rates.gb > 0 ? '  +' + fmt(TG.rates.gb) + '/s' : ''));
  }

  // ------------------------------------------------------------ Glitch tab
  function buyAmt() { return (S.settings && S.settings.buyAmt) || 1; }

  function buildTab() {
    var sec = document.getElementById('tab-glitch');
    if (!sec) return false;
    if (refs.sec === sec && sec.firstChild) return true;
    refs.sec = sec;
    sec.innerHTML =
      '<div class="box gl-head">' +
      '  <h2>▓ GLITCH BYTES</h2>' +
      '  <div class="gl-big" id="gl-gb">0</div>' +
      '  <div class="gl-sub"><span id="gl-rate">0/s</span> · <span id="gl-life"></span></div>' +
      '  <div class="gl-inst"><span>INSTABILITY</span><div class="bar inst"><i id="gl-inst-fill"></i></div><b id="gl-inst-v">0%</b></div>' +
      '  <p class="dim gl-note" id="gl-inst-note"></p>' +
      '  <p class="gl-note" id="gl-mult"></p>' +
      '  <div id="gl-pull" class="gl-pull" hidden><p class="dim">The cartridge is loose in its slot. You could pull it now — but only half the RARE CANDY would survive.</p>' +
      '    <button class="btn danger" type="button" id="gl-pull-btn">PULL THE CARTRIDGE</button></div>' +
      '</div>' +
      '<div class="box"><div class="row"><h2>CORRUPTED</h2><span class="spacer"></span>' +
      '  <div class="buyamt" id="gl-amt"><button class="btn small" type="button" data-amt="1">×1</button><button class="btn small" type="button" data-amt="10">×10</button><button class="btn small" type="button" data-amt="max">MAX</button></div></div>' +
      '  <div id="gl-prods"></div></div>' +
      '<div class="box"><h2>GLITCH UPGRADES</h2><div class="upgrades" id="gl-upgs"></div></div>' +
      '<div class="box"><div class="dex-head"><h2>GLITCH DEX</h2><span>REGISTERED <b id="gl-dex-n">0</b>/<span id="gl-dex-t">32</span></span><span>NEXT <b id="gl-dex-cost"></b></span><span>RD <b id="gl-dex-bonus"></b></span></div>' +
      '  <div class="box dex-detail gl-detail" id="gl-detail" hidden></div>' +
      '  <div class="dex-grid gl-grid" id="gl-grid"></div></div>';
    ['gb', 'rate', 'life', 'inst-fill', 'inst-v', 'inst-note', 'mult', 'pull', 'pull-btn', 'amt', 'prods', 'upgs', 'dex-n', 'dex-t', 'dex-cost', 'dex-bonus', 'detail', 'grid'].forEach(function (k) {
      refs[k.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = document.getElementById('gl-' + k);
    });
    refs.amt.addEventListener('click', function (e) {
      var b = e.target.closest('[data-amt]');
      if (!b) return;
      S.settings.buyAmt = b.dataset.amt === 'max' ? 'max' : Number(b.dataset.amt);
      syncAmt();
      updateTab();
    });
    refs.pullBtn.addEventListener('click', function () {
      var sr = TG.systems.sram;
      if (sr && sr.pullCartridge) sr.pullCartridge();
    });
    refs.grid.addEventListener('click', function (e) {
      var c = e.target.closest('.dex-cell');
      if (c && c._gid) selectDex(c._gid);
    });
    refs.grid._built = false;
    return true;
  }

  function syncAmt() {
    var amt = String(buyAmt());
    refs.amt.querySelectorAll('[data-amt]').forEach(function (b) { setClass(b, 'on', b.dataset.amt === amt); });
  }

  var prodRows = [], upgRows = [], selected = null;

  function prodInfo(p) {
    var o = TG.producerOutput(p.id);
    var parts = [];
    if (o.gb) parts.push('+▓' + fmt(o.gb) + '/s');
    if (o.rd) parts.push('+' + fmt(o.rd) + ' RD/s');
    if (o.balls) parts.push('+' + fmt(o.balls) + ' balls/s');
    return parts.join(' · ') + ' each';
  }

  function renderTab() {
    if (!buildTab()) return;
    dirty.glitch = false;
    syncAmt();
    // corrupted producers
    refs.prods.innerHTML = '';
    prodRows = [];
    var prods = (TG.data.producers || []).filter(function (p) { return TG.producerCurrency(p.id) === 'gb' && TG.producerVisible(p); });
    prods.forEach(function (p) {
      var btn = el('button', 'btn'); btn.type = 'button';
      var lbl = el('span', null, 'BUY'), cost = el('small', null, '');
      btn.appendChild(lbl); btn.appendChild(cost);
      var own = el('span', 'own', '');
      var nm = el('div'); nm.appendChild(el('span', 'nm', p.name)); nm.appendChild(own);
      var info = el('div', 'info', '');
      var row = el('div', 'prod');
      row.appendChild(nm); row.appendChild(btn); row.appendChild(info);
      row.appendChild(el('div', 'flav', p.flavor ? '"' + p.flavor + '"' : (p.desc || '')));
      btn.addEventListener('click', function () {
        var a = buyAmt();
        if (!TG.buyProducer(p.id, a === 'max' ? 'max' : a)) { if (TG.ui) TG.ui.toast('Not enough Glitch Bytes.'); sfx('error'); }
      });
      refs.prods.appendChild(row);
      prodRows.push({ p: p, btn: btn, lbl: lbl, cost: cost, own: own, info: info });
    });
    if (!prods.length) refs.prods.appendChild(el('p', 'empty', 'Nothing here is quite real yet.'));
    // glitch upgrades
    refs.upgs.innerHTML = '';
    upgRows = [];
    var ups = (TG.data.upgrades || []).filter(function (u) { return u.glitch && TG.upgradeAvailable(u); })
      .sort(function (a, b) { return TG.costParts(a.cost).gb - TG.costParts(b.cost).gb; });
    ups.forEach(function (u) {
      var b = el('button', 'btn upg'); b.type = 'button'; b.title = u.flavor || '';
      b.appendChild(el('span', 'nm', u.name));
      b.appendChild(el('span', 'desc', u.desc || ''));
      if (u.flavor) b.appendChild(el('span', 'flav dim', u.flavor));
      if (u.instability) b.appendChild(el('span', 'desc gl-inst-cost', '+' + u.instability + ' instability'));
      b.appendChild(el('span', 'cost', '▓' + fmt(TG.costParts(u.cost).gb)));
      b.addEventListener('click', function () {
        if (TG.buyUpgrade(u.id)) { if (TG.ui) TG.ui.toast(u.name + '!'); }
        else { if (TG.ui) TG.ui.toast('Not enough Glitch Bytes.'); sfx('error'); }
      });
      refs.upgs.appendChild(b);
      upgRows.push({ u: u, b: b });
    });
    if (!ups.length) refs.upgs.appendChild(el('p', 'empty', 'No glitch upgrades available right now.'));
    renderGrid();
    if (selected) renderDetail();
    updateTab();
  }

  function cellKey(sp) {
    var reg = !!S.glitchDex[sp.id];
    var seen = reg || !!(S.dex[sp.id] && S.dex[sp.id].seen) || !!S.prestige.glitchEver[sp.id] || sp.fixed;
    return (reg ? 'r' : seen ? 's' : 'u') + (S.prestige.glitchEver[sp.id] ? 'e' : '');
  }

  function renderGrid() {
    var grid = refs.grid;
    if (!grid._built) {
      grid.innerHTML = '';
      grid._cells = list.map(function (sp) {
        var c = el('button', 'dex-cell gl-cell');
        c.type = 'button';
        c._gid = sp.id;
        c.appendChild(el('span', 'no', String(sp.no)));
        var cv = document.createElement('canvas');
        cv.width = 32; cv.height = 32;
        c.appendChild(cv);
        c._cv = cv;
        grid.appendChild(c);
        return c;
      });
      grid._built = true;
    }
    grid._cells.forEach(function (c, i) {
      var sp = list[i];
      var k = cellKey(sp);
      if (c._k === k) return;
      c._k = k;
      var pal = k[0] === 'r' ? 'dmg' : 'silhouette';
      TG.drawSprite(c._cv, sp.sprite || sp.id, { scale: 2, palette: pal });
      c._cv.style.opacity = k[0] === 'u' ? '.3' : '';
      setClass(c, 'caught', k[0] === 'r');
      setClass(c, 'ever', k.indexOf('e') > 0 && k[0] !== 'r');
      c.setAttribute('aria-label', '#' + sp.no + ' ' + (k[0] === 'u' ? 'unknown' : sp.name));
    });
  }

  function selectDex(id) {
    if (selected === id) { selected = null; setHidden(refs.detail, true); return; }
    selected = id;
    renderDetail();
    setHidden(refs.detail, false);
    refs.detail.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  function renderDetail() {
    var sp = byId[selected];
    var box = refs.detail;
    if (!sp || !box) return;
    box.innerHTML = '';
    var reg = !!S.glitchDex[sp.id];
    var k = cellKey(sp);
    var known = k[0] !== 'u';
    var cv = document.createElement('canvas');
    TG.drawSprite(cv, sp.sprite || sp.id, { scale: 6, palette: reg ? 'dmg' : 'silhouette' });
    if (!known) cv.style.opacity = '.3';
    var info = el('div');
    info.appendChild(el('div', 'nm', '#' + sp.no + ' ' + (known ? sp.name : '??????????')));
    if (reg) {
      var ty = el('div', 'types');
      sp.types.forEach(function (t) { ty.appendChild(el('span', 'type', t)); });
      info.appendChild(ty);
    }
    info.appendChild(el('p', 'entry', reg ? corrupt(sp.entry, 0.05) : known ? 'Spotted between the tiles. Register it to read more.' : 'No data. Something is here anyway.'));
    var wild = S.dex[sp.id] && S.dex[sp.id].caught;
    if (wild) info.appendChild(el('div', null, 'Caught in GLITCH CITY: ' + TG.fmtInt(wild)));
    if (!reg && S.prestige.glitchEver[sp.id]) info.appendChild(el('div', 'dim', 'You registered this one in another save file.'));
    box.appendChild(cv);
    box.appendChild(info);
    var actions = el('div', 'actions');
    if (!reg) {
      var b = el('button', 'btn primary');
      b.type = 'button';
      b.appendChild(el('span', null, 'REGISTER'));
      refs.regCost = el('small', null, '');
      b.appendChild(refs.regCost);
      b.addEventListener('click', function () { if (register(sp.id)) { if (TG.ui) TG.ui.toast(sp.name + ' registered.'); renderTab(); } else if (TG.ui) TG.ui.toast('Not enough Glitch Bytes.'); });
      refs.regBtn = b;
      actions.appendChild(b);
    } else { refs.regBtn = null; actions.appendChild(el('span', 'dim', '+1% RD · registered')); }
    actions.appendChild(el('span', 'spacer'));
    var close = el('button', 'btn small', 'CLOSE'); close.type = 'button';
    close.addEventListener('click', function () { selectDex(sp.id); });
    actions.appendChild(close);
    box.appendChild(actions);
  }

  function updateTab() {
    if (!refs.gb) return;
    setText(refs.gb, '▓' + fmt(S.gb));
    setText(refs.rate, '+▓' + fmt(TG.rates.gb) + '/s');
    setText(refs.life, 'lifetime ▓' + fmt(S.gbLifetime));
    var pct = Math.round(S.instability);
    if (refs.instFill._w !== pct) { refs.instFill._w = pct; refs.instFill.style.width = pct + '%'; }
    setText(refs.instV, pct + '%');
    var decay = BASE_DECAY + num(TG.effects.instabilityDecay, 0);
    setText(refs.instNote, 'Decays ' + decay.toFixed(1) + '/s. At 100% the game crashes (−10% RD).' + (S.glitch.crashes ? ' Crashes: ' + S.glitch.crashes + '.' : ''));
    setText(refs.mult, 'Glitch Dex RD ×' + rdMult().toFixed(2) + ' · ▓ output ×' + fmt(TG.effects.glitchMult));
    var sr = TG.systems.sram;
    setHidden(refs.pull, !(sr && sr.canPullHalf && sr.canPullHalf()));
    var amt = buyAmt();
    prodRows.forEach(function (r) {
      var id = r.p.id;
      var n = amt === 'max' ? TG.maxAffordable(id) : amt;
      var cost = TG.producerCost(id, Math.max(1, n));
      var ok = (amt !== 'max' || n > 0) && TG.canAfford(cost);
      setText(r.own, '×' + TG.fmtInt(S.producers[id] || 0));
      setText(r.lbl, amt === 'max' ? 'BUY ×' + n : amt > 1 ? 'BUY ×' + amt : 'BUY');
      setText(r.cost, '▓' + fmt(TG.costParts(cost).gb));
      setClass(r.btn, 'no', !ok);
      setText(r.info, prodInfo(r.p));
    });
    upgRows.forEach(function (x) { setClass(x.b, 'no', !TG.canAfford(x.u.cost)); });
    var cnt = dexCount();
    setText(refs.dexN, String(cnt));
    setText(refs.dexT, String(list.length));
    var c = registerCost();
    setText(refs.dexCost, cnt >= list.length ? '—' : '▓' + fmt(c));
    setText(refs.dexBonus, '+' + Math.round(cnt * DEX_RD_BONUS * 100) + '%');
    if (refs.regBtn && refs.regCost && document.body.contains(refs.regBtn)) {
      setText(refs.regCost, '▓' + fmt(c));
      setClass(refs.regBtn, 'no', S.gb < c);
    }
  }

  function uiTick() {
    updateHeader();
    if (S.settings.tab !== 'glitch') return;
    if (dirty.glitch) renderTab();
    else { if (refs.grid && refs.grid._built) renderGrid(); updateTab(); }
  }

  // ------------------------------------------------------------ Hall of Fame (Lab tab)
  function buildHof() {
    var lab = document.getElementById('tab-lab');
    if (!lab) return;
    var box = document.getElementById('l-hof');
    if (!box) {
      box = el('div', 'box hof-box');
      box.id = 'l-hof';
      box.hidden = true;
      box.appendChild(el('h2', null, 'HALL OF FAME'));
      var ol = el('ol', 'hof');
      ol.id = 'l-hof-list';
      box.appendChild(ol);
      var logBox = document.getElementById('log-full');
      var anchor = logBox && logBox.closest('.box');
      if (anchor && anchor.nextSibling) lab.insertBefore(box, anchor.nextSibling);
      else lab.appendChild(box);
    }
    refs.hof = box;
    refs.hofList = box.querySelector('ol');
  }

  function renderHof() {
    if (!refs.hof) buildHof();
    if (!refs.hof) return;
    dirty.hof = false;
    var show = !!S.flags.champion;
    setHidden(refs.hof, !show);
    if (!show) return;
    var ol = refs.hofList;
    ol.innerHTML = '';
    var team = (TG.data.pokemon || []).filter(function (p) { return p && S.dex[p.id] && S.dex[p.id].caught; })
      .sort(function (a, b) { return num(b.baseValue) - num(a.baseValue); }).slice(0, 6);
    var n = 0;
    function row(no, text, cls) {
      var li = el('li', cls || '');
      li.appendChild(el('span', 'hof-no', no));
      li.appendChild(el('span', null, text));
      ol.appendChild(li);
    }
    row('', (S.name || 'RED') + ' — CHAMPION', 'hof-head');
    team.forEach(function (p) { n++; row('#' + pad3(n), p.name.toUpperCase() + '  (No.' + pad3(p.id) + ')'); });
    if (!team.length) row('#001', '—');
    if (S.flags.glitch) {
      var extra = ((TG.data.story && TG.data.story.hall_of_fame) || []).filter(function (l) { return /^#\d+/.test(l); });
      extra.slice(2).forEach(function (l) {
        n++;
        row('#' + pad3(n), corrupt(l.replace(/^#\d+\s*/, ''), 0.15), 'hof-glitch');
      });
      list.forEach(function (sp) {
        if (!S.glitchDex[sp.id]) return;
        n++;
        row('#' + sp.no, corrupt(sp.name + ' ??????????', 0.3), 'hof-glitch');
      });
    }
  }

  // ------------------------------------------------------------ load / init
  function onLoad() {
    ensureState();
    var reseeded = genSeed !== S.prestige.seed;
    ensureGenerated();
    crashing = false;
    lastLevel = -1;
    selected = null;
    if (refs.detail) setHidden(refs.detail, true);
    syncPalette();
    syncBodyLevel();
    dirty.glitch = true; dirty.hof = true;
    if (refs.grid) refs.grid._built = false;
    buildHeader();
    updateHeader();
    if (S.settings.tab === 'glitch') renderTab();
    if (S.settings.tab === 'lab') renderHof();
    // an imported save from another cartridge has a different seed: ui.js (which handles 'load'
    // first) drew its glitch encounters with the old names/sprites, so let it rebuild once
    if (reseeded && S.encounters.some(function (e) { return byId[e.id]; })) TG.emit('load', S);
  }

  function rdMult() {
    if (!S || !S.flags || !S.flags.glitch) return 1;
    var n = 0;
    for (var k in S.glitchDex) if (S.glitchDex[k]) n++;
    return 1 + DEX_RD_BONUS * n;
  }

  var sys = TG.systems.glitch = {
    init: function () {
      ensureState();
      ensureGenerated();
      TG.addSpawnHook(spawnHook);
      TG.on('route_enter', function () { checkDoor(true); });
      TG.on('catch', onCatch);
      TG.on('buy', function (e) { onBuy(e); dirty.hof = true; });
      TG.on('tick', onTick);
      TG.on('load', onLoad);
      TG.on('offline', onOffline);
      TG.on('flag', function () { dirty.glitch = true; dirty.hof = true; });
      TG.on('dex', function () { dirty.hof = true; });
      TG.on('act', function () { dirty.glitch = true; });
      TG.on('tabshow', function (name) {
        if (name === 'glitch') { if (dirty.glitch || !refs.gb) renderTab(); else updateTab(); }
        if (name === 'lab' && dirty.hof) renderHof();
      });
      buildHeader();
      buildHof();
      syncPalette();
      syncBodyLevel();
      updateHeader();
      if (S.settings.tab === 'glitch') renderTab();
      renderHof();
      checkDoor(false);
      TG.invalidate();
      // ui.js built the encounter sprites before this system could name/draw glitch species: rebuild once
      if (S.encounters.some(function (e) { return byId[e.id]; })) TG.emit('load', S);
    },
    species: function (id) { return byId[id] || null; },
    rdMult: rdMult,
    list: function () { return list.slice(); },
    total: function () { return list.length; },
    dexCount: function () { return S ? dexCount() : 0; },
    everCount: function () { return S ? everCount() : 0; },
    registerCost: registerCost,
    register: register,
    addInstability: addInstability,
    crash: crash,
    level: level,
    enterAct3: function () { if (S && !S.flags.glitch) enterAct3(); },
    checkDoor: checkDoor,
    syncPalette: syncPalette,
    markDirty: function () { dirty.glitch = true; dirty.hof = true; }
  };
})();
