/* TALL GRASS — sprite.js
 * Renders 16x16 sprite grids (see ARCHITECTURE.md "Sprite format") to canvas.
 *
 *   TG.drawSprite(canvas, keyOrGrid, { scale=3, palette='dmg'|'shiny'|'glitch'|'silhouette', corrupt=0..1 })
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

  // shade char -> [r,g,b]
  function shadeMap(palette) {
    var c = baseColors();
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

  function renderTile(grid, palette, corrupt) {
    var map = shadeMap(palette);
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

  function getTile(keyOrGrid, palette, corrupt) {
    var grid = getGrid(keyOrGrid);
    var key = Array.isArray(keyOrGrid) ? null : String(keyOrGrid);
    if (!grid) { grid = QMARK; key = '__qmark'; if (palette === 'silhouette') palette = 'dmg'; }
    if (corrupt > 0 || key === null) return renderTile(grid, palette, corrupt || 0);
    var ck = key + '|' + palette;
    var t = tileCache[ck];
    if (!t) t = tileCache[ck] = renderTile(grid, palette, 0);
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
    var t = getTile(keyOrGrid, palette, corrupt);
    ctx.drawImage(t.canvas, 0, 0, 16, 16, 0, 0, size, size);
  }

  function spriteDataURL(keyOrGrid, opts) {
    opts = opts || {};
    var cv = makeCanvas(16, 16);
    drawSprite(cv, keyOrGrid, { scale: opts.scale || 1, palette: opts.palette, corrupt: opts.corrupt });
    return cv.toDataURL();
  }

  function spriteCacheClear() { tileCache = {}; colorCache = null; }

  TG.drawSprite = drawSprite;
  TG.spriteDataURL = spriteDataURL;
  TG.hasSprite = hasSprite;
  TG.spriteCacheClear = spriteCacheClear;
  TG.spriteColors = function () { return baseColors().slice(); };
})();
