/* TALL GRASS — ui.js
 * All DOM rendering. Structural re-renders happen only on engine events
 * (buy / unlock / badge / flag / dex ...); the per-tick path only touches
 * cached text nodes, classes and bars.
 *
 * Public: TG.ui.init(), .showTab(name), .toast(text), .modal(opts), .confirm(text, fn),
 *         .corrupt(text, intensity?), .glitchIntensity(), .setPalette(p), .markDirty(...tabs),
 *         .refresh(), .playCredits(lines), .toggleDebug(), .floatText(xPct, yPct, text, cls),
 *         .setNameOverride(text|null)
 * Hooks for js/systems/gags.js: #g-gags strip under the grass, #t-shop box in Town, clicks on
 * [data-gag] elements inside the grass are not taps, events 'route_denied' {id, meets} and 'rename' {from, to}.
 */
(function () {
  'use strict';
  const TG = window.TG = window.TG || {};
  const UI = TG.ui = TG.ui || {};
  const S = () => TG.state;

  const TABS = ['grass', 'dex', 'town', 'map', 'lab', 'glitch', 'sram'];
  const TAB_LABELS = { grass: 'GRASS', dex: 'DEX', town: 'TOWN', map: 'MAP', lab: 'LAB', glitch: '▓▓▓', sram: 'SRAM' };
  const DEX_SIZE = 151;
  const MINI_LOG = 40, FULL_LOG = 100;
  const GLITCH_CHARS = '▓▒░█▄▀■□◘◙§¶#%&@?!ÿÐÞЖЯ¤';
  const GRASS_TILE = [
    '................',
    '..3.............',
    '.323..3.........',
    '.323.323........',
    '32223323........',
    '3222.223........',
    '................',
    '................',
    '................',
    '..........3.....',
    '.........323.3..',
    '.........32332..',
    '........3222323.',
    '........32222223',
    '................',
    '................'
  ];
  const SHELL = `
<div id="app">
  <header id="hdr" class="hdr">
    <button id="title" class="title" type="button" aria-label="Tall Grass">TALL GRASS</button>
    <div class="hdr-stats"><div class="hdr-rd"><span id="rd">0</span><small> RD</small></div><div class="hdr-rate" id="rdps">0/s</div></div>
    <div class="hdr-side"><div class="hdr-name" id="hdr-name">RED</div><div id="badges" class="badges" aria-label="Badges"></div></div>
  </header>
  <nav id="tabbar" class="tabbar" aria-label="Tabs">
    ${TABS.map(t => `<button class="tabbtn" type="button" data-tab="${t}"${['grass', 'dex', 'lab'].includes(t) ? '' : ' hidden'}>${TAB_LABELS[t]}</button>`).join('')}
  </nav>
  <main id="main">${TABS.map(t => `<section id="tab-${t}" class="tab"${t === 'grass' ? '' : ' hidden'}></section>`).join('')}</main>
</div>
<div id="modal" class="modal" hidden></div>
<div id="toast" class="toast" hidden></div>
<div id="credits" class="credits" hidden></div>
<div id="debug" class="debug" hidden></div>`;

  // ------------------------------------------------------------ helpers
  const $ = (sel, root) => (root || document).querySelector(sel);
  function h(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return e;
  }
  function setText(el, s) { if (el && el._t !== s) { el._t = s; el.textContent = s; } }
  function setClass(el, cls, on) { on = !!on; if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
  function setHidden(el, hid) { hid = !!hid; if (el && el.hidden !== hid) el.hidden = hid; }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtCost(cost) {
    const c = TG.costParts(cost);
    const out = [];
    if (c.rd || (!c.gb && !c.balls)) out.push(TG.fmt(c.rd) + ' RD');
    if (c.gb) out.push('▓' + TG.fmt(c.gb));
    if (c.balls) out.push(TG.fmt(c.balls) + ' balls');
    return out.join(' + ');
  }
  function costRD(cost) { return TG.costParts(cost).rd + TG.costParts(cost).gb * 1e6; }
  function pad3(n) { return String(n).padStart(3, '0'); }
  function spriteKey(id) { return id; }
  function guard(name, fn) { try { fn(); } catch (e) { console.error('[TG.ui] ' + name, e); } }

  // ------------------------------------------------------------ state
  const refs = {};
  const dirty = { grass: true, dex: true, town: true, map: true, lab: true };
  let active = 'grass';
  let selectedDex = null;
  const encEls = new Map();
  let prodRows = [];
  let upgBtns = [];
  let routeBtns = [];
  let gymBtns = [];
  let martBtns = [];
  let debugTimer = 0;
  let lastLabStats = 0;
  let titleStreak = 0, titleLast = 0;
  let toastTimer = 0;
  const modalQueue = [];
  let modalOpen = false;

  UI.markDirty = function (...tabs) {
    if (!tabs.length) tabs = Object.keys(dirty);
    for (const t of tabs) dirty[t] = true;
  };

  // ------------------------------------------------------------ glitch text
  UI.glitchIntensity = function () {
    if (!(TG.systems && TG.systems.glitch)) return 0;
    const v = (S() && S().instability) || 0;
    return Math.max(0, Math.min(1, v / 100));
  };
  UI.corrupt = function (text, intensity) {
    if (intensity === undefined || intensity === null) intensity = UI.glitchIntensity();
    text = String(text == null ? '' : text);
    if (!(intensity > 0)) return text;
    let out = '';
    for (const ch of text) {
      if (ch !== ' ' && Math.random() < intensity * 0.35) out += GLITCH_CHARS[(Math.random() * GLITCH_CHARS.length) | 0];
      else out += ch;
    }
    return out;
  };

  // ------------------------------------------------------------ shell & tabs
  function ensureShell() {
    if (document.getElementById('app')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = SHELL;
    while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
  }

  function updateTabs(newName) {
    const st = S();
    document.querySelectorAll('.tabbtn').forEach(b => {
      const t = b.dataset.tab;
      setHidden(b, !st.tabs[t]);
    });
    document.querySelectorAll('.tab').forEach(sec => {
      const t = sec.id.replace('tab-', '');
      if (!st.tabs[t]) setHidden(sec, true);
    });
    if (newName && newName !== active) {
      const b = $('.tabbtn[data-tab="' + newName + '"]');
      if (b) b.classList.add('new');
      // two tabs can open in the same second (TOWN + MAP): one toast naming both
      tabToasts.push(TAB_LABELS[newName] || newName.toUpperCase());
      clearTimeout(tabToastTimer);
      tabToastTimer = setTimeout(() => {
        const n = tabToasts.splice(0);
        UI.toast(n.join(' and ') + ' unlocked!', 3000);
      }, 60);
    }
  }
  const tabToasts = [];
  let tabToastTimer = 0;

  UI.showTab = function (name) {
    const st = S();
    if (!st.tabs[name]) name = 'grass';
    active = name;
    st.settings.tab = name;
    document.querySelectorAll('.tabbtn').forEach(b => {
      const on = b.dataset.tab === name;
      setClass(b, 'active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) b.classList.remove('new');
    });
    document.querySelectorAll('.tab').forEach(sec => setHidden(sec, sec.id !== 'tab-' + name));
    if (dirty[name]) renderTab(name);
    updateActive();
    if (name === 'grass') scrollLogBottom(refs.logMini);
    if (name === 'lab') scrollLogBottom(refs.logFull);
    TG.emit('tabshow', name);
  };

  function renderTab(name) {
    dirty[name] = false;
    switch (name) {
      case 'grass': guard('grass', renderGrass); break;
      case 'dex': guard('dex', renderDex); break;
      case 'town': guard('town', renderTown); break;
      case 'map': guard('map', renderMap); break;
      case 'lab': guard('lab', renderLab); break;
      default: break;
    }
  }

  // ------------------------------------------------------------ header
  function renderBadges() {
    const st = S();
    const wrap = refs.badges;
    if (!wrap) return;
    const have = {};
    (st.badgeIds || []).forEach(id => { const g = TG.gym(id); if (g) have[g.badgeIndex] = g; });
    wrap.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
      const g = have[i];
      wrap.appendChild(h('i', { class: 'pip' + (g || st.badges >= i ? ' on' : ''), title: g ? g.badge || g.name : 'Badge ' + i }));
    }
    setText(refs.name, nameOverride != null ? nameOverride : (st.champion ? '★' : '') + (st.name || 'RED'));
  }
  // a system may briefly replace the header name (e.g. DITTO); null restores it
  let nameOverride = null;
  UI.setNameOverride = function (text) { nameOverride = text == null ? null : String(text); renderBadges(); };

  function updateHeader() {
    const st = S();
    setText(refs.rd, TG.fmtInt(st.rd));
    setText(refs.rdps, TG.fmtRate(TG.rates.rd));
  }

  // ------------------------------------------------------------ grass tab
  function buildGrass() {
    const sec = $('#tab-grass');
    sec.innerHTML = `
      <div class="box grass-top">
        <div class="route-name" id="g-route">PALLET TOWN</div>
        <span class="tod" id="g-tod" title="Time of day"></span>
        <span class="ballcount" id="g-ballcount" title="Poké Balls"><canvas id="g-ballicon" width="16" height="16"></canvas><span id="g-ballsym" hidden>◓</span> <span id="g-balls">0</span></span>
        <button class="btn small buyballs" type="button" id="g-buyballs" hidden>+10<small id="g-buyballs-c"></small></button>
      </div>
      <div class="box event-banner" id="g-event" hidden>
        <span class="event-text" id="g-event-text"></span><span id="g-event-time"></span>
        <button class="btn small" type="button" id="g-event-btn" hidden>FIGHT!</button>
      </div>
      <div class="grass" id="grass" aria-label="Tall grass. Tap to search.">
        <div id="enc-layer"></div>
        <button class="truck" type="button" id="g-truck" hidden aria-label="A truck"><canvas></canvas></button>
        <div id="fx-layer"></div>
        <div class="grass-hint" id="g-hint"><span>TAP THE TALL GRASS</span></div>
      </div>
      <div class="gag-strip" id="g-gags" hidden></div>
      <div class="box grass-stats">
        <span>TAP <b id="g-tap">1</b></span>
        <span>FIND <b id="g-enc">20%</b></span>
        <span>DEX <b id="g-dex">0</b></span>
        <span id="g-auto-wrap" hidden>AUTO <b id="g-auto">0</b>/s</span>
        <span id="g-encps-wrap" hidden>SPAWN <b id="g-encps">0</b></span>
        <div class="combo" id="g-combo" hidden><span>COMBO</span><div class="bar"><i id="g-combo-fill"></i></div><b id="g-combo-x">×1.0</b></div>
      </div>
      <div class="box"><h2>JOURNAL</h2><div class="log mini" id="log-mini" aria-live="polite"></div></div>`;
    Object.assign(refs, {
      gRoute: $('#g-route'), gTod: $('#g-tod'), gBalls: $('#g-balls'), gBallIcon: $('#g-ballicon'), gBallSym: $('#g-ballsym'),
      gEvent: $('#g-event'), gEventText: $('#g-event-text'), gEventTime: $('#g-event-time'), gEventBtn: $('#g-event-btn'),
      grass: $('#grass'), encLayer: $('#enc-layer'), fx: $('#fx-layer'), truck: $('#g-truck'), hint: $('#g-hint'),
      gBallWrap: $('#g-ballcount'), gTap: $('#g-tap'), gEnc: $('#g-enc'), gDex: $('#g-dex'), gAutoWrap: $('#g-auto-wrap'), gAuto: $('#g-auto'),
      gEncpsWrap: $('#g-encps-wrap'), gEncps: $('#g-encps'),
      gCombo: $('#g-combo'), gComboFill: $('#g-combo-fill'), gComboX: $('#g-combo-x'), logMini: $('#log-mini')
    });

    refs.grass.addEventListener('pointerdown', onGrassDown);
    refs.grass.addEventListener('contextmenu', e => e.preventDefault());
    refs.gEventBtn.addEventListener('click', () => { TG.counterEvent(); });
    refs.gBuyBalls = $('#g-buyballs'); refs.gBuyBallsC = $('#g-buyballs-c');
    refs.gBuyBalls.addEventListener('click', () => {
      if (TG.buyBalls(10)) UI.toast('+10 Poké Balls.');
      else { UI.toast('Not enough RD for 10 Poké Balls.'); if (TG.sfx) TG.sfx.play('error'); }
    });
    drawGrassStatics();
  }

  function drawGrassStatics() {
    if (!refs.grass) return;
    try {
      refs.grass.style.backgroundImage = 'url(' + TG.spriteDataURL(GRASS_TILE, { palette: 'light' }) + ')';
      refs.grass.style.imageRendering = 'pixelated';
    } catch (e) { /* canvas unavailable */ }
    if (TG.hasSprite('ball')) {
      TG.drawSprite(refs.gBallIcon, 'ball', { scale: 1 });
      setHidden(refs.gBallIcon, false); setHidden(refs.gBallSym, true);
    } else { setHidden(refs.gBallIcon, true); setHidden(refs.gBallSym, false); }
    TG.drawSprite(refs.truck.querySelector('canvas'), 'truck', { scale: 7 });
    encEls.forEach((el) => drawEnc(el));
  }

  function renderGrass() {
    const st = S();
    const r = TG.route(st.currentRoute);
    setText(refs.gRoute, UI.corrupt(r ? r.name.toUpperCase() : st.currentRoute));
    setText(refs.gTod, TG.isNight() ? '☾' : '☀');
    refs.gTod.title = TG.isNight() ? 'Night' : 'Day';
    setHidden(refs.truck, !TG.truckVisible());
    setHidden(refs.gCombo, !st.flags.bike);
    updateHint();
    renderEvent();
    syncEncounters();
  }

  // the hint under the grass follows what the player still has to learn (or is stuck on)
  function hintText(st) {
    const enc = st.encounters.length;
    const caught = (st.stats.catches || 0) > 0 || TG.mults.dexCount > 0;
    if (enc && st.balls < 1 && !(TG.effects.autoCatch > 0 && TG.rates.balls > 0)) {
      return st.flags.mart ? 'OUT OF BALLS · TAP +10 TO BUY' : 'NO BALLS · TAP ONE TO SHOO IT';
    }
    if (enc && (st.stats.ballsThrown || 0) < 3 && !caught) return 'TAP A POKéMON TO THROW A BALL';
    if (!enc && !caught && st.taps < 40) return 'TAP THE TALL GRASS';
    return '';
  }
  function updateHint() {
    if (!refs.hint) return;
    const txt = hintText(S());
    setHidden(refs.hint, !txt);
    if (txt) setText(refs.hint.firstChild, txt);
    setClass(refs.grass, 'hint-throw', txt === 'TAP A POKéMON TO THROW A BALL');
    setClass(refs.gBallWrap, 'empty', S().balls < 1);
  }

  function updateGrass() {
    const st = S();
    updateHint();
    if (encEls.size !== st.encounters.length) syncEncounters();
    setText(refs.gBalls, TG.fmtInt(st.balls));
    const quick = !!st.flags.mart && st.balls < 25;
    setHidden(refs.gBuyBalls, !quick);
    if (quick) {
      const c = TG.ballPrice(10);
      setText(refs.gBuyBallsC, ' ' + TG.fmt(c) + ' RD');
      setClass(refs.gBuyBalls, 'no', st.rd < c);
    }
    setText(refs.gTap, TG.fmt(TG.tapPower()));
    setText(refs.gEnc, TG.fmtPct(TG.tapEncounterChance()));
    setText(refs.gDex, String(TG.mults.dexCount));
    const auto = TG.effects.autoCatch;
    setHidden(refs.gAutoWrap, !(auto > 0));
    if (auto > 0) setText(refs.gAuto, TG.fmt(auto));
    const eps = TG.rates.encounters;
    setHidden(refs.gEncpsWrap, !(eps > 0));
    if (eps > 0) setText(refs.gEncps, eps >= 1 ? TG.fmtRate(eps) : '1/' + TG.fmtTime(1 / eps));
    if (st.flags.bike) {
      const pct = Math.round((st.combo - 1) / 2 * 100);
      if (refs.gComboFill._w !== pct) { refs.gComboFill._w = pct; refs.gComboFill.style.width = pct + '%'; }
      setText(refs.gComboX, '×' + st.combo.toFixed(1));
    }
    const a = st.activeEvent;
    if (a && !refs.gEvent.hidden) setText(refs.gEventTime, Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000)) + 's');
  }

  function renderEvent() {
    const a = S().activeEvent;
    setHidden(refs.gEvent, !a);
    if (!a) return;
    setText(refs.gEventText, a.text);
    const steal = a.effect && a.effect.type === 'steal';
    setHidden(refs.gEventBtn, !steal);
    if (steal) setText(refs.gEventBtn, a.effect.counterLabel || 'FIGHT!');
  }

  function onGrassDown(e) {
    if (e.button !== undefined && e.button > 0) return;
    const rect = refs.grass.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width * 100;
    const yPct = (e.clientY - rect.top) / rect.height * 100;
    // elements owned by systems (js/systems/gags.js) handle their own clicks
    if (e.target.closest && e.target.closest('[data-gag]')) return;
    const encEl = e.target.closest && e.target.closest('.enc');
    e.preventDefault();
    if (encEl) {
      const res = TG.throwBallUid(Number(encEl.dataset.uid));
      if (!res.ok && res.reason === 'balls') {
        // no ball: shoo it away instead so the queue never locks up
        const sh = TG.shooUid(Number(encEl.dataset.uid));
        if (sh.ok) {
          UI.floatText(xPct, yPct, '+' + TG.fmt(sh.gain), '');
          const n = S().stats.shooed || 0;
          if (n === 1 || n % 10 === 0) UI.toast(S().flags.mart ? 'No Poké Balls. Buy more at the Poké Mart.' : 'No Poké Balls. Prof. Oak sends one every ' + (TG.config.dripSeconds || 15) + 's.');
        } else {
          UI.floatText(xPct, yPct, 'NO BALLS!', 'bad');
        }
      }
      return;
    }
    if (e.target.closest && e.target.closest('#g-truck')) {
      const r = TG.tapTruck();
      refs.truck.classList.remove('push'); void refs.truck.offsetWidth; refs.truck.classList.add('push');
      if (r.needStrength) UI.floatText(xPct, yPct, '...', 'bad');
      else if (r.ok && !r.moved) UI.floatText(xPct, yPct, r.taps + '/50', '');
      if (r.moved) { setHidden(refs.truck, true); UI.floatText(50, 70, '!!!', 'big'); }
      return;
    }
    const r = TG.tap();
    UI.floatText(xPct, yPct, '+' + TG.fmt(r.gain), r.combo > 2 ? 'big' : '');
    if (!S().settings.reduceMotion) {
      refs.grass.classList.remove('rustle'); void refs.grass.offsetWidth; refs.grass.classList.add('rustle');
    }
    updateHint();
  }

  UI.floatText = function (xPct, yPct, text, cls) {
    if (!refs.fx || S().settings.reduceMotion) return;
    if (refs.fx.childElementCount > 28) refs.fx.firstElementChild.remove();
    const el = h('div', { class: 'float' + (cls ? ' ' + cls : ''), text: text });
    el.style.left = xPct + '%';
    el.style.top = yPct + '%';
    refs.fx.appendChild(el);
    setTimeout(() => el.remove(), 950);
  };

  // encounters
  function pickSpot() {
    const taken = [];
    encEls.forEach(el => { if (!el._leaving) taken.push(el._pos); });
    const truck = TG.truckVisible();
    let best = null, bestD = -1;
    for (let i = 0; i < 14; i++) {
      const p = { x: 12 + Math.random() * 76, y: 26 + Math.random() * 50 };
      if (truck && Math.abs(p.x - 50) < 22 && p.y > 52) continue;
      let d = Infinity;
      for (const t of taken) d = Math.min(d, Math.hypot((p.x - t.x) / 16, (p.y - t.y) / 24));
      if (d > 1) return p;
      if (d > bestD) { bestD = d; best = p; }
    }
    return best || { x: 50, y: 45 };
  }

  function drawEnc(el) {
    const enc = el._enc;
    TG.drawSprite(el._cv, spriteKey(enc.id), { scale: 4, palette: enc.shiny ? 'shiny' : 'dmg', corrupt: UI.glitchIntensity() * 0.3 });
  }

  function makeEncEl(enc) {
    const cv = h('canvas', { width: 64, height: 64 });
    const sp = TG.species(enc.id);
    const pips = h('div', { class: 'pips' });
    if (!enc.noFlee) for (let i = 0; i < 3; i++) pips.appendChild(h('i'));
    const el = h('div', { class: 'enc' + (enc.shiny ? ' shiny' : ''), 'data-uid': enc.uid, role: 'button', 'aria-label': 'Throw a ball at ' + (sp ? sp.name : '???') },
      h('span', { class: 'bang', text: '!' }),
      cv,
      h('span', { class: 'nm', text: UI.corrupt(sp ? sp.name.toUpperCase() : '???') }),
      pips);
    el._cv = cv; el._enc = enc; el._pips = pips;
    el._pos = pickSpot();
    el.style.left = el._pos.x + '%';
    el.style.top = el._pos.y + '%';
    drawEnc(el);
    return el;
  }

  function updatePips(el, enc) {
    const ps = el._pips.children;
    for (let i = 0; i < ps.length; i++) setClass(ps[i], 'x', i < (enc.misses || 0));
  }

  function syncEncounters() {
    if (!refs.encLayer) return;
    const list = S().encounters;
    const live = new Set();
    for (const enc of list) {
      live.add(enc.uid);
      let el = encEls.get(enc.uid);
      if (!el) {
        el = makeEncEl(enc);
        encEls.set(enc.uid, el);
        refs.encLayer.appendChild(el);
      }
      el._enc = enc;
      updatePips(el, enc);
    }
    encEls.forEach((el, uid) => {
      if (!live.has(uid) && !el._leaving) { el.remove(); encEls.delete(uid); }
    });
  }

  function leave(el, uid, cls) {
    el._leaving = true;
    el.classList.add(cls);
    setTimeout(() => { el.remove(); if (encEls.get(uid) === el) encEls.delete(uid); }, 460);
  }

  function onThrow(res) {
    if (!res || !res.enc) return;
    const uid = res.enc.uid;
    const el = encEls.get(uid);
    if (!el) return;
    const p = el._pos;
    if (res.caught) {
      leave(el, uid, 'caught');
      UI.floatText(p.x, p.y - 8, '+' + TG.fmt(res.gain), 'catch');
      if (res.isNew) UI.floatText(p.x, p.y - 22, 'NEW!', 'big');
      else if (!res.auto) UI.floatText(p.x, p.y - 22, 'GOTCHA!', '');
    } else if (res.fled) {
      leave(el, uid, 'fled');
      if (!res.auto) UI.floatText(p.x, p.y - 12, 'FLED', 'bad');
    } else {
      updatePips(el, res.enc);
      if (!S().settings.reduceMotion) { el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); }
      if (!res.auto) UI.floatText(p.x, p.y - 12, 'MISS', 'bad');
    }
  }

  // an encounter left without a throw (shooed with no balls, or wandered off): animate it out
  function onGone(enc, type) {
    if (!enc) return;
    const el = encEls.get(enc.uid);
    if (!el || el._leaving) return;
    leave(el, enc.uid, 'fled');
    if (type === 'wander') UI.floatText(el._pos.x, el._pos.y - 12, 'BYE', 'bad');
  }

  // ------------------------------------------------------------ log
  function lineEl(entry, isNew) {
    const text = entry.cls === 'glitch' || UI.glitchIntensity() > 0 ? UI.corrupt(entry.text, UI.glitchIntensity()) : entry.text;
    return h('div', { class: 'ln ' + (entry.cls || 'sys') + (isNew ? ' new' : '') }, text);
  }
  function nearBottom(c) { return c.scrollHeight - c.scrollTop - c.clientHeight < 48; }
  function scrollLogBottom(c) { if (c) c.scrollTop = c.scrollHeight; }
  function appendTo(c, entry, max) {
    if (!c) return;
    const stick = c.clientHeight === 0 || nearBottom(c);
    c.appendChild(lineEl(entry, true));
    while (c.childElementCount > max) c.firstElementChild.remove();
    if (stick) scrollLogBottom(c);
  }
  function appendLog(entry) {
    appendTo(refs.logMini, entry, MINI_LOG);
    appendTo(refs.logFull, entry, FULL_LOG);
    if (entry.cls === 'oak' && refs.speech) setText(refs.speech, entry.text);
  }
  function rebuildLog() {
    const log = S().log || [];
    [[refs.logMini, MINI_LOG], [refs.logFull, FULL_LOG]].forEach(([c, max]) => {
      if (!c) return;
      c.innerHTML = '';
      log.slice(-max).forEach(e => c.appendChild(lineEl(e, false)));
      scrollLogBottom(c);
    });
    const lastOak = log.slice().reverse().find(e => e.cls === 'oak');
    if (refs.speech) setText(refs.speech, lastOak ? lastOak.text : 'Ah, there you are! The tall grass is full of POKéMON.');
  }

  // ------------------------------------------------------------ dex tab
  function buildDex() {
    const sec = $('#tab-dex');
    sec.innerHTML = `
      <div class="box dex-head"><h2>POKéDEX</h2>
        <span>CAUGHT <b id="d-caught">0</b>/${DEX_SIZE}</span><span>SEEN <b id="d-seen">0</b></span><span>BONUS <b id="d-bonus">+0%</b></span></div>
      <div class="box dex-detail" id="d-detail" hidden></div>
      <div class="box"><div class="dex-grid" id="d-grid"></div></div>`;
    refs.dCaught = $('#d-caught'); refs.dSeen = $('#d-seen'); refs.dBonus = $('#d-bonus');
    refs.dDetail = $('#d-detail'); refs.dGrid = $('#d-grid');
    const frag = document.createDocumentFragment();
    refs.dexCells = [];
    for (let id = 1; id <= DEX_SIZE; id++) {
      const cell = h('button', { class: 'dex-cell', type: 'button', 'data-id': id, 'aria-label': '#' + pad3(id) },
        h('span', { class: 'no', text: pad3(id) }));
      cell._id = id;
      frag.appendChild(cell);
      refs.dexCells.push(cell);
    }
    refs.dGrid.appendChild(frag);
    refs.dGrid.addEventListener('click', e => {
      const c = e.target.closest('.dex-cell');
      if (!c) return;
      selectDex(c._id);
    });
  }

  function dexKey(id) {
    const d = S().dex[id];
    if (!d || (!d.seen && !d.caught)) return 'u';
    if (!d.caught) return 's';
    let k = d.shiny ? 'C' : 'c';
    if (TG.canEvolve(id).ok) k += 'e';
    return k;
  }

  function renderDex() {
    const gi = UI.glitchIntensity();
    for (const cell of refs.dexCells) {
      const id = cell._id;
      const k = dexKey(id) + (gi > 0 ? Math.random() < gi * 0.1 ? 'g' : '' : '');
      if (cell._k === k) continue;
      cell._k = k;
      let cv = cell._cv;
      let q = cell._q;
      if (k[0] === 'u') {
        if (cv) cv.hidden = true;
        if (!q) { q = cell._q = h('span', { class: 'q', text: '?' }); cell.appendChild(q); }
        q.hidden = false;
      } else {
        if (!cv) { cv = cell._cv = h('canvas', { width: 32, height: 32 }); cell.appendChild(cv); }
        cv.hidden = false;
        if (q) q.hidden = true;
        const pal = k[0] === 's' ? 'silhouette' : k[0] === 'C' ? 'shiny' : 'dmg';
        TG.drawSprite(cv, spriteKey(id), { scale: 2, palette: pal, corrupt: k.indexOf('g') >= 0 ? 0.25 : 0 });
      }
      setClass(cell, 'caught', k[0] === 'c' || k[0] === 'C');
      setClass(cell, 'shiny', k[0] === 'C');
      setClass(cell, 'evo', k.indexOf('e') > 0);
      const sp = TG.species(id);
      cell.setAttribute('aria-label', '#' + pad3(id) + ' ' + (k[0] === 'u' ? 'unknown' : sp ? sp.name : '???'));
    }
    updateDex();
    if (selectedDex) updateDexDetail();
  }

  // structural signature of the detail panel: rebuild only when this changes, otherwise just
  // refresh the numbers (candy/catch events fire every tick late-game; rebuilding then would
  // replace the EVOLVE button under the player's finger and swallow the click)
  function dexDetailSig(id) {
    const st = S();
    const d = st.dex[id] || {};
    const sp = TG.species(id);
    const chk = sp && sp.evolvesTo ? TG.canEvolve(id) : null;
    const tSeen = TG.evolveTargets(id).map(t => (st.dex[t] && st.dex[t].caught ? 1 : 0)).join('');
    return [id, !!d.seen, (d.caught || 0) > 0, d.shiny || 0, chk ? chk.ok + ':' + chk.reason : '', tSeen].join('|');
  }

  function updateDexDetail() {
    const box = refs.dDetail;
    if (!box || box._sig !== dexDetailSig(selectedDex)) { renderDexDetail(); return; }
    const st = S();
    const d = st.dex[selectedDex] || {};
    const sp = TG.species(selectedDex);
    if (box._caught) setText(box._caught, TG.fmtInt(d.caught || 0));
    if (box._candy && sp) setText(box._candy, TG.fmtInt(st.candy[sp.family] || 0));
    if (box._evo && sp) {
      const have = TG.canEvolve(selectedDex).have || 0;
      box._evo.forEach(s => setText(s, ' (' + TG.fmtInt(Math.min(have, sp.candyToEvolve)) + '/' + sp.candyToEvolve + ')'));
    }
  }

  function updateDex() {
    setText(refs.dCaught, String(TG.mults.dexCount));
    setText(refs.dSeen, String(TG.mults.seenCount));
    setText(refs.dBonus, '+' + TG.fmtPct(TG.mults.dexBonus - 1));
  }

  function selectDex(id) {
    const prev = refs.dexCells[(selectedDex || 0) - 1];
    if (prev) prev.classList.remove('sel');
    if (selectedDex === id) { selectedDex = null; setHidden(refs.dDetail, true); return; }
    selectedDex = id;
    refs.dexCells[id - 1].classList.add('sel');
    renderDexDetail();
    setHidden(refs.dDetail, false);
    refs.dDetail.scrollIntoView({ block: 'nearest', behavior: S().settings.reduceMotion ? 'auto' : 'smooth' });
  }

  function renderDexDetail() {
    const id = selectedDex;
    const st = S();
    const d = st.dex[id] || { caught: 0, shiny: 0, seen: false };
    const sp = TG.species(id);
    const box = refs.dDetail;
    box.innerHTML = '';
    box._sig = dexDetailSig(id);
    box._caught = box._candy = null;
    box._evo = [];
    const cv = h('canvas', { width: 96, height: 96 });
    const known = d.caught > 0;
    const seen = known || d.seen;
    TG.drawSprite(cv, spriteKey(id), { scale: 6, palette: !seen ? 'silhouette' : known ? (d.shiny ? 'shiny' : 'dmg') : 'silhouette' });
    if (!seen) cv.style.opacity = '.25';
    const info = h('div', null,
      h('div', { class: 'nm', text: '#' + pad3(id) + ' ' + (seen && sp ? sp.name.toUpperCase() : '?????') }),
      known && sp ? h('div', { class: 'types' }, (sp.types || []).map(t => h('span', { class: 'type', text: t }))) : null,
      h('p', { class: 'entry', text: known && sp ? sp.entry || '' : seen ? 'Spotted in the wild. Catch one to learn more.' : 'No data.' }));
    if (known) {
      box._caught = h('b', { text: TG.fmtInt(d.caught) });
      info.appendChild(h('div', null, 'Caught: ', box._caught, d.shiny ? '  ✨ Shiny: ' : '', d.shiny ? h('b', { text: String(d.shiny) }) : null));
      if (sp && sp.family) {
        box._candy = h('b', { text: TG.fmtInt(st.candy[sp.family] || 0) });
        info.appendChild(h('div', null, 'Candy: ', box._candy));
      }
    }
    box.appendChild(cv);
    box.appendChild(info);
    const actions = h('div', { class: 'actions' });
    if (known && sp && sp.evolvesTo) {
      const chk = TG.canEvolve(id);
      const targets = TG.evolveTargets(id);
      if (chk.reason === 'locked') {
        actions.appendChild(h('span', { class: 'dim', text: 'Evolution unlocks with the Cascade Badge.' }));
      } else {
        if (!chk.ok) actions.appendChild(h('span', { class: 'dim hint-line', text: 'More candy: catch more of this family' + (st.flags.daycare ? ', or hire the Day Care in TOWN.' : '.') }));
        targets.forEach(tid => {
          const t = TG.species(tid);
          const tSeen = st.dex[tid] && st.dex[tid].caught;
          const cnt = h('small', { text: ' (' + TG.fmtInt(Math.min(chk.have || 0, sp.candyToEvolve)) + '/' + sp.candyToEvolve + ')' });
          box._evo.push(cnt);
          actions.appendChild(h('button', {
            class: 'btn' + (chk.ok ? ' primary' : ''), type: 'button', disabled: !chk.ok,
            onclick: () => { if (TG.evolve(id, tid)) { UI.toast((t ? t.name : '???') + '!'); renderDex(); } }
          }, 'EVOLVE → ' + (tSeen && t ? t.name.toUpperCase() : '???'), cnt));
        });
      }
    }
    actions.appendChild(h('span', { class: 'spacer' }));
    actions.appendChild(h('button', { class: 'btn small', type: 'button', onclick: () => selectDex(id) }, 'CLOSE'));
    box.appendChild(actions);
  }

  // ------------------------------------------------------------ town tab
  function buildTown() {
    const sec = $('#tab-town');
    sec.innerHTML = `
      <div class="box"><div class="row"><h2>TRAINERS</h2><span class="spacer"></span>
        <div class="buyamt" id="t-amt"><button class="btn small" type="button" data-amt="1">×1</button><button class="btn small" type="button" data-amt="10">×10</button><button class="btn small" type="button" data-amt="max">MAX</button></div></div>
        <div id="t-prods"></div></div>
      <div class="box" id="t-mart" hidden><h2>POKé MART</h2><p class="dim" style="margin:0 0 8px">"Welcome! May I help you?" — you have <b id="t-balls">0</b> balls.</p><div class="mart-btns" id="t-mart-btns"></div></div>
      <div class="box" id="t-shop" hidden></div>
      <div class="box"><h2>UPGRADES</h2><div class="upgrades" id="t-upgs"></div></div>`;
    refs.tProds = $('#t-prods'); refs.tUpgs = $('#t-upgs'); refs.tMart = $('#t-mart'); refs.tMartBtns = $('#t-mart-btns'); refs.tBalls = $('#t-balls');
    refs.tAmt = $('#t-amt');
    refs.tAmt.addEventListener('click', e => {
      const b = e.target.closest('[data-amt]');
      if (!b) return;
      const v = b.dataset.amt;
      S().settings.buyAmt = v === 'max' ? 'max' : Number(v);
      syncAmtButtons();
      updateTown();
    });
    [1, 10, 100].forEach(n => {
      const b = h('button', { class: 'btn', type: 'button', onclick: () => { if (!TG.buyBalls(n)) { UI.toast('Not enough RD.'); if (TG.sfx) TG.sfx.play('error'); } } },
        h('span', { text: '×' + n }), h('small', { text: '' }));
      b._n = n; b._cost = b.lastChild;
      refs.tMartBtns.appendChild(b);
      martBtns.push(b);
    });
  }

  function syncAmtButtons() {
    const amt = String(S().settings.buyAmt || 1);
    refs.tAmt.querySelectorAll('[data-amt]').forEach(b => setClass(b, 'on', b.dataset.amt === amt));
  }

  function prodInfoText(p) {
    const o = TG.producerOutput(p.id);
    const parts = [];
    if (o.rd) parts.push('+' + TG.fmt(o.rd) + ' RD/s');
    if (o.encounters) parts.push('+' + TG.fmt(o.encounters, 3) + ' enc/s');
    if (o.balls) parts.push('+' + TG.fmt(o.balls) + ' balls/s');
    if (o.candy) parts.push('+' + TG.fmt(o.candy) + ' candy/s');
    if (o.gb) parts.push('+▓' + TG.fmt(o.gb) + '/s');
    return (parts.join(' · ') || p.desc || '') + ' each';
  }

  function renderTown() {
    const st = S();
    syncAmtButtons();
    // producers
    refs.tProds.innerHTML = '';
    prodRows = [];
    const prods = (TG.data.producers || []).filter(p => TG.producerVisible(p) && TG.producerCurrency(p.id) !== 'gb'); // ▓ producers live in the Glitch tab
    for (const p of prods) {
      const btn = h('button', { class: 'btn', type: 'button' }, h('span', { text: 'BUY' }), h('small', { text: '' }));
      const own = h('span', { class: 'own', text: '' });
      const info = h('div', { class: 'info', text: '' });
      const row = h('div', { class: 'prod' },
        h('div', null, h('span', { class: 'nm', text: UI.corrupt(p.name) }), own),
        btn, info,
        h('div', { class: 'flav', text: p.flavor ? '"' + p.flavor + '"' : (p.desc || '') }));
      btn.addEventListener('click', () => {
        const amt = st.settings.buyAmt || 1;
        const before = st.producers[p.id] || 0;
        if (!TG.buyProducer(p.id, amt === 'max' ? 'max' : amt)) { UI.toast('Not enough ' + (TG.producerCurrency(p.id) === 'gb' ? 'Glitch Bytes' : 'RD') + '.'); if (TG.sfx) TG.sfx.play('error'); }
        else if (!before) UI.toast(p.name + ' joins your research!');
      });
      refs.tProds.appendChild(row);
      prodRows.push({ p, btn, own, info, lbl: btn.firstChild, cost: btn.lastChild });
    }
    if (!prods.length) refs.tProds.appendChild(h('p', { class: 'empty', text: 'Nobody wants to help yet. Keep tapping.' }));
    // next locked producer teaser
    const next = (TG.data.producers || []).find(p => !TG.producerVisible(p) && (p.act || 1) <= Math.max(2, st.act) && TG.producerCurrency(p.id) !== 'gb');
    if (next) refs.tProds.appendChild(h('div', { class: 'prod locked' }, h('div', null, h('span', { class: 'nm', text: '??? ' }), h('span', { class: 'dim', text: unlockHint(next) }))));

    // upgrades
    refs.tUpgs.innerHTML = '';
    upgBtns = [];
    const ups = (TG.data.upgrades || []).filter(u => TG.upgradeAvailable(u) && !TG.costParts(u.cost).gb).sort((a, b) => costRD(a.cost) - costRD(b.cost)).slice(0, 12);
    for (const u of ups) {
      const cost = h('span', { class: 'cost', text: fmtCost(u.cost) });
      const b = h('button', { class: 'btn upg', type: 'button', title: u.flavor || '' },
        h('span', { class: 'nm', text: UI.corrupt(u.name) }),
        h('span', { class: 'desc', text: u.desc || '' }),
        u.flavor ? h('span', { class: 'flav dim', text: u.flavor }) : null,
        cost);
      b.addEventListener('click', () => {
        if (TG.buyUpgrade(u.id)) UI.toast(u.name + '!');
        else { UI.toast('Not enough RD.'); if (TG.sfx) TG.sfx.play('error'); }
      });
      refs.tUpgs.appendChild(b);
      upgBtns.push({ u, b });
    }
    const nextU = nextLockedUpgrade();
    if (!ups.length) refs.tUpgs.appendChild(h('p', { class: 'empty', text: nextU ? 'Nothing to buy yet. Next up:' : 'No upgrades available right now.' }));
    if (nextU) refs.tUpgs.appendChild(h('div', { class: 'btn upg locked', 'aria-disabled': 'true' },
      h('span', { class: 'nm', text: '??? ' + UI.corrupt(nextU.u.name) }),
      h('span', { class: 'desc', text: nextU.u.desc || '' }),
      h('span', { class: 'cost', text: 'NEEDS ' + nextU.miss.map(r => r.label).join(', ') })));
    setHidden(refs.tMart, !st.flags.mart);
    updateTown();
  }

  // the cheapest RD upgrade the player can't see yet whose chain prerequisite is already owned
  function nextLockedUpgrade() {
    const st = S();
    let best = null;
    for (const u of TG.data.upgrades || []) {
      if (st.upgrades[u.id] || u.glitch || TG.costParts(u.cost).gb || TG.upgradeAvailable(u)) continue;
      const miss = TG.reqStatus(u.requires).filter(r => !r.ok);
      if (!miss.length || miss.some(r => r.key.indexOf('upg_') === 0)) continue;
      if (!best || costRD(u.cost) < costRD(best.u.cost)) best = { u, miss };
    }
    return best;
  }

  function unlockHint(p) {
    const u = p.unlock || {};
    const parts = [];
    if (u.badges && S().badges < u.badges) parts.push(u.badges + ' badge' + (u.badges > 1 ? 's' : ''));
    (u.routes || []).forEach(r => { if (!S().routes[r]) { const rt = TG.route(r); parts.push(rt ? rt.name : r); } });
    (u.flags || []).forEach(f => { if (!S().flags[f]) parts.push(TG.flagLabel(f)); });
    if (u.producers) for (const k in u.producers) if ((S().producers[k] || 0) < u.producers[k]) { const pr = TG.producer(k); parts.push((pr ? pr.name : k) + ' ×' + u.producers[k]); }
    if (u.rdTotal && S().rdTotal < u.rdTotal) parts.push(TG.fmt(u.rdTotal) + ' RD earned');
    return parts.length ? '(needs ' + parts.join(', ') + ')' : '';
  }

  function updateTown() {
    const st = S();
    const amt = st.settings.buyAmt || 1;
    for (const r of prodRows) {
      const id = r.p.id;
      let n = amt === 'max' ? TG.maxAffordable(id) : amt;
      const showN = Math.max(1, n);
      const cost = TG.producerCost(id, showN);
      const ok = (amt !== 'max' || n > 0) && TG.canAfford(cost);
      setText(r.own, '×' + (st.producers[id] || 0));
      setText(r.lbl, amt === 'max' ? 'BUY ×' + n : amt > 1 ? 'BUY ×' + amt : 'BUY');
      setText(r.cost, fmtCost(cost));
      setClass(r.btn, 'no', !ok);
      setText(r.info, prodInfoText(r.p));
    }
    for (const x of upgBtns) setClass(x.b, 'no', !TG.canAfford(x.u.cost));
    if (st.flags.mart) {
      setText(refs.tBalls, TG.fmtInt(st.balls));
      for (const b of martBtns) {
        const c = TG.ballPrice(b._n);
        setText(b._cost, TG.fmt(c) + ' RD');
        setClass(b, 'no', st.rd < c);
      }
    }
  }

  // ------------------------------------------------------------ map tab
  function buildMap() {
    const sec = $('#tab-map');
    sec.innerHTML = `
      <div class="box"><h2>MAP</h2><div id="m-routes"></div></div>
      <div class="box"><h2>GYMS</h2><div id="m-gyms"></div></div>
      <div class="box"><h2>POKéMON LEAGUE</h2><div id="m-league"></div></div>`;
    refs.mRoutes = $('#m-routes'); refs.mGyms = $('#m-gyms'); refs.mLeague = $('#m-league');
  }

  function reqChips(reqs) {
    return h('div', { class: 'reqs' }, reqs.map(r => h('span', { class: 'req' + (r.ok ? ' ok' : ''), text: r.label })));
  }

  function routeTypes(r) {
    const seen = {};
    const out = [];
    [r.encounters || [], r.night || []].forEach(tbl => tbl.forEach(row => {
      const sp = TG.species(row.id);
      if (!sp || sp.glitch || r.special === 'glitch_city') return;
      if (row.id === 150 && !S().flags.champion) return;
      (sp.types || []).forEach(t => { if (!seen[t]) { seen[t] = 1; out.push(t); } });
    }));
    return out.length ? 'Types: ' + out.join(' · ') : '';
  }

  function renderMap() {
    const st = S();
    refs.mRoutes.innerHTML = '';
    routeBtns = [];
    let hiddenCount = 0;
    for (const r of TG.data.routes || []) {
      const owned = !!st.routes[r.id];
      const meets = TG.meets(r.requires);
      const frontier = (r.requires && r.requires.routes || []).every(x => st.routes[x]);
      if (!owned && !meets && (!frontier || (r.act || 1) > Math.max(2, st.act))) { hiddenCount++; continue; }
      const here = st.currentRoute === r.id;
      let btn;
      if (owned) {
        btn = h('button', { class: 'btn' + (here ? ' on' : ''), type: 'button', disabled: here }, here ? 'HERE' : 'GO');
        btn.addEventListener('click', () => { TG.setRoute(r.id); UI.toast(r.name); });
      } else {
        btn = h('button', { class: 'btn', type: 'button' }, h('span', { text: 'UNLOCK' }), h('small', { text: TG.fmt(r.cost || 0) + ' RD' }));
        btn.addEventListener('click', () => {
          if (TG.unlockRoute(r.id)) UI.toast(r.name + '!');
          else {
            UI.toast(meets ? 'Not enough RD.' : 'Requirements not met.');
            if (TG.sfx) TG.sfx.play('error');
            TG.emit('route_denied', { id: r.id, meets: meets });
          }
        });
        routeBtns.push({ r, btn, meets });
      }
      const row = h('div', { class: 'route' + (here ? ' here' : '') + (owned ? '' : ' locked') },
        h('div', { class: 'nm', text: UI.corrupt(r.name) + (r.special === 'pokemon_tower' && TG.isNight() ? ' ☾' : '') }),
        btn,
        h('div', { class: 'flav', text: owned || meets ? (r.flavor || '') : '' }),
        owned ? h('div', { class: 'rtypes', text: routeTypes(r) }) : null,
        !owned && !meets ? reqChips(TG.reqStatus(r.requires).filter(x => !x.ok)) : null);
      refs.mRoutes.appendChild(row);
    }
    if (hiddenCount) refs.mRoutes.appendChild(h('p', { class: 'empty', text: '… ' + hiddenCount + ' more area' + (hiddenCount > 1 ? 's' : '') + ' beyond.' }));

    // gyms
    refs.mGyms.innerHTML = '';
    refs.mLeague.innerHTML = '';
    gymBtns = [];
    const gyms = (TG.data.gyms || []).slice().sort((a, b) => (a.badgeIndex || 0) - (b.badgeIndex || 0));
    let shownLocked = 0;
    for (const g of gyms) {
      const bi = g.badgeIndex || 0;
      const league = bi >= 9;
      const target = league ? refs.mLeague : refs.mGyms;
      if (league && st.badges < 8) continue;
      const stt = TG.gymStatus(g);
      if (!stt.beaten && !stt.meets && !league) { shownLocked++; if (shownLocked > 2) continue; }
      let btn = null;
      if (!stt.beaten) {
        btn = h('button', { class: 'btn' + (bi === 13 ? ' primary' : ''), type: 'button' }, h('span', { text: 'CHALLENGE' }), h('small', { text: TG.fmt(stt.cost) + ' RD' }));
        btn._unmet = !stt.meets;
        btn.addEventListener('click', () => challenge(g));
        gymBtns.push({ g, btn });
      } else {
        btn = h('span', { class: 'dim', text: league ? 'DEFEATED' : '★' });
      }
      const title = g.name + (g.leader ? ' — ' + g.leader : '');
      target.appendChild(h('div', { class: 'gym' + (stt.beaten ? ' beaten' : '') + (stt.meets ? '' : ' locked') },
        h('div', { class: 'nm', text: UI.corrupt(title) }),
        btn,
        h('div', { class: 'flav', text: [g.title, g.badge].filter(Boolean).join(' · ') || (bi === 13 ? 'Champion' : 'Elite Four') }),
        stt.beaten ? null : reqChips(stt.reqs)));
    }
    if (st.badges < 8) refs.mLeague.appendChild(h('p', { class: 'empty', text: 'Collect all 8 badges to reach the Indigo Plateau.' }));
    if (!refs.mGyms.childElementCount) refs.mGyms.appendChild(h('p', { class: 'empty', text: 'No gyms known yet.' }));
    updateMap();
  }

  function updateMap() {
    for (const x of routeBtns) setClass(x.btn, 'no', !(x.meets && TG.canAfford(x.r.cost || 0)));
    for (const x of gymBtns) {
      const ok = TG.canAfford(x.g.cost || 0);
      setClass(x.btn, 'no', !ok || x.btn._unmet);
    }
  }

  function challenge(g) {
    const res = TG.challengeGym(g.id);
    if (res.ok) {
      const lines = [];
      if (g.quote) lines.push((g.leader || g.name).toUpperCase() + ': "' + g.quote + '"');
      if (g.defeatQuote) lines.push('… "' + g.defeatQuote + '"');
      if (g.reward && g.reward.log) lines.push(g.reward.log);
      else if (g.badge) lines.push('You received the ' + g.badge + '!');
      if (g.reward && g.reward.globalMult) lines.push('All RD production ×' + g.reward.globalMult + '.');
      if (g.badgeIndex !== 13) UI.modal({ title: g.badge || (g.leader ? g.leader + ' defeated!' : g.name), lines, buttons: [{ label: 'OK', primary: true }] });
      return;
    }
    if (res.reason === 'requirements') UI.toast('Not yet: ' + (res.reqs || []).filter(r => !r.ok).map(r => r.label).join(', '));
    else if (res.reason === 'cost') UI.toast('Not enough RD to challenge.');
  }

  // ------------------------------------------------------------ lab tab
  function buildLab() {
    const sec = $('#tab-lab');
    sec.innerHTML = `
      <div class="box oak-box"><canvas id="l-oak" width="96" height="96"></canvas>
        <div><h2>PROF. OAK</h2><div class="speech" id="l-speech"></div></div></div>
      <div class="box" id="l-oldman-box" hidden><h2>VIRIDIAN CITY</h2>
        <p class="dim" id="l-oldman-text" style="margin:0 0 8px">An old man is blocking the road. He hasn't had his coffee yet.</p>
        <button class="btn" type="button" id="l-oldman">TALK TO THE OLD MAN</button></div>
      <div class="box"><h2>JOURNAL</h2><div class="log full" id="log-full"></div></div>
      <div class="two-col">
        <div class="box"><h2>TRAINER CARD</h2><dl class="stats" id="l-stats"></dl></div>
        <div class="box settings"><h2>OPTIONS</h2>
          <div class="row"><label for="l-name">NAME</label><input type="text" id="l-name" maxlength="10" autocomplete="off" spellcheck="false"></div>
          <div class="row"><label>SOUND</label><button class="btn small toggle" type="button" id="l-sound">OFF</button></div>
          <div class="row"><label for="l-pal">PALETTE</label><select id="l-pal"></select></div>
          <div class="row"><label>REDUCE MOTION</label><button class="btn small toggle" type="button" id="l-motion">OFF</button></div>
        </div>
      </div>
      <div class="box"><h2>SAVE FILE</h2>
        <textarea class="save" id="l-save" spellcheck="false" autocomplete="off" placeholder="Export puts your save here. Paste a save and press IMPORT to load it."></textarea>
        <div class="row wrap" style="margin-top:8px">
          <button class="btn small" type="button" id="l-export">EXPORT</button>
          <button class="btn small" type="button" id="l-import">IMPORT</button>
          <button class="btn small" type="button" id="l-savenow">SAVE NOW</button>
          <span class="spacer"></span>
          <button class="btn small danger" type="button" id="l-reset">HARD RESET</button>
        </div>
        <p class="dim" id="l-lastsave" style="margin:8px 0 0;font-size:11px"></p>
      </div>`;
    Object.assign(refs, {
      oak: $('#l-oak'), speech: $('#l-speech'), oldBox: $('#l-oldman-box'), oldBtn: $('#l-oldman'), oldText: $('#l-oldman-text'),
      logFull: $('#log-full'), stats: $('#l-stats'), lName: $('#l-name'), lSound: $('#l-sound'), lPal: $('#l-pal'),
      lMotion: $('#l-motion'), lSave: $('#l-save'), lLast: $('#l-lastsave')
    });
    refs.oldBtn.addEventListener('click', () => { if (TG.talkOldMan()) { renderLab(); UI.toast('The old man rambles about the coast...'); } });
    refs.lName.addEventListener('change', () => {
      const v = refs.lName.value.trim().toUpperCase().slice(0, 10);
      const from = S().name;
      S().name = v || 'RED';
      refs.lName.value = S().name;
      renderBadges();
      if (from !== S().name) TG.emit('rename', { from: from, to: S().name });
    });
    refs.lSound.addEventListener('click', () => {
      const st = S();
      st.settings.sound = !st.settings.sound;
      if (st.settings.sound && TG.sfx) { TG.sfx.unlock(); TG.sfx.play('buy'); }
      syncSettings();
    });
    refs.lMotion.addEventListener('click', () => { S().settings.reduceMotion = !S().settings.reduceMotion; applySettings(); });
    refs.lPal.addEventListener('change', () => UI.setPalette(refs.lPal.value));
    $('#l-export').addEventListener('click', () => {
      refs.lSave.value = TG.exportSave();
      refs.lSave.select();
      try { navigator.clipboard && navigator.clipboard.writeText(refs.lSave.value).then(() => UI.toast('Save copied to clipboard.'), () => UI.toast('Save exported below.')); }
      catch (e) { UI.toast('Save exported below.'); }
    });
    $('#l-import').addEventListener('click', () => {
      const v = refs.lSave.value.trim();
      if (!v) { UI.toast('Paste a save string first.'); return; }
      UI.confirm('Import this save? Your current progress will be replaced.', () => {
        if (TG.importSave(v)) { UI.toast('Save imported!'); refs.lSave.value = ''; }
        else UI.toast('That save could not be read.');
      });
    });
    $('#l-savenow').addEventListener('click', () => { if (TG.save()) UI.toast('Saved.'); else UI.toast('Could not save (storage blocked?).'); });
    $('#l-reset').addEventListener('click', () => {
      UI.confirm('HARD RESET: erase ALL progress, including Rare Candy? This cannot be undone.', () => {
        UI.confirm('Really? Prof. Oak will forget you.', () => { TG.hardReset(); UI.toast('A new adventure begins...'); }, 'ERASE');
      }, 'ERASE');
    });
    TG.drawSprite(refs.oak, 'oak', { scale: 6 });
  }

  function syncSettings() {
    const st = S();
    setText(refs.lSound, st.settings.sound ? 'ON' : 'OFF');
    setClass(refs.lSound, 'on', st.settings.sound);
    setText(refs.lMotion, st.settings.reduceMotion ? 'ON' : 'OFF');
    setClass(refs.lMotion, 'on', st.settings.reduceMotion);
    if (document.activeElement !== refs.lName) refs.lName.value = st.name || 'RED';
    const opts = [['rse', 'HOENN'], ['gbc', 'GBC'], ['dmg', 'DMG GREEN']];
    const sig = opts.map(o => o[0]).join(',');
    if (refs.lPal._sig !== sig) {
      refs.lPal._sig = sig;
      refs.lPal.innerHTML = '';
      opts.forEach(([v, l]) => refs.lPal.appendChild(h('option', { value: v, text: l })));
    }
    refs.lPal.value = opts.some(o => o[0] === st.settings.palette) ? st.settings.palette : 'rse';
    // while a system forces a palette (Act 3 glitch), a choice here would silently do nothing
    const locked = !!document.body.dataset.paletteLock;
    refs.lPal.disabled = opts.length < 2 || locked;
    refs.lPal.title = locked ? 'Something is overriding the palette.' : '';
  }

  function renderLab() {
    const st = S();
    syncSettings();
    const avail = TG.oldManAvailable();
    setHidden(refs.oldBox, !avail);
    if (avail) {
      const talked = !!st.flags.oldman;
      refs.oldBtn.disabled = talked;
      setText(refs.oldBtn, talked ? 'HE IS ASLEEP' : 'TALK TO THE OLD MAN');
      setText(refs.oldText, talked ? 'The old man is snoring. Something he said about the coast stays with you.' : 'An old man is blocking the road. He hasn\'t had his coffee yet.');
    }
    TG.drawSprite(refs.oak, 'oak', { scale: 6, corrupt: UI.glitchIntensity() * 0.2 });
    updateLab(true);
  }

  function updateLab(force) {
    const t = Date.now();
    if (!force && t - lastLabStats < 1000) return;
    lastLabStats = t;
    const st = S();
    const rows = [
      ['NAME', st.name], ['PLAYTIME', TG.fmtTime(st.stats.playtime)], ['BADGES', String(st.badges) + (st.elite ? ' + E4 ' + st.elite + '/4' : '')],
      ['POKéDEX', TG.mults.dexCount + ' / ' + DEX_SIZE], ['RD NOW', TG.fmt(st.rd)], ['RD EARNED', TG.fmt(st.rdTotal)],
      ['RD LIFETIME', TG.fmt(st.rdLifetime)], ['TAPS', TG.fmtInt(st.taps)], ['CATCHES', TG.fmtInt(st.stats.catches)],
      ['SHINIES', TG.fmtInt(st.stats.shinies)], ['EVOLUTIONS', TG.fmtInt(st.stats.evolutions)], ['BALLS THROWN', TG.fmtInt(st.stats.ballsThrown)]
    ];
    if (st.prestige && st.prestige.count) rows.push(['RARE CANDY', TG.fmt(st.prestige.rareCandy)]);
    if (!refs.stats._cells || refs.stats._cells.length !== rows.length) {
      refs.stats.innerHTML = '';
      refs.stats._cells = rows.map(r => { const dd = h('dd'); refs.stats.appendChild(h('dt', { text: r[0] })); refs.stats.appendChild(dd); return dd; });
    }
    rows.forEach((r, i) => setText(refs.stats._cells[i], r[1]));
    setText(refs.lLast, st.lastSave ? 'Last saved ' + TG.fmtTime((Date.now() - st.lastSave) / 1000) + ' ago.' : '');
  }

  // ------------------------------------------------------------ settings / palette
  UI.setPalette = function (p) {
    const st = S();
    if (!['rse', 'gbc', 'dmg'].includes(p)) p = 'rse';
    st.settings.palette = p;
    applySettings();
  };

  function applySettings() {
    const st = S();
    const pal = st.settings.palette || 'rse';
    if (document.body.dataset.palette !== pal && !document.body.dataset.paletteLock) document.body.dataset.palette = pal;
    setClass(document.body, 'reduce-motion', !!st.settings.reduceMotion);
    setClass(document.body, 'night', TG.isNight());
    document.body.dataset.act = String(st.act);
    UI.repaint();
    if (refs.lSound) syncSettings();
  }

  // redraw every sprite (after a palette change)
  UI.repaint = function () {
    if (TG.spriteCacheClear) TG.spriteCacheClear();
    drawGrassStatics();
    if (refs.dexCells) refs.dexCells.forEach(c => { c._k = null; });
    if (refs.dDetail) refs.dDetail._sig = null;
    if (refs.oak) TG.drawSprite(refs.oak, 'oak', { scale: 6 });
    UI.markDirty('dex');
    if (active === 'dex') renderTab('dex');
  };

  // ------------------------------------------------------------ toast & modal
  UI.toast = function (text, ms) {
    const t = refs.toast || $('#toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2200);
  };

  UI.modal = function (opts) {
    if (modalOpen) { modalQueue.push(opts); return; }
    modalOpen = true;
    const m = refs.modal || $('#modal');
    m.innerHTML = '';
    const body = h('div', { class: 'body' });
    if (opts.lines) opts.lines.forEach(l => body.appendChild(h('p', { text: l })));
    if (opts.text) body.appendChild(h('p', { text: opts.text }));
    if (opts.node) body.appendChild(opts.node);
    const btns = h('div', { class: 'btns' });
    const close = () => {
      m.hidden = true;
      m.innerHTML = '';
      modalOpen = false;
      if (modalQueue.length) setTimeout(() => UI.modal(modalQueue.shift()), 60);
    };
    (opts.buttons || [{ label: 'OK', primary: true }]).forEach(b => {
      btns.appendChild(h('button', {
        class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), type: 'button',
        onclick: () => { close(); if (b.onClick) b.onClick(); }
      }, b.label));
    });
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true' }, opts.title ? h('h2', { text: opts.title }) : null, body, btns);
    m.appendChild(box);
    m.hidden = false;
    const first = btns.querySelector('.primary') || btns.firstChild;
    if (first) setTimeout(() => first.focus(), 30);
    return close;
  };

  UI.confirm = function (text, onYes, yesLabel) {
    UI.modal({ title: 'ARE YOU SURE?', text, buttons: [{ label: 'CANCEL' }, { label: yesLabel || 'YES', primary: true, danger: true, onClick: onYes }] });
  };

  function showOfflineModal(sum) {
    if (!sum || sum.seconds < 60) return;
    const lines = [];
    lines.push('You were away for ' + TG.fmtTime(sum.seconds) + '.' + (sum.capped ? ' (Progress capped at ' + TG.fmtTime(sum.cap) + '.)' : ''));
    if (sum.rd > 0) lines.push('Your team gathered ' + TG.fmt(sum.rd) + ' RD.');
    if (sum.ballsUsed > 0) lines.push('Poké Balls: +' + TG.fmtInt(sum.balls) + ' gathered, ' + TG.fmtInt(sum.ballsUsed) + ' thrown.' + (S().balls < 1 ? ' The bag is empty.' : ''));
    else if (sum.balls > 0) lines.push('+' + TG.fmtInt(sum.balls) + ' Poké Balls.');
    if (sum.catches > 0) lines.push('Caught ' + TG.fmtInt(sum.catches) + ' Pokémon' + (sum.newSpecies.length ? ', including ' + sum.newSpecies.length + ' new species!' : '.'));
    if (sum.candy > 0) lines.push('The Day Care made ' + TG.fmtInt(sum.candy) + ' candy.');
    if (sum.gb > 0) lines.push('▓' + TG.fmt(sum.gb) + ' Glitch Bytes leaked in.');
    (sum.lines || []).forEach(l => lines.push(l));
    if (sum.mult < 1) lines.push('(Offline rate: ' + TG.fmtPct(sum.mult) + ')');
    UI.modal({ title: 'While you were away…', lines, buttons: [{ label: 'CONTINUE', primary: true }] });
  }

  // ------------------------------------------------------------ credits
  UI.playCredits = function (lines) {
    const st = S();
    const ov = refs.credits || $('#credits');
    ov.innerHTML = '';
    const roll = h('div', { class: 'roll' });
    const art = [
      '+------------------------------+',
      '|                              |',
      '|     T A L L   G R A S S      |',
      '|                              |',
      '+------------------------------+'
    ];
    art.forEach(l => roll.appendChild(h('div', { text: l })));
    roll.appendChild(h('div', { text: ' ' }));
    (lines || []).forEach((l, i) => roll.appendChild(h('div', { class: i === 0 ? 'big' : '', text: TG.fmtLine(l) || ' ' })));
    roll.appendChild(h('div', { text: ' ' }));
    roll.appendChild(h('div', { class: 'big', text: 'HALL OF FAME' }));
    roll.appendChild(h('div', { text: st.name + '  —  POKéDEX ' + TG.mults.dexCount + '/' + DEX_SIZE }));
    roll.appendChild(h('div', { text: 'PLAYTIME ' + TG.fmtTime(st.stats.playtime) }));
    ov.appendChild(roll);
    ov.appendChild(h('div', { class: 'skip', text: 'TAP TO SKIP' }));
    const finish = () => {
      if (ov.hidden) return;
      ov.onpointerdown = ov.onclick = null;
      ov.hidden = true;
      ov.innerHTML = '';
      setClass(ov, 'static', false);
      TG.emit('credits_done');
    };
    const reduce = st.settings.reduceMotion || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setClass(ov, 'static', reduce);
    if (!reduce) {
      const dur = Math.max(18, (roll.childElementCount) * 1.4);
      roll.style.animationDuration = dur + 's';
      roll.addEventListener('animationend', finish);
    }
    // close on click, not pointerdown: hiding the overlay on pointerdown let the tap's click land
    // on whatever button was underneath (e.g. a route's GO on the Map tab)
    ov.onpointerdown = (e) => { e.preventDefault(); };
    ov.onclick = finish;
    ov.hidden = false;
  };

  // ------------------------------------------------------------ debug overlay
  UI.toggleDebug = function () {
    const d = refs.debug || $('#debug');
    if (!d.hidden) { d.hidden = true; clearInterval(debugTimer); return; }
    d.hidden = false;
    TG.fire('debug_menu');
    const draw = () => {
      const info = TG.debugInfo();
      const r = info.rates, m = info.mults;
      const lines = [
        'DEBUG MENU — no, you shouldn\'t be here.',
        '',
        'ACT ' + info.act + '   ROUTE ' + info.route + '   ' + (info.night ? 'NIGHT' : 'DAY'),
        'rd/s        ' + r.rd.toExponential(4),
        'enc/s       ' + r.encounters.toExponential(4),
        'balls/s     ' + r.balls.toExponential(4),
        'candy/s     ' + r.candy.toExponential(4),
        'gb/s        ' + (r.gb || 0).toExponential(4),
        '',
        'dexBonus    x' + m.dexBonus.toFixed(4) + '   (' + m.dexCount + ' caught, ' + m.seenCount + ' seen)',
        'badgeMult   x' + m.badge.toFixed(4),
        'rareCandy   x' + m.rareCandy.toFixed(4),
        'eventMult   x' + m.event,
        'glitchMult  x' + m.glitch,
        'mew         x' + m.mew,
        'global      x' + m.global.toExponential(4),
        'allProducer x' + info.allProducerMult,
        '',
        'tapPower    ' + info.tapPower.toExponential(4) + '  combo x' + info.combo.toFixed(2),
        'tapEncChance ' + (info.tapEncounterChance * 100).toFixed(2) + '%  encMult x' + info.encounterMult,
        'catchMult   x' + info.catchRateMult + '  auto ' + info.autoCatch + '/s  queue ' + info.queueMax,
        'ballCost    x' + info.ballCost + '  shiny 1/' + Math.round(1 / info.shinyChance),
        'offline     cap ' + TG.fmtTime(info.offlineCap) + '  x' + info.offlineMult,
        'nextEvent   ' + info.nextEventIn.toFixed(0) + 's',
        'flags       ' + (info.flags.join(' ') || '-')
      ];
      d.textContent = '';
      d.appendChild(h('button', { class: 'x', type: 'button', onclick: () => UI.toggleDebug() }, 'X'));
      d.appendChild(document.createTextNode(lines.join('\n')));
    };
    draw();
    clearInterval(debugTimer);
    debugTimer = setInterval(draw, 500);
  };

  function bindSecrets() {
    // Konami code
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    window.addEventListener('keydown', e => {
      const k = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === seq[pos]) { pos++; if (pos === seq.length) { pos = 0; UI.toggleDebug(); } }
      else pos = k === seq[0] ? 1 : 0;
      if (e.key === 'Escape') { const d = $('#debug'); if (!d.hidden) UI.toggleDebug(); }
    });
    // 10 quick taps on the title
    refs.title.addEventListener('pointerdown', e => {
      e.preventDefault();
      const t = Date.now();
      S().titleTaps = (S().titleTaps || 0) + 1;
      titleStreak = t - titleLast < 1500 ? titleStreak + 1 : 1;
      titleLast = t;
      if (titleStreak >= 10) { titleStreak = 0; UI.toggleDebug(); }
    });
  }

  // ------------------------------------------------------------ per-tick
  let lastTitleGlitch = 0, lastUiTick = 0;
  function updateActive() {
    switch (active) {
      case 'grass': updateGrass(); break;
      case 'town': updateTown(); break;
      case 'dex': updateDex(); break;
      case 'map': updateMap(); break;
      case 'lab': updateLab(false); break;
      default: break;
    }
  }

  let lastUnlockSig = '', lastUnlockCheck = 0;
  function unlockSig() {
    const st = S();
    let p = 0, u = 0, r = 0, g = 0;
    for (const x of TG.data.producers || []) if (TG.producerVisible(x)) p++;
    for (const x of TG.data.upgrades || []) if (!st.upgrades[x.id] && TG.upgradeAvailable(x)) u++;
    if (st.tabs.map) {
      for (const x of TG.data.routes || []) if (!st.routes[x.id] && TG.meets(x.requires)) r++;
      for (const x of TG.data.gyms || []) { const gs = TG.gymStatus(x); if (gs && gs.meets) g++; }
    }
    return p + '|' + u + '|' + r + '|' + g;
  }
  function checkUnlocks(t) {
    if (t - lastUnlockCheck < 1000) return;
    lastUnlockCheck = t;
    const sig = unlockSig();
    if (sig === lastUnlockSig) return;
    lastUnlockSig = sig;
    UI.markDirty('town', 'map');
    const g = TG.systems && TG.systems.glitch;
    if (g && g.markDirty) g.markDirty();
  }

  function onTick() {
    // the engine may run many catch-up steps in one frame: touch the DOM at most once per ~frame burst
    const t = Date.now();
    if (t - lastUiTick < 40) return;
    lastUiTick = t;
    updateHeader();
    guard('unlocks', () => checkUnlocks(t));
    if (dirty[active]) renderTab(active);
    guard('tick', updateActive);
    const gi = UI.glitchIntensity();
    if (t - lastTitleGlitch > 1800) {
      lastTitleGlitch = t;
      setText(refs.title, gi > 0 ? UI.corrupt('TALL GRASS', gi) : 'TALL GRASS');
    }
  }

  // ------------------------------------------------------------ engine wiring
  function onLoad() {
    encEls.forEach(el => el.remove());
    encEls.clear();
    if (refs.fx) refs.fx.innerHTML = '';
    selectedDex = null;
    if (refs.dDetail) setHidden(refs.dDetail, true);
    rebuildLog();
    applySettings();
    updateTabs();
    renderBadges();
    UI.markDirty();
    UI.showTab(S().settings.tab || 'grass');
  }

  function bindEngine() {
    TG.on('tick', onTick);
    TG.on('log', appendLog);
    TG.on('encounter', e => {
      if (!e) return;
      if (e.type === 'spawn') syncEncounters();
      else if (e.type === 'shoo' || e.type === 'wander') onGone(e.type === 'shoo' ? e.res && e.res.enc : e.enc, e.type);
    });
    TG.on('throw', onThrow);
    TG.on('catch', e => { UI.markDirty('dex'); if (e.isNew) UI.markDirty('town', 'map'); });
    TG.on('dex', () => UI.markDirty('dex', 'town', 'map'));
    TG.on('candy', () => UI.markDirty('dex'));
    TG.on('evolve', () => UI.markDirty('dex', 'town', 'map'));
    TG.on('buy', () => UI.markDirty('town', 'map'));
    TG.on('badge', () => { UI.markDirty(); renderBadges(); });
    TG.on('route', e => {
      UI.markDirty('map', 'grass', 'town', 'lab');
      // someone is waiting in the Lab (the Old Man) and the player hasn't been there since
      if (e && e.type === 'unlock' && TG.oldManAvailable() && !S().flags.oldman && active !== 'lab') {
        const b = $('.tabbtn[data-tab="lab"]');
        if (b) b.classList.add('new');
      }
    });
    TG.on('flag', () => { UI.markDirty(); renderBadges(); });
    TG.on('tabs', name => updateTabs(name));
    TG.on('event', e => {
      if (refs.gEvent) renderEvent();
      const a = e && e.type === 'start' && e.active;
      if (a && a.effect && a.effect.type === 'steal' && active !== 'grass') {
        UI.toast('TEAM ROCKET is raiding your research! FIGHT them on the GRASS tab.', 4000);
        const b = $('.tabbtn[data-tab="grass"]');
        if (b) b.classList.add('new');
      }
    });
    TG.on('noballs', () => UI.toast(S().flags.mart ? 'Out of Poké Balls! Auto-catch is waiting. Buy more in TOWN.' : 'Out of Poké Balls!', 3500));
    TG.on('credits_done', () => { const st = S(); if (st.flags.champion && !st.flags.glitch) TG.fire('post_credits'); });
    TG.on('truck', () => UI.markDirty('grass'));
    TG.on('act', n => { document.body.dataset.act = String(n); UI.markDirty(); });
    TG.on('daynight', () => { setClass(document.body, 'night', TG.isNight()); UI.markDirty('grass', 'map'); });
    TG.on('load', onLoad);
    TG.on('offline', sum => setTimeout(() => showOfflineModal(sum), 0));
    TG.on('credits', p => {
      // let the champion story lines reveal first (max ~40s), then roll
      const started = Date.now();
      const iv = setInterval(() => {
        if ((S().logQueue || []).length && Date.now() - started < 40000) return;
        clearInterval(iv);
        setTimeout(() => UI.playCredits(p && p.lines), 1500);
      }, 250);
    });
  }

  UI.refresh = function () { UI.markDirty(); renderTab(active); };

  // ------------------------------------------------------------ init
  UI.init = function () {
    ensureShell();
    Object.assign(refs, {
      title: $('#title'), rd: $('#rd'), rdps: $('#rdps'), name: $('#hdr-name'), badges: $('#badges'),
      modal: $('#modal'), toast: $('#toast'), credits: $('#credits'), debug: $('#debug')
    });
    buildGrass();
    buildDex();
    buildTown();
    buildMap();
    buildLab();
    document.getElementById('tabbar').addEventListener('click', e => {
      const b = e.target.closest('.tabbtn');
      if (b) UI.showTab(b.dataset.tab);
    });
    refs.badges.addEventListener('click', () => {
      const names = (S().badgeIds || []).map(id => TG.gym(id)).filter(g => g && g.badge).map(g => g.badge);
      UI.toast(names.length ? names.join(' · ') : 'No badges yet. Gyms are on the MAP.', 3500);
    });
    bindSecrets();
    bindEngine();
    rebuildLog();
    applySettings();
    updateTabs();
    renderBadges();
    UI.showTab(S().settings.tab || 'grass');
    updateHeader();
  };
})();
