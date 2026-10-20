/* TALL GRASS — audio.js
 * Tiny Web Audio chiptune blips. TG.sfx.play(name)
 * names: tap catch miss flee buy error badge evolve shiny event glitch
 * The AudioContext is created lazily on the first user gesture and only if
 * TG.state.settings.sound is true (default false).
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  var ctx = null, master = null, gestured = false, lastTap = 0;

  function enabled() { return !!(TG.state && TG.state.settings && TG.state.settings.sound); }

  function ensure() {
    if (!gestured || !enabled()) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.15;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }

  function onGesture() { gestured = true; ensure(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, onGesture, { capture: true, passive: true });
  });

  // square-wave note: f Hz, start offset t (s), duration d (s)
  function tone(f, t, d, opts) {
    opts = opts || {};
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = opts.type || 'square';
    var t0 = ctx.currentTime + (t || 0);
    o.frequency.setValueAtTime(f, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + d);
    var vol = opts.vol == null ? 1 : opts.vol;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + d + 0.02);
  }

  function noise(t, d, vol) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * d));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    var hold = 0, v = 0;
    for (var i = 0; i < len; i++) { if (hold-- <= 0) { v = Math.random() * 2 - 1; hold = (Math.random() * 40) | 0; } data[i] = v; }
    var src = ctx.createBufferSource();
    var g = ctx.createGain();
    src.buffer = buf;
    var t0 = ctx.currentTime + (t || 0);
    g.gain.setValueAtTime(vol || 0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    src.connect(g); g.connect(master);
    src.start(t0);
  }

  var SOUNDS = {
    tap: function () { tone(880 + Math.random() * 80, 0, 0.04, { vol: 0.5 }); },
    catch: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.07, 0.09); }); },
    miss: function () { tone(330, 0, 0.12, { slide: 160 }); },
    flee: function () { tone(440, 0, 0.08); tone(220, 0.08, 0.16, { slide: 110 }); },
    buy: function () { tone(988, 0, 0.05); tone(1319, 0.05, 0.09); },
    error: function () { tone(150, 0, 0.12); tone(110, 0.1, 0.14); },
    badge: function () {
      [523, 523, 523, 659, 784, 0, 659, 784, 1047].forEach(function (f, i) { if (f) tone(f, i * 0.11, 0.14); });
    },
    evolve: function () { tone(220, 0, 0.9, { slide: 1760, vol: 0.7 }); tone(1047, 0.95, 0.25); },
    shiny: function () { [1568, 2093, 2637, 3136].forEach(function (f, i) { tone(f, i * 0.05, 0.08, { vol: 0.5 }); }); },
    event: function () { tone(784, 0, 0.08); tone(587, 0.09, 0.08); tone(784, 0.18, 0.12); },
    glitch: function () {
      noise(0, 0.35, 0.5);
      tone(60 + Math.random() * 400, 0.05, 0.2, { slide: 30 + Math.random() * 2000, vol: 0.4 });
    }
  };

  TG.sfx = {
    play: function (name) {
      if (!enabled()) return;
      if (name === 'tap') { var now = Date.now(); if (now - lastTap < 45) return; lastTap = now; }
      if (!ensure()) return;
      var fn = SOUNDS[name];
      if (!fn) return;
      try { fn(); } catch (e) { /* audio must never break the game */ }
    },
    // call right after the sound setting is switched on (inside the gesture handler)
    unlock: function () { gestured = true; ensure(); },
    // late-game systems may add sounds: fn(ctx, masterGain, tone, noise)
    register: function (name, fn) { SOUNDS[name] = function () { fn(ctx, master, tone, noise); }; }
  };
})();
