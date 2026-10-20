/* TALL GRASS — systems/sram.js (late-game agent)
 * ACT 4 — THE CARTRIDGE, prestige and the ending.
 *  - Trigger: lifetime Glitch Bytes (state.gbLifetime) >= SRAM_GB -> story.sram_appear, act 4, SRAM tab.
 *  - Save Battery (state.battery 100 -> 0) drains in real time (~8 h online; offline time counts 50%).
 *    <=15%: story.battery_low + occasional screen flicker. 0: story.battery_dead, unskippable modal,
 *    then TG.prestige().
 *  - Prestige (TG.prestige -> TG.systems.sram.prestige): fresh state, keeps prestige/settings/stats/
 *    rdLifetime/name/dex-seen, flags gbc+prestiged. Rare Candy: 1.1^n on RD (engine) and on ▓ (here).
 *  - After the first prestige: "Pull the cartridge" (full candy in Act 4, half in Act 3), #000 dex entry,
 *    battery icons in the header. Ending: complete glitch dex (across saves) + 10 prestiges.
 *  - TG.dev: hidden test shortcuts (see bottom).
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.systems = TG.systems || {};

  var SRAM_GB = 1e7;              // lifetime ▓ to reach Act 4 (~2–4 h of Act 3 play)
  var BATTERY_HOURS = 8;          // online play time from 100% to 0%
  var DRAIN = 100 / (BATTERY_HOURS * 3600);
  var OFFLINE_DRAIN = 0.5;
  var LOW = 15;
  var HEX_BYTES = 256;
  var HEX_EVERY = 3000;

  var S = null;
  var refs = {};
  var dirty = true;
  var deathShown = false;
  var lastSlow = 0, lastUi = 0, lastHex = 0;
  var endingOpen = false;

  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : (d || 0); }
  function now() { return Date.now(); }
  function fmt(n) { return TG.fmt ? TG.fmt(n) : String(Math.floor(n)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function setText(e, s) { if (e && e._t !== s) { e._t = s; e.textContent = s; } }
  function setHidden(e, h) { h = !!h; if (e && e.hidden !== h) e.hidden = h; }
  function setClass(e, c, on) { on = !!on; if (e && e.classList.contains(c) !== on) e.classList.toggle(c, on); }
  function sfx(n) { if (TG.sfx) TG.sfx.play(n); }
  function story(k) { var s = (TG.data.story || {})[k]; return Array.isArray(s) ? s : []; }
  function glitchSys() { return TG.systems.glitch; }
  function reduceMotion() {
    return !!((S && S.settings && S.settings.reduceMotion) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  }

  // ------------------------------------------------------------ state
  function ensureState() {
    S = TG.state;
    if (!S) return;
    S.battery = Math.max(0, Math.min(100, num(S.battery, 100)));
    if (!S.sram || typeof S.sram !== 'object') S.sram = {};
    S.sram.lowFired = !!S.sram.lowFired;
    S.sram.startedAt = num(S.sram.startedAt, 0);
    if (!S.prestige || typeof S.prestige !== 'object') S.prestige = { count: 0, rareCandy: 0 };
    S.prestige.count = num(S.prestige.count, 0);
    S.prestige.rareCandy = num(S.prestige.rareCandy, 0);
    S.prestige.pulls = num(S.prestige.pulls, 0);
    if (S.flags.sram) { if (S.act < 4) S.act = 4; if (S.tabs && !S.tabs.sram) S.tabs.sram = true; }
  }

  // ------------------------------------------------------------ rare candy
  function rareCandyGain(mode) {
    if (!S) return 0;
    var base = Math.floor((Math.log10(Math.max(1, S.rdLifetime)) - 12) * 3);
    var act4 = S.flags.sram || S.act >= 4;
    base = act4 ? Math.max(1, base) : Math.max(0, base);
    var g = glitchSys();
    base += Math.floor((g && g.dexCount ? g.dexCount() : 0) / 5);
    if (mode === 'half') base = Math.max(1, Math.floor(base * 0.5));
    return base;
  }
  function candyMult(n) { return Math.pow(1.1, num(n, 0)); }

  function canPullFull() { return !!(S && S.prestige.count >= 1 && S.flags.sram); }
  function canPullHalf() { return !!(S && S.prestige.count >= 1 && S.flags.glitch && !S.flags.sram); }

  // ------------------------------------------------------------ prestige
  function prestige(mode) {
    S = TG.state;
    if (!mode) {
      if (S.flags.sram && S.battery <= 0) mode = 'battery';
      else if (canPullFull()) mode = 'full';
      else if (canPullHalf()) mode = 'half';
    }
    if (!mode || (mode === 'half' && !S.flags.glitch) || ((mode === 'full' || mode === 'battery') && !S.flags.sram)) {
      TG.log('Nothing happens.', 'sys');
      return false;
    }
    var gain = rareCandyGain(mode);
    var old = S;
    var fresh = TG.defaultState();
    var t = now();
    fresh.name = old.name;
    fresh.settings = JSON.parse(JSON.stringify(old.settings || {}));
    fresh.settings.tab = 'grass';
    fresh.stats = JSON.parse(JSON.stringify(old.stats || {}));
    fresh.rdLifetime = num(old.rdLifetime, 0);
    fresh.titleTaps = num(old.titleTaps, 0);
    fresh.prestige = JSON.parse(JSON.stringify(old.prestige));
    fresh.prestige.count = num(old.prestige.count, 0) + 1;
    fresh.prestige.rareCandy = num(old.prestige.rareCandy, 0) + gain;
    fresh.prestige.lastGain = gain;
    fresh.prestige.lastMode = mode;
    fresh.prestige.lastAt = t;
    if (mode !== 'battery') fresh.prestige.pulls = num(old.prestige.pulls, 0) + 1;
    fresh.flags.gbc = true;
    fresh.flags.prestiged = true;
    if (old.flags.ended || old.prestige.ended) fresh.flags.ended = true;
    // the POKéDEX remembers silhouettes
    for (var id = 1; id <= 151; id++) {
      var d = old.dex && old.dex[id];
      if (d && (d.seen || d.caught)) fresh.dex[id] = { caught: 0, shiny: 0, seen: true };
    }
    // Oak's intro already happened. Keep a few once-per-game story beats.
    fresh.storyShown.start = story('start').length;
    ['ending', 'dex_0', 'debug_menu'].forEach(function (k) { if (old.storyShown && old.storyShown[k]) fresh.storyShown[k] = old.storyShown[k]; });
    fresh.log = [{ t: t, text: '— SAVE FILE ' + fresh.prestige.count + ' —', cls: 'sys' }];
    fresh.lastSave = t; fresh.lastTick = t;
    deathShown = false;
    if (!TG.importSave(JSON.stringify(fresh))) { console.error('[TG] prestige failed'); return false; }
    S = TG.state;
    if (mode !== 'battery') TG.fire('pull_cartridge');
    TG.fire('prestige_done');
    TG.log('+' + gain + ' RARE CANDY survived in slot 6. (' + S.prestige.rareCandy + ' total, all production ×' + candyMult(S.prestige.rareCandy).toFixed(2) + ')', 'sys');
    sfx('evolve');
    TG.emit('prestige', { count: S.prestige.count, gain: gain, mode: mode });
    if (TG.ui) {
      TG.ui.showTab('grass');
      TG.ui.toast('+' + gain + ' RARE CANDY', 3000);
    }
    TG.save();
    return true;
  }

  function pullCartridge() {
    S = TG.state;
    var mode = canPullFull() ? 'full' : canPullHalf() ? 'half' : null;
    if (!mode) { if (TG.ui) TG.ui.toast('The cartridge will not budge.'); return false; }
    var gain = rareCandyGain(mode);
    var go = function () { prestige(mode); };
    if (!TG.ui) return go();
    TG.ui.modal({
      title: 'PULL THE CARTRIDGE?',
      lines: ['This save file will be destroyed. Everything resets except RARE CANDY, your name, your stats and what the POKéDEX remembers.',
        '+' + gain + ' RARE CANDY will survive' + (mode === 'half' ? ' (half: the SRAM has not woken up yet).' : '.')],
      buttons: [{ label: 'CANCEL' }, { label: 'PULL IT', primary: true, danger: true, onClick: go }]
    });
    return true;
  }

  // ------------------------------------------------------------ act 4 / battery
  function enterAct4() {
    TG.setFlag('sram');
    S.battery = 100;
    S.sram.startedAt = now();
    S.sram.lowFired = false;
    TG.fire('sram_appear');
    if (S.act < 4) TG.setAct(4);
    TG.unlockTab('sram');
    sfx('glitch');
    dirty = true;
    TG.emit('glitch', { type: 'act4' });
    TG.save();
  }

  function showDeath() {
    if (deathShown) return;
    deathShown = true;
    S.battery = 0;
    TG.fire('battery_dead');
    TG.save();
    sfx('glitch');
    var lines = story('battery_dead');
    if (!lines.length) lines = ['The internal battery has run dry.', 'SAVE FILE DESTROYED.'];
    if (!TG.ui || !TG.ui.modal) { prestige('battery'); return; }
    var gain = rareCandyGain('battery');
    TG.ui.modal({
      title: 'SAVE BATTERY',
      lines: lines.map(TG.fmtLine).concat(['', '+' + gain + ' RARE CANDY']),
      buttons: [{ label: 'CONTINUE', primary: true, onClick: function () { prestige('battery'); } }]
    });
  }

  function flicker() {
    var b = document.body;
    if (!b || reduceMotion()) return;
    setClass(b, 'bat-flicker', true);
    setTimeout(function () { setClass(b, 'bat-flicker', false); }, 700);
  }

  function onTick(dt) {
    if (S !== TG.state) ensureState();
    if (!S) return;
    if (S.flags.sram && S.battery > 0) S.battery = Math.max(0, S.battery - DRAIN * num(dt, 0.1));
    var t = now();
    if (t - lastSlow >= 1000) { lastSlow = t; perSecond(t); }
    if (t - lastUi >= 250) { lastUi = t; uiTick(t); }
  }

  function perSecond(t) {
    if (S.flags.glitch && !S.flags.sram && S.gbLifetime >= SRAM_GB) enterAct4();
    if (S.flags.sram) {
      if (S.battery <= LOW && !S.sram.lowFired) { S.sram.lowFired = true; TG.fire('battery_low'); }
      setClass(document.body, 'bat-low', S.battery <= LOW && S.battery > 0);
      if (S.battery <= LOW && S.battery > 0) {
        if (!S.sram.nextFlickerAt || t >= S.sram.nextFlickerAt) {
          var wasSet = !!S.sram.nextFlickerAt;
          S.sram.nextFlickerAt = t + (25 + Math.random() * 25) * 1000;
          if (wasSet) flicker();
        }
      }
      if (S.battery <= 0) showDeath();
    } else setClass(document.body, 'bat-low', false);
    checkEnding();
  }

  function onOffline(sum) {
    if (!sum || !S || !S.flags.sram || S.battery <= 0) return;
    var before = S.battery;
    S.battery = Math.max(0, S.battery - DRAIN * num(sum.seconds, 0) * OFFLINE_DRAIN);
    var lost = before - S.battery;
    if (lost >= 0.1 && Array.isArray(sum.lines)) sum.lines.push('The SAVE BATTERY drained ' + lost.toFixed(1) + '% (' + Math.floor(S.battery) + '% left).');
  }

  // ------------------------------------------------------------ ending
  function checkEnding() {
    if (endingOpen || S.prestige.ended) return;
    var g = glitchSys();
    if (!g || !g.total || !g.total()) return;
    if (S.prestige.count >= 10 && g.everCount() >= g.total()) playEnding();
  }

  function playEnding() {
    S.prestige.ended = true;
    TG.setFlag('ended');
    TG.fire('ending');
    TG.save();
    var ov = document.getElementById('credits');
    if (!ov) return;
    endingOpen = true;
    ov.innerHTML = '';
    ov.classList.add('ending');
    ov.classList.remove('static');
    var wrap = el('div', 'ending-text');
    var lines = story('ending');
    if (!lines.length) lines = ['The GAME BOY powers off.', "It's a bright, sunny day outside."];
    var nodes = lines.map(function (l) { var d = el('div', 'eln', TG.fmtLine(l) || ' '); wrap.appendChild(d); return d; });
    ov.appendChild(wrap);
    var skip = el('div', 'skip', 'TAP TO CONTINUE');
    skip.hidden = true;
    ov.appendChild(skip);
    var timers = [];
    var rm = reduceMotion();
    var startedAt = now();
    if (rm) { nodes.forEach(function (n) { n.classList.add('on'); }); skip.hidden = false; }
    else {
      nodes.forEach(function (n, i) { timers.push(setTimeout(function () { n.classList.add('on'); }, 1200 + i * 2800)); });
      timers.push(setTimeout(function () { skip.hidden = false; }, 1200 + nodes.length * 2800));
    }
    var close = function () {
      timers.forEach(clearTimeout);
      ov.hidden = true;
      ov.innerHTML = '';
      ov.classList.remove('ending');
      ov.onpointerdown = ov.onclick = null;
      endingOpen = false;
      TG.emit('credits_done');
    };
    // close on click (not pointerdown) so the tap can't fall through to the page underneath
    ov.onpointerdown = function (e) { e.preventDefault(); };
    ov.onclick = function () { if (now() - startedAt > 2500) close(); };
    ov.hidden = false;
    sfx('evolve');
  }

  // ------------------------------------------------------------ header battery icons
  function buildHeader() {
    var side = document.querySelector('.hdr-side');
    if (!side) return;
    refs.pbats = document.getElementById('hdr-pbats');
    if (!refs.pbats) {
      refs.pbats = el('div', 'pbats');
      refs.pbats.id = 'hdr-pbats';
      side.appendChild(refs.pbats);
    }
    renderHeader();
  }
  function renderHeader() {
    if (!refs.pbats || !S) return;
    var n = S.prestige.count;
    var sig = String(n);
    if (refs.pbats._sig === sig) return;
    refs.pbats._sig = sig;
    refs.pbats.innerHTML = '';
    refs.pbats.hidden = !n;
    refs.pbats.title = n + ' save file' + (n === 1 ? '' : 's') + ' lost';
    refs.pbats.setAttribute('aria-label', refs.pbats.title);
    for (var i = 0; i < Math.min(n, 10); i++) refs.pbats.appendChild(el('i', 'pbat'));
    if (n > 10) refs.pbats.appendChild(el('span', 'pbat-n', '+' + (n - 10)));
  }

  // ------------------------------------------------------------ Pokédex #000
  function buildDex0() {
    var grid = document.getElementById('d-grid');
    if (!grid) return;
    var c = document.getElementById('dex-000');
    if (!c) {
      c = el('button', 'dex-cell dex0');
      c.type = 'button';
      c.id = 'dex-000';
      c.setAttribute('aria-label', '#000 ???');
      c.appendChild(el('span', 'no', '000'));
      var cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      c.appendChild(cv);
      c._cv = cv;
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        TG.fire('dex_0');
        var lines = story('dex_0');
        if (TG.ui) TG.ui.modal({ title: '#000 ???', lines: lines.length ? lines.slice(1) : ['No data.'], buttons: [{ label: 'CLOSE', primary: true }] });
      });
      grid.insertBefore(c, grid.firstChild);
    }
    refs.dex0 = c;
    syncDex0();
  }
  function syncDex0() {
    if (!refs.dex0 || !S) return;
    var show = S.prestige.count >= 1;
    setHidden(refs.dex0, !show);
    if (show) TG.drawSprite(refs.dex0._cv, 'unknown', { scale: 2, palette: 'silhouette' });
  }

  // ------------------------------------------------------------ SRAM tab
  function buildTab() {
    var sec = document.getElementById('tab-sram');
    if (!sec) return false;
    if (refs.sec === sec && sec.firstChild) return true;
    refs.sec = sec;
    sec.innerHTML =
      '<div class="box sr-head">' +
      '  <canvas id="sr-cart" width="96" height="96"></canvas>' +
      '  <div class="sr-info"><h2>SRAM</h2>' +
      '    <p class="dim sr-sub">32 KB battery-backed save RAM. Bank 1, address 0xA000.</p>' +
      '    <div class="sr-bat"><canvas id="sr-bat-ico" width="32" height="32"></canvas><div class="bar battery"><i id="sr-bat-fill"></i></div><b id="sr-bat-v">100%</b></div>' +
      '    <p class="dim sr-sub" id="sr-bat-left"></p></div>' +
      '</div>' +
      '<div class="box"><h2>SAVE FILE</h2><pre class="hexdump" id="sr-hex" aria-label="Save file as hex bytes"></pre><p class="dim sr-sub" id="sr-hex-note"></p></div>' +
      '<div class="box sr-rc"><h2>RARE CANDY</h2>' +
      '  <p id="sr-rc-have"></p>' +
      '  <p>When the battery dies, <b id="sr-gain"></b> will survive in slot 6.</p>' +
      '  <p class="dim sr-sub" id="sr-gain-note"></p>' +
      '  <div id="sr-pull" hidden><button class="btn danger" type="button" id="sr-pull-btn">PULL THE CARTRIDGE</button>' +
      '    <p class="dim sr-sub">Reset now instead of waiting for the battery. All the candy survives.</p></div>' +
      '</div>';
    ['cart', 'bat-ico', 'bat-fill', 'bat-v', 'bat-left', 'hex', 'hex-note', 'rc-have', 'gain', 'gain-note', 'pull', 'pull-btn'].forEach(function (k) {
      refs[k.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = document.getElementById('sr-' + k);
    });
    refs.pullBtn.addEventListener('click', pullCartridge);
    return true;
  }

  function renderTab() {
    if (!buildTab()) return;
    dirty = false;
    TG.drawSprite(refs.cart, 'cartridge', { scale: 6 });
    TG.drawSprite(refs.batIco, 'battery', { scale: 2 });
    lastHex = 0;
    updateTab(now());
  }

  var HEXCH = '0123456789ABCDEF';
  function hex2(b) { return HEXCH[b >> 4] + HEXCH[b & 15]; }
  function renderHex() {
    var json = '';
    try { json = JSON.stringify(S); } catch (e) { json = '{}'; }
    var bytes;
    try { bytes = new TextEncoder().encode(json.slice(0, HEX_BYTES + 32)).slice(0, HEX_BYTES); }
    catch (e) { bytes = []; for (var j = 0; j < Math.min(HEX_BYTES, json.length); j++) bytes.push(json.charCodeAt(j) & 255); }
    var per = (refs.hex.clientWidth || 300) < 470 ? 8 : 16;
    var inst = num(S.instability, 0) / 100;
    var fade = 1 - S.battery / 100;
    var pBad = 0.01 + inst * 0.12;
    var pZero = fade * fade * 0.35;
    var out = [];
    for (var i = 0; i < bytes.length; i += per) {
      var hx = [], asc = '';
      for (var k = 0; k < per; k++) {
        var b = bytes[i + k];
        if (b === undefined) { hx.push('  '); continue; }
        var r = Math.random();
        if (r < pBad) { hx.push('▓▓'); asc += '▓'; continue; }
        if (r < pBad + pZero) { b = 0; }
        hx.push(hex2(b));
        asc += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
      }
      out.push((0xA000 + i).toString(16).toUpperCase() + '  ' + hx.join(' ') + '  ' + asc);
    }
    refs.hex.textContent = out.join('\n');
    setText(refs.hexNote, 'First ' + bytes.length + ' of ' + TG.fmtInt(json.length) + ' bytes. ' + (fade > 0.3 ? 'Some bytes no longer hold their charge.' : 'The bytes are warm.'));
  }

  function updateTab(t) {
    if (!refs.batFill) return;
    var pct = S.battery;
    var w = Math.round(pct * 10) / 10;
    if (refs.batFill._w !== w) { refs.batFill._w = w; refs.batFill.style.width = w + '%'; }
    setClass(refs.batFill.parentNode, 'low', pct <= LOW);
    setText(refs.batV, (pct >= 10 ? Math.ceil(pct) : pct.toFixed(1)) + '%');
    var left = pct / DRAIN;
    setText(refs.batLeft, pct > 0 ? '≈ ' + TG.fmtTime(left) + ' of play left · offline time drains at half speed' : 'The battery is empty.');
    var rc = S.prestige.rareCandy;
    setText(refs.rcHave, 'You have ' + TG.fmtInt(rc) + ' RARE CANDY: all production ×' + candyMult(rc).toFixed(2) + (S.prestige.count ? ' · save files lost: ' + S.prestige.count : '') + '.');
    var gain = rareCandyGain('full');
    setText(refs.gain, '+' + gain + ' RARE CANDY');
    var g = glitchSys();
    var gd = g && g.dexCount ? g.dexCount() : 0;
    setText(refs.gainNote, 'From ' + fmt(S.rdLifetime) + ' lifetime RD (log10 ' + Math.log10(Math.max(1, S.rdLifetime)).toFixed(2) + ') and ' + gd + ' GLITCH DEX entries (+1 per 5). Next total: ×' + candyMult(rc + gain).toFixed(2) + '.');
    setHidden(refs.pull, !canPullFull());
    if (!lastHex || t - lastHex >= HEX_EVERY) { lastHex = t; renderHex(); }
  }

  function uiTick(t) {
    renderHeader();
    if (S.settings.tab !== 'sram') return;
    if (dirty || !refs.batFill) renderTab();
    else updateTab(t);
  }

  // ------------------------------------------------------------ load / init
  function onLoad() {
    ensureState();
    deathShown = false;
    dirty = true;
    buildHeader();
    buildDex0();
    renderHeader();
    syncDex0();
    if (S.settings.tab === 'sram') renderTab();
  }

  TG.systems.sram = {
    init: function () {
      ensureState();
      // Rare Candy also boosts Glitch Byte output (RD already gets 1.1^n in the engine's mults.rareCandy)
      TG.addEffectSource(function (e) {
        var st = TG.state;
        if (st && st.prestige && st.prestige.rareCandy > 0) e.glitchMult *= candyMult(st.prestige.rareCandy);
      });
      TG.on('tick', onTick);
      TG.on('load', onLoad);
      TG.on('offline', onOffline);
      TG.on('flag', function () { dirty = true; });
      TG.on('tabshow', function (name) { if (name === 'sram') renderTab(); if (name === 'dex') syncDex0(); });
      buildHeader();
      buildDex0();
      if (S.settings.tab === 'sram') renderTab();
      TG.invalidate();
    },
    prestige: prestige,
    pullCartridge: pullCartridge,
    canPullFull: function () { S = TG.state; return canPullFull(); },
    canPullHalf: function () { S = TG.state; return canPullHalf(); },
    rareCandyGain: function (mode) { S = TG.state; return rareCandyGain(mode || 'full'); },
    playEnding: playEnding,
    config: { SRAM_GB: SRAM_GB, BATTERY_HOURS: BATTERY_HOURS, DRAIN: DRAIN }
  };

  // ------------------------------------------------------------ dev shortcuts (hidden; console only)
  function devChampion() {
    var st = TG.state;
    if (st.flags.champion) return st;
    (TG.data.gyms || []).forEach(function (g) { if (st.badgeIds.indexOf(g.id) < 0) st.badgeIds.push(g.id); });
    st.badges = 8; st.elite = 4; st.champion = true;
    ['mart', 'daycare', 'bike', 'cut', 'surf', 'fly', 'strength', 'lab_cinnabar', 'victory_road', 'champion', 'pokeflute'].forEach(function (f) { st.flags[f] = true; });
    (TG.data.routes || []).forEach(function (r) { if ((r.act || 1) <= 2) st.routes[r.id] = true; });
    st.routes.coast = true;
    st.prodOrder = [];
    (TG.data.producers || []).forEach(function (p) { if ((p.act || 1) < 3) { st.producers[p.id] = Math.max(st.producers[p.id] || 0, 40); st.prodOrder.push(p.id); } });
    (TG.data.pokemon || []).forEach(function (p) { if (p.id <= 140) st.dex[p.id] = { caught: 1, shiny: 0, seen: true }; });
    st.rd = Math.max(st.rd, 1e15); st.rdTotal = Math.max(st.rdTotal, 1e15); st.rdLifetime = Math.max(st.rdLifetime, 1e15);
    st.balls = Math.max(st.balls, 500);
    st.tabs.town = true; st.tabs.map = true;
    if (st.act < 2) st.act = 2;
    TG.invalidate(); TG.recompute();
    TG.emit('load', st);
    return st;
  }
  TG.dev = Object.assign(TG.dev || {}, {
    champion: devChampion,
    coast: function (oldman) {
      var st = devChampion();
      st.flags.oldman = oldman !== false;
      TG.setRoute('coast');
      return st.encounters.map(function (e) { return e.id; });
    },
    act3: function () {
      var st = TG.state;
      if (st.flags.glitch) return true;
      TG.dev.coast(true);
      var i = st.encounters.findIndex(function (e) { return e.id === 'missingno'; });
      if (i < 0) return false;
      var enc = st.encounters.splice(i, 1)[0];
      TG.registerCatch(enc, 1, false);
      if (TG.ui) TG.ui.refresh();
      return !!st.flags.glitch;
    },
    act4: function () {
      if (!TG.state.flags.glitch) TG.dev.act3();
      TG.state.gbLifetime = Math.max(TG.state.gbLifetime, SRAM_GB);
      perSecond(now());
      return TG.state.act;
    },
    battery: function (pct) { var st = TG.state; st.battery = Math.max(0, Math.min(100, +pct)); if (st.battery > LOW) st.sram.lowFired = false; return st.battery; },
    instability: function (v) { TG.state.instability = Math.max(0, Math.min(100, +v)); return TG.state.instability; },
    gb: function (n) { TG.state.gb += +n || 0; TG.state.gbLifetime += +n || 0; return TG.state.gb; },
    prestigeCount: function (n) { TG.state.prestige.count = +n || 0; return n; },
    glitchAll: function () {
      var g = glitchSys(); if (!g) return 0;
      g.list().forEach(function (sp) { TG.state.prestige.glitchEver[sp.id] = 1; });
      return g.everCount();
    },
    ending: function () { TG.dev.glitchAll(); TG.state.prestige.count = Math.max(10, TG.state.prestige.count); TG.state.prestige.ended = false; checkEnding(); }
  });
})();
