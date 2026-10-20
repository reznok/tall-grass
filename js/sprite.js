/* TALL GRASS — sprite.js
 * Renders 16x16 sprite grids (see ARCHITECTURE.md "Sprite format") to canvas.
 *
 *   TG.drawSprite(canvas, keyOrGrid, { scale=3, palette='dmg'|'shiny'|'glitch'|'silhouette'|'light', corrupt=0..1,
 *                                      ramp=[light, mid, dark] hex })
 *     ramp overrides the shade mapping in colour mode (Hoenn); 4-shade palettes use 'light'.
 *   TG.spriteDataURL(keyOrGrid, opts)  -> data: URL (for CSS backgrounds)
 *   TG.hasSprite(key)                  -> bool
 *   TG.spriteCacheClear()              -> call after the body palette changes
 *
 * Shade mapping: '.' transparent, '1' -> --c1, '2' -> --c2, '3' -> --c3 (--c0 is the
 * background colour). Colours are read from CSS variables on <body>, so every
 * body[data-palette] variant is picked up automatically.
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.sprites = TG.sprites || {};

  var QMARK = [
    '................',
    '................',
    '.....333333.....',
    '....33111133....',
    '...3311331133...',
    '...331133.1133..',
    '.....3....1133..',
    '.........31133..',
    '........31133...',
    '.......31133....',
    '.......3113.....',
    '.......3333.....',
    '.......3113.....',
    '.......3113.....',
    '.......3333.....',
    '................'
  ];

  var DEFAULT_COLORS = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];
  var SHINY_TINT = [232, 168, 56];

  var tileCache = {};      // cacheKey -> { canvas, imageData }
  var colorCache = null;   // [[r,g,b] x4]

  function parseColor(str) {
    str = (str || '').trim();
    if (!str) return null;
    if (str[0] === '#') {
      var h = str.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length >= 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      return null;
    }
    var m = str.match(/rgba?\(([^)]+)\)/);
    if (m) {
      var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);
      return [p[0] | 0, p[1] | 0, p[2] | 0];
    }
    return null;
  }

  function baseColors() {
    if (colorCache) return colorCache;
    var cs = null;
    try { cs = document.body ? getComputedStyle(document.body) : null; } catch (e) { cs = null; }
    colorCache = DEFAULT_COLORS.map(function (def, i) {
      var v = cs ? cs.getPropertyValue('--c' + i) : '';
      return parseColor(v) || parseColor(def);
    });
    return colorCache;
  }

  function mix(a, b, t) {
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  // ---- full-colour mode (Gen 3 look): sprites are tinted by primary type, named sprites by key.
  // Each ramp is [light '1', mid '2', dark '3'].
  var TYPE_RAMPS = {
    Normal:   ['#e8d8b8', '#a89070', '#403020'],
    Fire:     ['#f8a048', '#d84820', '#481808'],
    Water:    ['#68b0f8', '#2860c0', '#102858'],
    Grass:    ['#88d858', '#389038', '#184018'],
    Electric: ['#f8e048', '#d8a010', '#504008'],
    Ice:      ['#b8f0f8', '#58b8d8', '#204858'],
    Fighting: ['#e0a070', '#b04828', '#402010'],
    Poison:   ['#c080e0', '#8038a8', '#301048'],
    Ground:   ['#e8c878', '#b08838', '#403010'],
    Flying:   ['#c8b8f0', '#8878c8', '#302858'],
    Psychic:  ['#f898c0', '#d83878', '#501028'],
    Bug:      ['#c8d858', '#789028', '#303810'],
    Rock:     ['#d0c098', '#907850', '#382c18'],
    Ghost:    ['#9888c8', '#584898', '#201838'],
    Dragon:   ['#8890f8', '#4040c8', '#181858']
  };
  var KEY_RAMPS = {
    ball:      ['#f8f8f8', '#e03838', '#302020'],
    unknown:   ['#e8e8f0', '#8898b8', '#283860'],
    truck:     ['#d8e0e8', '#4878a8', '#202838'],
    oak:       ['#f8f0e8', '#a07858', '#382818'],
    oldman:    ['#f0e0d0', '#8870a0', '#302030'],
    rival:     ['#f8e8d8', '#a05828', '#301810'],
    rocket:    ['#e8e8e8', '#484858', '#101018'],
    missingno: ['#f8f8f8', '#9898a8', '#202030'],
    egg:       ['#f8f8e8', '#a8c878', '#405028'],
    candy:     ['#f8e8f8', '#d848a8', '#502040'],
    badge:     ['#f8e878', '#c89828', '#504010'],
    battery:   ['#e8e8e8', '#8898a8', '#283040'],
    cartridge: ['#c0c0c8', '#7080a0', '#283048']
  };
  var GRASS_RAMP = ['#78d070', '#48a848', '#308838'];

  function colorMode() {
    var p = document.body && document.body.dataset ? document.body.dataset.palette : '';
    return p === 'rse';
  }

  function hexRamp(r) { return { '1': parseColor(r[0]), '2': parseColor(r[1]), '3': parseColor(r[2]) }; }

  // hue-rotate an [r,g,b] by deg — used for shiny variants in colour mode
  function hueRotate(rgb, deg) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h /= 6;
    }
    h = (h + deg / 360) % 1;
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
  }

  // ramp for a sprite key in colour mode, or null to fall back to the 4-shade palette
  function rampFor(key) {
    if (key === null || key === undefined) return null;
    if (KEY_RAMPS[key]) return KEY_RAMPS[key];
    var id = +key;
    if (id > 0 && TG.data && TG.data.pokemon) {
      var sp = TG.data.pokemon[id - 1];
      if (sp && sp.id !== id) sp = TG.data.pokemon.find(function (x) { return x.id === id; });
      var t = sp && sp.types && sp.types[0];
      if (t && TYPE_RAMPS[t]) return TYPE_RAMPS[t];
    }
    return null;
  }

  // a usable [light, mid, dark] ramp, or null
  function validRamp(r) {
    return Array.isArray(r) && r.length === 3 && r.every(function (x) { return !!parseColor(x); }) ? r : null;
  }

  // shade char -> [r,g,b]
  function shadeMap(palette, key, ramp) {
    var c = baseColors();
    if (ramp) {
      if (colorMode()) return hexRamp(ramp);
      palette = 'light';
    }
    if (colorMode()) {
      if (palette === 'light') return hexRamp(GRASS_RAMP);
      var ramp = rampFor(key);
      if (ramp && palette !== 'silhouette' && palette !== 'glitch') {
        var m = hexRamp(ramp);
        if (palette === 'shiny') return { '1': hueRotate(m['1'], 150), '2': hueRotate(m['2'], 150), '3': m['3'] };
        return m;
      }
    }
    switch (palette) {
      case 'silhouette': return { '1': c[3], '2': c[3], '3': c[3] };
      // shiny: shades 1 and 2 swap, both tinted warm
      case 'shiny': return { '1': mix(c[2], SHINY_TINT, 0.55), '2': mix(c[1], SHINY_TINT, 0.35), '3': c[3] };
      case 'glitch': return { '1': c[3], '2': c[0], '3': c[1] };
      case 'light': return { '1': c[0], '2': c[1], '3': c[2] };
      default: return { '1': c[1], '2': c[2], '3': c[3] };
    }
  }

  function getGrid(keyOrGrid) {
    if (Array.isArray(keyOrGrid)) return keyOrGrid;
    if (keyOrGrid === null || keyOrGrid === undefined) return null;
    var g = TG.sprites[keyOrGrid];
    if (Array.isArray(g) && g.length) return g;
    return null;
  }

  function hasSprite(key) { return !!getGrid(key); }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function renderTile(grid, palette, corrupt, key, ramp) {
    var map = shadeMap(palette, key, ramp);
    var cv = makeCanvas(16, 16);
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(16, 16);
    var d = img.data;
    var rows = [];
    var y, x;
    for (y = 0; y < 16; y++) rows.push(String(grid[y] || ''));
    for (y = 0; y < 16; y++) {
      for (x = 0; x < 16; x++) {
        var ch = rows[y][x] || '.';
        if (corrupt > 0 && Math.random() < corrupt) {
          var r = Math.random();
          if (r < 0.45) ch = rows[y][(x + 3 + ((Math.random() * 10) | 0)) % 16] || '.'; // horizontal tear
          else if (r < 0.8) ch = '123'[(Math.random() * 3) | 0];                         // noise
          else ch = rows[(y + 5) % 16][x] || '.';                                         // row shift
        }
        var col = map[ch];
        if (!col) continue;
        var i = (y * 16 + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: cv, imageData: img };
  }

  function getTile(keyOrGrid, palette, corrupt, ramp) {
    var grid = getGrid(keyOrGrid);
    var key = Array.isArray(keyOrGrid) ? null : String(keyOrGrid);
    ramp = validRamp(ramp);
    if (!grid) { grid = QMARK; key = '__qmark'; if (palette === 'silhouette') palette = 'dmg'; }
    if (corrupt > 0 || key === null) return renderTile(grid, palette, corrupt || 0, key, ramp);
    var ck = key + '|' + palette + '|' + (colorMode() ? 'c' : 'm') + '|' + (ramp ? ramp.join(',') : '');
    var t = tileCache[ck];
    if (!t) t = tileCache[ck] = renderTile(grid, palette, 0, key, ramp);
    return t;
  }

  function drawSprite(canvas, keyOrGrid, opts) {
    if (!canvas || !canvas.getContext) return;
    opts = opts || {};
    var scale = opts.scale || 3;
    var palette = opts.palette || 'dmg';
    var corrupt = opts.corrupt || 0;
    var size = 16 * scale;
    if (canvas.width !== size) canvas.width = size;
    if (canvas.height !== size) canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    var t = getTile(keyOrGrid, palette, corrupt, opts.ramp);
    ctx.drawImage(t.canvas, 0, 0, 16, 16, 0, 0, size, size);
  }

  function spriteDataURL(keyOrGrid, opts) {
    opts = opts || {};
    var cv = makeCanvas(16, 16);
    drawSprite(cv, keyOrGrid, { scale: opts.scale || 1, palette: opts.palette, corrupt: opts.corrupt, ramp: opts.ramp });
    return cv.toDataURL();
  }

  function spriteCacheClear() { tileCache = {}; colorCache = null; }

  TG.drawSprite = drawSprite;
  TG.spriteDataURL = spriteDataURL;
  TG.hasSprite = hasSprite;
  TG.spriteCacheClear = spriteCacheClear;
  TG.spriteColors = function () { return baseColors().slice(); };
})();
