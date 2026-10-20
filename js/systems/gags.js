/* TALL GRASS — js/systems/gags.js
 * Small set-piece jokes that *happen* (not just lines). All optional: the engine never
 * references this file, and ui.js only provides a few neutral hooks (#g-gags strip,
 * #t-shop box, [data-gag] click pass-through, 'route_denied' / 'rename' events,
 * TG.ui.setNameOverride). Text lives in TG.data.story.gags (js/data/story.js).
 *
 * Gags:
 *  - Magikarp salesman (after Route 4): trench-coat chip under the grass -> BUY/NO modal,
 *    500 RD for a guaranteed MAGIKARP (catchRate 1). 11th purchase ever = shiny + Gyarados hint.
 *  - Bike shop (Town, Cerulean unlocked, no bike yet): 1,000,000 RD bicycle that does nothing,
 *    refunded 10 min later as RESEARCH DATA (regret). Thunder Badge -> "the voucher was free".
 *  - Oak "not now": 5 fast taps on the ball counter (once per 3 min).
 *  - The ledge: a JUMP button on Route 1 now and then, +1 RD, 10th jump = LEDGE ENJOYER.
 *  - Team Rocket motto on the raid banner, never finished (no cat). FIGHT! mid-motto complains.
 *  - Snorlax: tapping locked Route 12 on the Map without the POKé FLUTE snores, escalating.
 *  - Joey's Phone Number upgrade: Joey calls every ~5 min, his percentage gains a digit each call.
 *  - 50th Pokémon Center Nurse, DITTO renames you for 10 s, PSYDUCK gives the DEX a headache.
 *  - MOM's Savings Plan (runtime upgrade gag_mom): 10% of RD to savings every ~20 min; Act 3 leaks it back ×2.
 *  - Missed-throw streaks, the name rater (Lab -> NAME).
 *
 * State: TG.state.gags (per run) and TG.state.prestige.gags (survives prestige: karp total, Joey).
 * Dev (console): TG.dev.event(id), TG.dev.gag(name) — see bottom.
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.systems = TG.systems || {};
  TG.data = TG.data || {};

  var CFG = {
    karpPrice: 500, karpShinyAt: 11, karpSpecies: 129,
    salesmanFirst: [120, 240], salesmanEvery: [480, 840], salesmanStay: 90,
    ledgeFirst: [20, 45], ledgeEvery: [40, 100], ledgeStay: 15,
    joeyFirst: 60, joeyEvery: [270, 330],
    momFirst: 120, momEvery: [1080, 1320], momPct: 0.10,
    bikePrice: 1e6, bikeRefundAfter: 600,
    oakTaps: 5, oakWindowMs: 2500, oakCooldown: 180,
    dittoMs: 10000, psyduckMs: 4000
  };
  var JOEY_NAME = "Joey's Phone Number";

  // MOM's Savings Plan: a runtime upgrade (same trick data/glitch.js uses), so no data file changes
  var MOM_UPG = {
    id: 'gag_mom', group: 'flag', name: "MOM's Savings Plan", cost: 1500,
    requires: { badges: 1, producers: {}, flags: [], upgrades: [], dexCount: 0, rdTotal: 0 },
    effect: { type: 'flag', value: 'mom_savings' },
    flavor: 'Every kid needs a nest egg. Every nest egg needs a nest. The nest is locked.',
    desc: 'MOM calls every ~20 min and moves 10% of your RD into savings.'
  };
  function addMomUpgrade() {
    var ups = TG.data.upgrades;
    if (!Array.isArray(ups)) return false;
    if (ups.some(function (u) { return u && u.id === MOM_UPG.id; })) return false;
    ups.push(MOM_UPG);
    return true;
  }
  addMomUpgrade();

  var S = null;
  var lastSec = 0;
  var oakTapTimes = [];
  var motto = null;          // running Rocket motto {i, next, base, done}
  var dittoTimer = 0, psyTimer = 0;
  var refs = {};

  // ------------------------------------------------------------ helpers
  function now() { return Date.now(); }
  function rand(r) { return (r[0] + Math.random() * (r[1] - r[0])) * 1000; }
  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : (d || 0); }
  function lines(key) { var g = (TG.data.story || {}).gags; var a = g && g[key]; return Array.isArray(a) ? a : []; }
  function lineAt(key, i) { var a = lines(key); return a.length ? a[Math.max(0, Math.min(i, a.length - 1))] : ''; }
  var lastPick = {};
  function pickLine(key) {
    var a = lines(key);
    if (!a.length) return '';
    var i = (Math.random() * a.length) | 0;
    if (a.length > 1 && i === lastPick[key]) i = (i + 1) % a.length;
    lastPick[key] = i;
    return a[i];
  }
  function fill(text, vars) {
    return String(text || '').replace(/\{(n|amt|pct)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : m; });
  }
  function say(text, cls, vars) { if (text) TG.log(fill(text, vars), cls || 'sys'); return text; }
  function toast(text, ms) { if (text && TG.ui && TG.ui.toast) TG.ui.toast(TG.fmtLine ? TG.fmtLine(text) : text, ms); }
  function sfx(n) { if (TG.sfx) TG.sfx.play(n); }
  function fmt(n) { return TG.fmt ? TG.fmt(n) : String(Math.floor(n)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function setHidden(e, h) { h = !!h; if (e && e.hidden !== h) e.hidden = h; }

  function G() {
    S = TG.state;
    if (!S) return null;
    var g = S.gags;
    if (!g || typeof g !== 'object') g = S.gags = {};
    var def = {
      karp: 0, karpNo: 0, karpUids: [], salesmanAt: 0, salesmanUntil: 0,
      bike: 0, bikeRefundAt: 0, bikeRefunded: false, bikeFree: false,
      oakAt: 0, oakN: 0,
      ledgeAt: 0, ledgeUntil: 0, ledgeX: 40, ledge: 0,
      motto: 0, snore: 0, joeyAt: 0,
      momAt: 0, momSavings: 0, momCalls: 0, momLeaked: false,
      miss: 0, nurse50: false, ditto: false
    };
    for (var k in def) if (g[k] === undefined) g[k] = Array.isArray(def[k]) ? [] : def[k];
    if (!Array.isArray(g.karpUids)) g.karpUids = [];
    var p = S.prestige || (S.prestige = { count: 0, rareCandy: 0 });
    var life = p.gags;
    if (!life || typeof life !== 'object') life = p.gags = {};
    if (life.karp === undefined) life.karp = 0;
    if (life.karpShiny === undefined) life.karpShiny = false;
    if (life.joey === undefined) life.joey = 0;
    return g;
  }
  function life() { G(); return S.prestige.gags; }

  // ------------------------------------------------------------ DOM (all optional)
  function strip() {
    var s = document.getElementById('g-gags');
    if (!s) {
      var grass = document.getElementById('grass');
      if (!grass || !grass.parentNode) return null;
      s = el('div', 'gag-strip');
      s.id = 'g-gags';
      s.hidden = true;
      grass.parentNode.insertBefore(s, grass.nextSibling);
    }
    return s;
  }

  function renderStrip() {
    var s = strip(), g = G();
    if (!s || !g) return;
    var t = now();
    var want = g.salesmanUntil > t;
    if (want && !refs.salesman) {
      var b = el('button', 'btn gag-chip', null);
      b.type = 'button';
      b.setAttribute('data-gag', 'salesman');
      b.appendChild(el('span', 'gag-ico', '?'));
      b.appendChild(el('span', null, 'A MAN IN A TRENCH COAT'));
      b.addEventListener('click', openSalesman);
      refs.salesman = b;
      s.appendChild(b);
    } else if (!want && refs.salesman) {
      refs.salesman.remove();
      refs.salesman = null;
    }
    setHidden(s, !s.childElementCount);
  }

  function ledgeEl() {
    if (refs.ledge && refs.ledge.isConnected) return refs.ledge;
    var grass = document.getElementById('grass');
    if (!grass) return null;
    var b = el('button', 'ledge', null);
    b.type = 'button';
    b.hidden = true;
    b.setAttribute('data-gag', 'ledge');
    b.setAttribute('aria-label', 'Jump down the ledge');
    b.appendChild(el('span', null, 'JUMP ⤓'));
    b.addEventListener('click', jumpLedge);
    grass.appendChild(b);
    refs.ledge = b;
    return b;
  }
  function renderLedge() {
    var g = G(), b = ledgeEl();
    if (!g || !b) return;
    var on = g.ledgeUntil > now() && S.currentRoute === 'route1';
    if (on) b.style.left = g.ledgeX + '%';
    setHidden(b, !on);
  }

  // ------------------------------------------------------------ 1. Magikarp salesman
  function salesmanAvailable() { return !!(S && S.routes && S.routes.route4); }

  function openSalesman() {
    var g = G(), L = life();
    if (!(g.salesmanUntil > now())) { renderStrip(); return; }
    if (!TG.ui || !TG.ui.modal) { buyKarp(); return; }
    TG.ui.modal({
      title: 'A MAN IN A TRENCH COAT',
      lines: [lineAt('karp_offer', L.karp), 'You have ' + fmt(S.rd) + ' RD.'],
      buttons: [
        { label: 'NO', onClick: function () { declineKarp(); } },
        { label: 'BUY (' + fmt(CFG.karpPrice) + ' RD)', primary: true, onClick: function () { buyKarp(); } }
      ]
    });
  }
  function salesmanLeaves() {
    var g = G();
    g.salesmanUntil = 0;
    g.salesmanAt = now() + rand(CFG.salesmanEvery);
    renderStrip();
  }
  function declineKarp() {
    var g = G();
    g.karpNo++;
    say(pickLine('karp_no'));
    salesmanLeaves();
  }
  function buyKarp() {
    var g = G(), L = life();
    if (!TG.spend(CFG.karpPrice)) {
      say(lineAt('karp_broke', 0));
      toast('Not enough RD.');
      sfx('error');
      salesmanLeaves();
      return false;
    }
    g.karp++;
    L.karp++;
    var shiny = L.karp >= CFG.karpShinyAt && !L.karpShiny;
    if (shiny) L.karpShiny = true;
    var enc = TG.spawnEncounter({ id: CFG.karpSpecies, catchRate: 1, noFlee: true, force: true, shiny: shiny });
    if (enc) g.karpUids.push(enc.uid);
    say(lineAt('karp_buy', L.karp), 'sys', { n: L.karp });
    sfx('buy');
    TG.emit('buy', { kind: 'gag', id: 'magikarp', cost: CFG.karpPrice });
    salesmanLeaves();
    return true;
  }
  function onKarpCatch(e) {
    var g = G(), enc = e && e.enc;
    if (!g || !enc || enc.id !== CFG.karpSpecies) return;
    var i = g.karpUids.indexOf(enc.uid);
    if (i < 0) return;
    g.karpUids.splice(i, 1);
    var L = life();
    L.karpCaught = (L.karpCaught || 0) + 1;
    if (enc.shiny) TG.fire('gags', 'karp_shiny');
    else say(L.karpCaught === 1 ? lineAt('karp_catch', 0) : pickLine('karp_catch'));
  }

  // ------------------------------------------------------------ 2. Bike shop
  function shopVisible() {
    var g = G();
    return !!(g && S.routes.cerulean && !S.flags.bike && !g.bike);
  }
  function renderShop() {
    var box = document.getElementById('t-shop');
    if (!box) return;
    var on = shopVisible();
    setHidden(box, !on);
    if (!on) { box.innerHTML = ''; refs.bikeBtn = null; return; }
    if (refs.bikeBtn && refs.bikeBtn.isConnected) { updateShop(); return; }
    box.innerHTML = '';
    box.appendChild(el('h2', null, 'CERULEAN BIKE SHOP'));
    box.appendChild(el('p', 'dim gag-shop-text', '"A BICYCLE! The finest money can buy. Money is the only way to buy it."'));
    var b = el('button', 'btn', null);
    b.type = 'button';
    b.appendChild(el('span', null, 'BICYCLE'));
    b.appendChild(el('small', null, '1,000,000 RD'));
    b.addEventListener('click', function () {
      if (!TG.canAfford(CFG.bikePrice)) { toast('Not enough RD. Nobody ever has enough RD.'); sfx('error'); return; }
      if (TG.ui && TG.ui.confirm) TG.ui.confirm('A BICYCLE costs 1,000,000 RD. The shop owner is already counting.', buyBike, 'BUY');
      else buyBike();
    });
    box.appendChild(b);
    refs.bikeBtn = b;
    updateShop();
  }
  function updateShop() {
    if (refs.bikeBtn) { var no = !TG.canAfford(CFG.bikePrice); if (refs.bikeBtn.classList.contains('no') !== no) refs.bikeBtn.classList.toggle('no', no); }
  }
  function buyBike() {
    var g = G();
    if (!shopVisible() || !TG.spend(CFG.bikePrice)) return false;
    g.bike = now();
    g.bikeRefundAt = g.bike + CFG.bikeRefundAfter * 1000;
    TG.fire('gags', 'bike_buy');
    sfx('buy');
    toast('You own a bicycle.');
    TG.emit('buy', { kind: 'gag', id: 'bicycle', cost: CFG.bikePrice });
    renderShop();
    TG.save();
    return true;
  }
  function refundBike() {
    var g = G();
    g.bikeRefundAt = 0;
    g.bikeRefunded = true;
    S.rd += CFG.bikePrice;   // a refund, not research: rdTotal/rdLifetime are untouched
    TG.fire('gags', 'bike_refund');
    toast('+1,000,000 RD (regret)', 3000);
  }

  // ------------------------------------------------------------ 3. Oak: not now
  function onBallTap(e) {
    if (e && e.preventDefault) e.preventDefault();
    var g = G(), t = now();
    if (!g) return;
    oakTapTimes = oakTapTimes.filter(function (x) { return t - x < CFG.oakWindowMs; });
    oakTapTimes.push(t);
    if (oakTapTimes.length < CFG.oakTaps) return;
    oakTapTimes = [];
    if (t - g.oakAt < CFG.oakCooldown * 1000) return;
    g.oakAt = t;
    var line = g.oakN === 0 ? lineAt('oak_notnow', 0) : pickLine('oak_notnow');
    g.oakN++;
    say(line, 'oak');
    toast(line, 3000);
    sfx('error');
  }

  // ------------------------------------------------------------ 4. The ledge
  function showLedge(t) {
    var g = G();
    g.ledgeUntil = t + CFG.ledgeStay * 1000;
    g.ledgeX = Math.round(8 + Math.random() * 56);
    renderLedge();
  }
  function jumpLedge(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    var g = G();
    if (!g || !(g.ledgeUntil > now())) { renderLedge(); return; }
    g.ledgeUntil = 0;
    g.ledgeAt = now() + rand(CFG.ledgeEvery);
    g.ledge++;
    TG.addRD(1);
    say(pickLine('ledge'));
    if (TG.ui && TG.ui.floatText) TG.ui.floatText(g.ledgeX + 10, 82, '+1', '');
    sfx('tap');
    if (g.ledge === 10) {
      TG.fire('gags', 'ledge_10');
      toast('★ LEDGE ENJOYER ★', 3500);
      sfx('badge');
    }
    renderLedge();
  }

  // ------------------------------------------------------------ 5. Team Rocket motto
  function onEvent(ev) {
    if (!ev || !S) return;
    if (ev.type === 'start' && ev.event && ev.event.id === 'rocket_raid' && S.activeEvent && S.activeEvent.id === 'rocket_raid') {
      motto = { i: 0, next: now() + 1800, base: S.activeEvent.text, done: false };
    } else if (ev.type === 'end' && motto && ev.event && ev.event.id === 'rocket_raid') {
      if (ev.countered && !motto.done && motto.i > 0) say(lineAt('rocket_cut', 0), 'rival');
      motto = null;
    }
  }
  function stepMotto(t) {
    if (!motto || t < motto.next) return;
    var a = S.activeEvent;
    if (!a || a.id !== 'rocket_raid') { motto = null; return; }
    var seq = lines('rocket_motto');
    var text;
    if (motto.i < seq.length) { text = seq[motto.i]; motto.next = t + 2200; }
    else if (motto.i === seq.length) {
      // the interruption escalates per raid that actually got this far
      var g = G();
      text = lineAt('rocket_cat', g.motto);
      g.motto++;
      motto.done = true;
      motto.next = t + 4000;
    }
    else { a.text = motto.base; motto = null; TG.emit('event', { type: 'update' }); return; }
    motto.i++;
    if (!text) return;
    a.text = TG.fmtLine ? TG.fmtLine(text) : text;
    say(text, 'rival');
    TG.emit('event', { type: 'update' });
  }

  // ------------------------------------------------------------ 6. Snorlax
  function onRouteDenied(e) {
    var g = G();
    if (!g || !e) return;
    var r = TG.route(e.id);
    var needsFlute = r && r.requires && (r.requires.flags || []).indexOf('pokeflute') >= 0;
    if (!needsFlute || S.flags.pokeflute) return;
    var a = lines('snorlax');
    if (!a.length) return;
    var i = g.snore, cyc = Math.min(4, a.length);
    var line = i < a.length ? a[i] : a[a.length - cyc + ((i - a.length) % cyc)];
    g.snore++;
    say(line);
    toast(line, 3000);
  }

  // ------------------------------------------------------------ 7. Youngster Joey
  var joeyId;
  function joeyUpgradeId() {
    if (joeyId !== undefined) return joeyId;
    var u = (TG.data.upgrades || []).find(function (x) { return x && x.name === JOEY_NAME; }) ||
      (TG.data.upgrades || []).find(function (x) { return x && /joey/i.test(x.name || '') && /phone/i.test(x.name || ''); });
    joeyId = u ? u.id : null;
    return joeyId;
  }
  function hasJoey() { var id = joeyUpgradeId(); return !!(id && S.upgrades[id]); }
  function joeyPct(n, room) {
    var pct = '99';
    if (n > 0) {
      var digits = '';
      while (digits.length < n) digits += '1234567890';
      pct = '99.' + digits.slice(0, n);
    }
    if (room > 4 && pct.length > room) pct = pct.slice(0, room - 1) + '…';
    return pct;
  }
  function joeyCall() {
    var L = life();
    var a = lines('joey');
    if (!a.length) return;
    var tpl = a[L.joey % a.length];
    var room = 110 - (tpl.length - '{pct}'.length);
    var line = fill(tpl, { pct: joeyPct(L.joey, room) });
    L.joey++;
    say(line, 'rival');
    toast(line, 4500);
  }

  // ------------------------------------------------------------ 8/9. Nurse, Ditto, Psyduck
  function onBuy(e) {
    var g = G();
    if (!g || !e) return;
    if (e.kind === 'producer' && e.id === 'nursejoy' && (S.producers.nursejoy || 0) >= 50 && !g.nurse50) {
      g.nurse50 = true;
      TG.fire('gags', 'nurse50');
    }
    if (e.kind === 'upgrade' && e.id === joeyUpgradeId()) g.joeyAt = now() + CFG.joeyFirst * 1000;
    if (e.kind === 'upgrade' && e.id === MOM_UPG.id) g.momAt = now() + CFG.momFirst * 1000;
  }
  function onDex(e) {
    if (!e || !e.caught) return;
    if (e.id === 132) ditto();
    else if (e.id === 54) psyduck();
  }
  function ditto() {
    var g = G();
    if (!g || g.ditto) return;
    g.ditto = true;
    say(lineAt('ditto', 0));
    if (TG.ui && TG.ui.setNameOverride) {
      TG.ui.setNameOverride('DITTO');
      var n = document.getElementById('hdr-name');
      if (n) n.classList.add('gag-ditto');
    }
    clearTimeout(dittoTimer);
    dittoTimer = setTimeout(function () {
      if (TG.ui && TG.ui.setNameOverride) TG.ui.setNameOverride(null);
      var n = document.getElementById('hdr-name');
      if (n) n.classList.remove('gag-ditto');
      say(lineAt('ditto', 1));
    }, CFG.dittoMs);
  }
  function psyduck() {
    TG.fire('gags', 'psyduck');
    var b = document.querySelector('.tabbtn[data-tab="dex"]');
    if (!b || b._gagOrig) return;
    b._gagOrig = b.textContent;
    b.textContent = '...';
    b.classList.add('gag-dizzy');
    clearTimeout(psyTimer);
    psyTimer = setTimeout(function () {
      b.textContent = b._gagOrig;
      b._gagOrig = null;
      b.classList.remove('gag-dizzy');
    }, CFG.psyduckMs);
  }

  // ------------------------------------------------------------ 10. MOM's savings
  function momCall() {
    var g = G();
    if (S.flags.glitch || S.act >= 3) { say(pickLine('mom_static')); toast('MOM called.'); return; }
    var amt = Math.floor(Math.max(0, S.rd) * CFG.momPct);
    if (amt < 1) { say(lineAt('mom_broke', 0)); return; }
    S.rd = Math.max(0, S.rd - amt);
    g.momSavings += amt;
    var a = lines('mom_call');
    say(a.length ? a[g.momCalls % a.length] : '', 'sys', { amt: fmt(amt) });
    g.momCalls++;
    toast('MOM called. Savings +' + fmt(amt) + ' RD.', 3000);
  }
  function momLeak() {
    var g = G();
    if (!g || g.momLeaked || !(g.momSavings > 0)) return;
    var amt = g.momSavings * 2;
    g.momLeaked = true;
    g.momSavings = 0;
    TG.addRD(amt);
    say(lineAt('mom_leak', 0), 'sys', { amt: fmt(amt) });
    say(lineAt('mom_leak', 1), 'glitch');
  }

  // ------------------------------------------------------------ 12. Misses, name rater
  function onThrow(res) {
    var g = G();
    if (!g || !res || res.auto || !res.ok) return;
    if (res.caught) { g.miss = 0; return; }
    g.miss++;
    if (g.miss === 10) TG.fire('gags', 'miss10');
    else if (g.miss === 25) TG.fire('gags', 'miss25');
    else if (g.miss === 50) TG.fire('gags', 'miss50');
  }
  function onRename(e) {
    if (!e || !e.to) return;
    var key = 'name_' + String(e.to).toLowerCase().replace(/[^a-z]/g, '');
    if (key === 'name_missingno' && S.flags.glitch) key += '_glitch';
    if (lines(key).length) TG.fire('gags', key);
  }

  // ------------------------------------------------------------ timers (1 Hz)
  function perSecond(t) {
    var g = G();
    if (!g) return;
    // salesman
    if (salesmanAvailable()) {
      if (!g.salesmanAt) g.salesmanAt = t + rand(CFG.salesmanFirst);
      if (!g.salesmanUntil && t >= g.salesmanAt) { g.salesmanUntil = t + CFG.salesmanStay * 1000; g.salesmanAt = 0; }
      if (g.salesmanUntil && t >= g.salesmanUntil) salesmanLeaves();
    }
    renderStrip();
    // ledge (Route 1 only)
    if (S.currentRoute === 'route1') {
      if (!g.ledgeAt && !(g.ledgeUntil > t)) g.ledgeAt = t + rand(CFG.ledgeFirst);
      if (g.ledgeAt && t >= g.ledgeAt && !(g.ledgeUntil > t)) { g.ledgeAt = 0; showLedge(t); }
      if (g.ledgeUntil && t >= g.ledgeUntil) { g.ledgeUntil = 0; g.ledgeAt = t + rand(CFG.ledgeEvery); }
    } else if (g.ledgeUntil) { g.ledgeUntil = 0; g.ledgeAt = 0; }
    renderLedge();
    // Joey never stops calling
    if (hasJoey()) {
      if (!g.joeyAt) g.joeyAt = t + CFG.joeyFirst * 1000;
      if (t >= g.joeyAt) { g.joeyAt = t + rand(CFG.joeyEvery); joeyCall(); }
    }
    // MOM
    if (S.flags.mom_savings) {
      if (!g.momAt) g.momAt = t + CFG.momFirst * 1000;
      if (t >= g.momAt) { g.momAt = t + rand(CFG.momEvery); momCall(); }
    }
    if (S.flags.glitch && g.momSavings > 0 && !g.momLeaked) momLeak();
    // bike
    if (g.bikeRefundAt && t >= g.bikeRefundAt) refundBike();
    if (S.flags.bike && g.bike && !g.bikeFree) { g.bikeFree = true; TG.fire('gags', 'bike_free'); }
    if (refs.bikeBtn || shopVisible()) renderShop();
  }

  function onTick() {
    if (!TG.state) return;
    var t = now();
    if (motto) stepMotto(t);
    if (t - lastSec >= 1000) { lastSec = t; try { perSecond(t); } catch (e) { console.error('[TG] gags', e); } }
  }

  function onLoad() {
    var g = G();
    if (!g) return;
    motto = null;
    // drop karp markers for encounters that no longer exist
    var live = {};
    (S.encounters || []).forEach(function (e) { live[e.uid] = 1; });
    g.karpUids = g.karpUids.filter(function (u) { return live[u]; });
    if (TG.ui && TG.ui.setNameOverride) TG.ui.setNameOverride(null);
    if (refs.salesman) { refs.salesman.remove(); refs.salesman = null; }
    refs.ledge = refs.ledge && refs.ledge.isConnected ? refs.ledge : null;
    renderStrip();
    renderLedge();
    renderShop();
  }

  // ------------------------------------------------------------ init
  var sys = TG.systems.gags = {
    init: function () {
      if (addMomUpgrade() && TG.reindex) TG.reindex();
      else if (TG.upgrade && !TG.upgrade(MOM_UPG.id) && TG.reindex) TG.reindex();
      G();
      TG.on('tick', onTick);
      TG.on('catch', onKarpCatch);
      TG.on('event', onEvent);
      TG.on('route_denied', onRouteDenied);
      TG.on('buy', onBuy);
      TG.on('dex', onDex);
      TG.on('throw', onThrow);
      TG.on('rename', onRename);
      TG.on('glitch', function (e) { if (e && e.type === 'act3') momLeak(); });
      TG.on('load', onLoad);
      TG.on('route', function () { renderLedge(); renderShop(); });
      TG.on('flag', function () { renderShop(); });
      TG.on('tabshow', function (name) { if (name === 'town') renderShop(); });
      var bc = document.getElementById('g-ballcount') || document.querySelector('.ballcount');
      if (bc) {
        bc.addEventListener('click', onBallTap);
        bc.setAttribute('role', 'button');
        bc.classList.add('gag-tappable');
      }
      onLoad();
    },
    // exposed for tests / other systems
    openSalesman: openSalesman, buyKarp: buyKarp, joeyCall: joeyCall, momCall: momCall, momLeak: momLeak,
    joeyPct: joeyPct, config: CFG
  };

  // ------------------------------------------------------------ dev shortcuts (console only)
  TG.dev = Object.assign(TG.dev || {}, {
    event: function (id) { return TG.startEvent ? TG.startEvent(id) : false; },
    gag: function (name, arg) {
      var g = G(), t = now();
      switch (name) {
        case 'salesman': S.routes.route4 = true; g.salesmanUntil = t + CFG.salesmanStay * 1000; renderStrip(); openSalesman(); return true;
        case 'karp': life().karp = +arg || 0; return life().karp;
        case 'ledge': if (S.currentRoute !== 'route1') { S.routes.route1 = true; TG.setRoute('route1'); } showLedge(t); return true;
        case 'joey': return joeyCall();
        case 'mom': return momCall();
        case 'leak': return momLeak();
        case 'snorlax': return onRouteDenied({ id: 'route12_13' });
        case 'oak': g.oakAt = 0; for (var i = 0; i < CFG.oakTaps; i++) onBallTap(); return true;
        case 'bike': S.routes.cerulean = true; renderShop(); return shopVisible();
        case 'bikeRefund': g.bikeRefundAt = t; return true;
        case 'motto': return TG.startEvent('rocket_raid');
        case 'nurse': g.nurse50 = false; S.producers.nursejoy = Math.max(50, S.producers.nursejoy || 0); onBuy({ kind: 'producer', id: 'nursejoy' }); return true;
        case 'ditto': g.ditto = false; return ditto();
        case 'psyduck': return psyduck();
        default: return Object.keys(g);
      }
    }
  });
})();
