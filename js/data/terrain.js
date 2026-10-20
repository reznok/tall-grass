/* TALL GRASS — data/terrain.js
 * Per-area backgrounds for the tap area (#grass). See ARCHITECTURE.md "Terrain additions".
 *
 *   TG.data.terrain = { types: { <type>: {...} }, byRoute: { <routeId>: <type> } }
 *
 * Each type:
 *   tile:     16 strings x 16 chars ('.' transparent = ground, '1' light, '2' mid, '3' dark).
 *             Drawn once at 16x16 and repeated on a 48px grid, so it must tile seamlessly.
 *   ramp:     [light, mid, dark] hex for colour (Hoenn) mode; 4-shade palettes use 'light' (c0/c1/c2).
 *   ground:   background colour under the tile (colour mode).
 *   groundDmg: optional ground for the DMG palette (else the palette's --grass).
 *   hint:     first-tap hint text.  label: aria-label noun.  shadow: encounter ground shadow (colour mode).
 *   indoor:   true -> no night darkening (caves, buildings).
 * Routes not listed in byRoute use 'grass'.
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};
  TG.data = TG.data || {};

  var types = {
    grass: {
      label: 'Tall grass',
      tile: [
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
      ],
      ramp: ['#78d070', '#48a848', '#308838'],
      ground: '#60c058', groundDmg: null, shadow: '#3f9a3f',
      hint: 'TAP THE TALL GRASS'
    },

    // square paving slabs and a little flowerbed
    town: {
      label: 'Town square',
      tile: [
        '1111112.1111112.',
        '1222223.1222223.',
        '1222223.1222223.',
        '1222223.1222223.',
        '1222223.1222223.',
        '1222223.1222223.',
        '2333333.2333333.',
        '................',
        '1111112.........',
        '1222223...1.....',
        '1222223..131..2.',
        '1222223...1.1...',
        '1222223..2.131..',
        '1222223.....1...',
        '2333333...2.....',
        '................'
      ],
      ramp: ['#fbf3dc', '#e2cfa4', '#9a8058'],
      ground: '#bca57c', groundDmg: '#8bac0f', shadow: '#94805c',
      hint: 'TAP TO SEARCH THE TOWN'
    },

    // tree canopies touching side by side, dark floor and trunks between the rows
    forest: {
      label: 'Forest floor',
      tile: [
        '...3333..3333...',
        '..321123321123..',
        '.32111232111223.',
        '3211112221112223',
        '3211122222122223',
        '3221222221222233',
        '3222223222222223',
        '3222232222232223',
        '3322222322222233',
        '.33222333322233.',
        '..333333333333..',
        '......3333......',
        '......3333......',
        '.2....3333...2..',
        '2.2..333333.2.2.',
        '................'
      ],
      ramp: ['#70b450', '#3a7c34', '#173418'],
      ground: '#2c5628', groundDmg: '#8bac0f', shadow: '#1e3e1c',
      hint: 'TAP THE UNDERBRUSH'
    },

    // brown rock floor, a stalagmite, pebbles and cracks
    cave: {
      label: 'Cave floor',
      tile: [
        '................',
        '..........3.....',
        '.2.......313....',
        '.........3123...',
        '...3....31223...',
        '........312223..',
        '.......3112223..',
        '.......31122223.',
        '......311122223.',
        '......333333333.',
        '.12.............',
        '1223............',
        '.33......2.2....',
        '..........3.....',
        '...33.........3.',
        '....333....33...'
      ],
      ramp: ['#c8b498', '#a08868', '#4a3a2e'],
      ground: '#86725a', groundDmg: '#8bac0f', shadow: '#5e4e3e',
      hint: 'TAP THE CAVE FLOOR', indoor: true
    },

    // outside Mt. Moon: boulders, rubble and a one-way ledge
    mountain: {
      label: 'Rocky ground',
      tile: [
        '................',
        '...3333.........',
        '..311223........',
        '.31112223.......',
        '.31122223...33..',
        '.32222233..3123.',
        '..333333...3333.',
        '................',
        '.....2.......2..',
        '................',
        '1111111111111111',
        '2222222222222222',
        '2232222222322222',
        '3333333333333333',
        '................',
        '...2.......3....'
      ],
      ramp: ['#f0d8a8', '#ac8c5c', '#5c4428'],
      ground: '#c8a878', groundDmg: null, shadow: '#9c7c50',
      hint: 'TAP AMONG THE ROCKS'
    },

    // open sea: little wave crests and ripples
    water: {
      label: 'Open water',
      tile: [
        '................',
        '............1...',
        '................',
        '...11...........',
        '..1221..........',
        '.22..22.........',
        '................',
        '..........333...',
        '................',
        '...1............',
        '................',
        '...........11...',
        '..........1221..',
        '.........22..22.',
        '................',
        '...333..........'
      ],
      ramp: ['#f8fcff', '#90d0f8', '#2058b0'],
      ground: '#3888e0', groundDmg: '#306230', shadow: '#2a68b8',
      hint: 'TAP THE WAVES'
    },

    // Pokémon Tower: a gravestone on purple-grey floor tiles
    tower: {
      label: 'Tower floor',
      tile: [
        '...............2',
        '......3333.....2',
        '....33111133...2',
        '...3111111123..2',
        '...3113333123..2',
        '...3111111123..2',
        '...3113333123..2',
        '...3111111223..2',
        '...3111112223..2',
        '...3122222223..2',
        '..333333333333.2',
        '..322222222223.2',
        '..333333333333.2',
        '...............2',
        '...............2',
        '2222222222222222'
      ],
      ramp: ['#d4cce4', '#9a8ab4', '#2e2240'],
      ground: '#6a5a82', groundDmg: null, shadow: '#4a3c60',
      hint: 'TAP BETWEEN THE GRAVES', indoor: true
    },

    // wooden deck / floorboards (S.S. Anne, Game Corner, Silph, the lab)
    building: {
      label: 'Floorboards',
      tile: [
        '1111131111111111',
        '..22.3.....222..',
        '.....3..........',
        '3333333333333333',
        '1111111111111111',
        '...2222.........',
        '...........222..',
        '3333333333333333',
        '1111111111113111',
        '.222........3...',
        '........2...3...',
        '3333333333333333',
        '1111111111111111',
        '.......22222....',
        '..222...........',
        '3333333333333333'
      ],
      ramp: ['#f0c088', '#a86c38', '#5c3818'],
      ground: '#c88c54', groundDmg: null, shadow: '#8c5a30',
      hint: 'TAP THE FLOORBOARDS', indoor: true
    },

    // Power Plant: metal grating with a hazard stripe walkway edge
    power: {
      label: 'Metal grating',
      tile: [
        '................',
        '.333.333.333.333',
        '.222.222.222.222',
        '................',
        '.333.333.333.333',
        '.222.222.222.222',
        '................',
        '.333.333.333.333',
        '.222.222.222.222',
        '................',
        '3333333333333333',
        '1133113311331133',
        '1331133113311331',
        '3311331133113311',
        '3113311331133113',
        '3333333333333333'
      ],
      ramp: ['#f8c820', '#9a9aa6', '#1c1c22'],
      ground: '#5a5a64', groundDmg: '#8bac0f', shadow: '#3a3a44',
      hint: 'TAP THE GRATING', indoor: true
    },

    // Cycling Road: asphalt with a dashed centre line
    road: {
      label: 'Asphalt',
      tile: [
        '................',
        '......2112......',
        '......2112...2..',
        '..3...2112......',
        '......2112......',
        '......2112..3...',
        '.2....2112......',
        '......2112......',
        '......2112......',
        '................',
        '.............2..',
        '...2............',
        '..........3.....',
        '................',
        '.3.......2......',
        '................'
      ],
      ramp: ['#f8f8f0', '#8a8a92', '#44444c'],
      ground: '#6a6a72', groundDmg: '#306230', shadow: '#4a4a52',
      hint: 'TAP THE ROADSIDE'
    },

    // deeper, bluish cave: a Strength boulder and crystals
    cave_dark: {
      label: 'Deep cave',
      tile: [
        '................',
        '....33333.......',
        '..33211223....1.',
        '.3211112223.....',
        '.3211122223.....',
        '32111222223.....',
        '32112222233.....',
        '.322222233......',
        '..33333333......',
        '................',
        '..........3.....',
        '.........313....',
        '........31213...',
        '.......3333333..',
        '..2.............',
        '......2.........'
      ],
      ramp: ['#8a9ac4', '#56628a', '#161a2a'],
      ground: '#363e58', groundDmg: '#306230', shadow: '#20263a',
      hint: 'TAP INTO THE DARK', indoor: true
    },

    // Indigo Plateau: snow drifts with rock poking through
    plateau: {
      label: 'Snowfield',
      tile: [
        '................',
        '..2.............',
        '................',
        '..........111...',
        '........111111..',
        '.......3311123..',
        '.......32222233.',
        '......322223333.',
        '.....22222222222',
        '................',
        '................',
        '...222..........',
        '.22...22........',
        '................',
        '............2...',
        '................'
      ],
      ramp: ['#ffffff', '#b0c0d8', '#5c6c84'],
      ground: '#e4ecf6', groundDmg: null, shadow: '#a8b8d0',
      hint: 'TAP THE SNOW'
    },

    // Safari Zone: tall, yellow savanna tufts
    safari: {
      label: 'Savanna grass',
      tile: [
        '................',
        '..3.....3.......',
        '..23...32.......',
        '...23.32..3.....',
        '.3.2332..32.....',
        '.23.22.332......',
        '..32222223......',
        '...333333.......',
        '................',
        '3.........3.....',
        '2.........23...3',
        '..3........23.32',
        '.32......3.2332.',
        '32.......23.22.3',
        '23........322222',
        '3..........33333'
      ],
      ramp: ['#f0e890', '#b0a440', '#6c6420'],
      ground: '#c4c062', groundDmg: null, shadow: '#949038',
      hint: 'TAP THE SAVANNA GRASS'
    }
  };

  // Glitch City: the other tiles, loaded from the wrong place. Seeded, so it is the same every time.
  function glitchTile() {
    var seed = 0x7a11c17; // fixed
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var src = ['grass', 'town', 'cave', 'water', 'tower', 'building', 'power', 'road', 'forest'].map(function (k) { return types[k].tile; });
    var rows = [];
    var y, x;
    for (y = 0; y < 16; y++) rows.push([]);
    // 8x4 blocks, each copied from a random tile at a random 4px-aligned spot
    for (var by = 0; by < 4; by++) {
      for (var bx = 0; bx < 2; bx++) {
        var t = src[(rnd() * src.length) | 0];
        var sy = ((rnd() * 4) | 0) * 4, sx = ((rnd() * 4) | 0) * 4;
        for (y = 0; y < 4; y++) for (x = 0; x < 8; x++) rows[by * 4 + y][bx * 8 + x] = t[(sy + y) % 16][(sx + x) % 16];
      }
    }
    // two torn rows and a little noise
    [5, 11].forEach(function (ty) { var s = 3 + ((rnd() * 9) | 0); rows[ty] = rows[ty].slice(s).concat(rows[ty].slice(0, s)); });
    for (var i = 0; i < 10; i++) rows[(rnd() * 16) | 0][(rnd() * 16) | 0] = '123'[(rnd() * 3) | 0];
    return rows.map(function (r) { return r.join(''); });
  }
  types.glitch = {
    label: 'Scrambled tiles',
    tile: glitchTile(),
    ramp: ['#e8f0ff', '#c43a8a', '#3a1f5d'],
    ground: '#14061c', groundDmg: null, shadow: '#3a1f5d',
    hint: 'TAP THE TILES'
  };

  TG.data.terrain = {
    types: types,
    byRoute: {
      pallet: 'grass',
      route1: 'grass',
      viridian: 'town',
      route22: 'grass',
      viridian_forest: 'forest',
      route3: 'mountain',
      mt_moon: 'cave',
      route4: 'mountain',
      cerulean: 'town',
      route24_25: 'grass',
      route5_6: 'grass',
      vermilion: 'town',
      route11: 'grass',
      diglett_cave: 'cave',
      route9_10: 'grass',
      rock_tunnel: 'cave',
      lavender: 'tower',
      pokemon_tower: 'tower',
      route8_7: 'grass',
      celadon: 'building',
      ss_anne: 'building',
      saffron: 'building',
      route12_13: 'grass',
      route14_15: 'grass',
      fuchsia: 'town',
      safari_zone: 'safari',
      route16_17_18: 'road',
      route19_20_seafoam: 'water',
      cinnabar: 'town',
      cinnabar_lab: 'building',
      route21: 'water',
      power_plant: 'power',
      victory_road: 'cave_dark',
      cerulean_cave: 'cave_dark',
      coast: 'water',
      glitch_city: 'glitch'
    }
  };
})();
