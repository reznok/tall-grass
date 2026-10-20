/* TALL GRASS — numbers.js
 * Number formatting helpers. Loaded first; also creates the TG namespace.
 *   TG.fmt(n, digits?)  -> "1.23K", "45.6M", "1.23e45"
 *   TG.fmtInt(n)        -> like fmt but floors small numbers (for counters)
 *   TG.fmtRate(n)       -> "1.23K/s"
 *   TG.fmtTime(seconds) -> "1h 02m", "4m 05s", "12s", "3d 4h"
 *   TG.fmtPct(x)        -> "12.5%" (x is a fraction, 0.125)
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.data = TG.data || {};

  var SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  function trimZeros(s) {
    if (s.indexOf('.') < 0) return s;
    return s.replace(/\.?0+$/, '');
  }

  // 3 significant digits for 1 <= x < 1000 (rounding-safe)
  function sig3(x) {
    var s = x.toFixed(2);
    if (parseFloat(s) >= 10) s = x.toFixed(1);
    if (parseFloat(s) >= 100) s = x.toFixed(0);
    return s;
  }

  function fmt(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    if (!isFinite(n)) return n < 0 ? '-∞' : '∞';
    var neg = n < 0;
    var a = Math.abs(n);
    var out;
    if (a < 1000) {
      if (digits === 0 || a >= 100) out = String(Math.floor(a));
      else if (a >= 10) out = trimZeros(a.toFixed(1));
      else out = trimZeros(a.toFixed(digits == null ? 2 : digits));
    } else {
      var tier = Math.floor(Math.log10(a) / 3);
      if (tier < SUFFIXES.length) {
        var scaled = a / Math.pow(1000, tier);
        var str = sig3(scaled);
        if (parseFloat(str) >= 1000) { tier++; str = sig3(scaled / 1000); }
        if (tier < SUFFIXES.length) out = str + SUFFIXES[tier];
      }
      if (!out) {
        var e = Math.floor(Math.log10(a));
        var m = a / Math.pow(10, e);
        if (m >= 9.995) { m /= 10; e++; }
        out = m.toFixed(2) + 'e' + e;
      }
    }
    return (neg ? '-' : '') + out;
  }

  function fmtInt(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    if (Math.abs(n) < 1000) return String(Math.floor(n + 1e-9));
    return fmt(n);
  }

  function fmtRate(n) { return fmt(n) + '/s'; }

  function pad2(x) { return (x < 10 ? '0' : '') + x; }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + pad2(m) + 'm';
    if (m > 0) return m + 'm ' + pad2(s) + 's';
    return s + 's';
  }

  function fmtPct(x) {
    var p = x * 100;
    if (Math.abs(p) >= 1000) return fmt(p) + '%';
    return trimZeros(p.toFixed(p >= 100 ? 0 : 1)) + '%';
  }

  TG.fmt = fmt;
  TG.fmtInt = fmtInt;
  TG.fmtRate = fmtRate;
  TG.fmtTime = fmtTime;
  TG.fmtPct = fmtPct;
})();
