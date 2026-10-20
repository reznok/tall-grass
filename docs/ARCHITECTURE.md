# TALL GRASS — Architecture & Data Contracts

This is the binding contract between the engine and the data files. Several agents build in parallel against it. **Do not deviate from the schemas; if something is missing, add an optional field and document it here.**

## Tech rules

- Vanilla HTML/CSS/JS. **No build step, no npm, no ES modules** (must work from `file://`). Plain `<script>` tags in `index.html`, in the order listed below.
- One global namespace: `window.TG = window.TG || {}`. Every file attaches to it. Data files attach under `TG.data.*` and `TG.sprites`.
- Modern browser JS is fine (ES2020: optional chaining, `??`, classes, arrow functions). No TypeScript.
- Mobile-first: touch targets ≥ 44px, `touch-action: manipulation`, no hover-only affordances, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- No external network dependencies required to play. Google Fonts allowed only with a local fallback.

## File ownership

| File | Owner | Purpose |
|---|---|---|
| `index.html` | engine | shell, script order, tab skeleton |
| `manifest.json`, `sw.js`, `icon.svg` | engine | PWA install/offline |
| `css/style.css` | engine | all styling, palettes, responsive, glitch effects |
| `js/numbers.js` | engine | `TG.fmt(n)`, `TG.fmtRate(n)` |
| `js/sprite.js` | engine | `TG.drawSprite(canvas, id, opts)` renders 16×16 grids |
| `js/audio.js` | engine | `TG.sfx.play('tap'|'catch'|'miss'|'buy'|'badge'|'glitch'|'evolve'|'shiny')` |
| `js/engine.js` | engine | state, loop, save/load, offline, effects, event bus |
| `js/ui.js` | engine | all DOM rendering |
| `js/main.js` | engine | boot |
| `js/systems/glitch.js`, `js/systems/sram.js` | late-game agent | Acts 3–4 (built after core works) |
| `js/data/pokemon.js` | content | `TG.data.pokemon` (151 species metadata) |
| `js/data/routes.js` | content | `TG.data.routes` |
| `js/data/producers.js` | content | `TG.data.producers` |
| `js/data/upgrades.js` | content | `TG.data.upgrades` |
| `js/data/gyms.js` | content | `TG.data.gyms` (8 gyms + Elite Four + Champion) |
| `js/data/story.js` | content | `TG.data.story` (log lines keyed by trigger) + `TG.data.events` |
| `js/data/sprites_a.js` | sprites agent A | `TG.sprites[1..50]` |
| `js/data/sprites_b.js` | sprites agent B | `TG.sprites[51..100]` |
| `js/data/sprites_c.js` | sprites agent C | `TG.sprites[101..151]` + `TG.sprites.unknown`, `TG.sprites.truck`, `TG.sprites.oak`, `TG.sprites.ball`, `TG.sprites.missingno` |
| `js/data/terrain.js` | content | `TG.data.terrain` — per-area tap-area backgrounds (see "Terrain additions") |

Script order in `index.html`:
```
numbers.js, sprite.js, audio.js,
data/sprites_a.js, data/sprites_b.js, data/sprites_c.js, data/terrain.js,
data/pokemon.js, data/routes.js, data/producers.js, data/upgrades.js, data/gyms.js, data/story.js,
engine.js, systems/glitch.js, systems/sram.js, ui.js, main.js
```
(`systems/*.js` may be absent in phase 1; engine must not crash if `TG.systems` is undefined.)

---

## Sprite format

`TG.sprites[key]` = array of **16 strings of 16 chars**. Chars:
- `.` transparent
- `1` lightest shade
- `2` mid shade
- `3` darkest shade (outline)

Example (a ball):
```js
TG.sprites.ball = [
"................",
"......3333......",
"....33111133....",
"...3111111113...",
"..311111111113..",
"..311111111113..",
".31111111111113.",
".33333333333333.",
".33333223333333.",
".32222232222223.",
"..322223222223..",
"..322222222223..",
"...3222222223...",
"....33222233....",
"......3333......",
"................",
];
```
Sprites must be **original art** drawn for this project: recognizable silhouettes in the spirit of Gen 1, not copies. Face right or front. Use `3` for outlines, `2` for shading, `1` for highlights/body. Keep 1–2 px margin where possible.

Renderer: `TG.drawSprite(canvasEl, key, {scale=3, palette='dmg'|'shiny'|'glitch'|'silhouette', corrupt=0..1, ramp?})`. Palette shades map to CSS variables `--c0..--c3`. Optional `ramp: [light, mid, dark]` (hex) overrides the shade mapping in colour (Hoenn) mode; in the 4-shade palettes it falls back to `'light'`. `TG.spriteDataURL(keyOrGrid, opts)` takes the same options.

---

## Data schemas

All ids are lowercase snake_case strings unless noted. All numbers are plain JS numbers.

### Pokémon — `TG.data.pokemon` (array, index order = dex order, 151 entries)
```js
{
  id: 25,                 // dex number 1..151
  name: "Pikachu",
  types: ["Electric"],    // 1 or 2 of: Normal Fire Water Grass Electric Ice Fighting Poison Ground Flying Psychic Bug Rock Ghost Dragon
  family: "pichu_line",   // shared by all members of an evolution family; candy is per family. Use the base form's lowercase name, e.g. "pikachu"
  stage: 1,               // 1 base, 2 first evo, 3 second evo
  evolvesTo: 26,          // id or null
  candyToEvolve: 50,      // candy needed for THIS species to evolve into evolvesTo; null if none. Typical: 12/25/50/100/400 (Magikarp)
  rarity: 2,              // 1 common, 2 uncommon, 3 rare, 4 very rare, 5 legendary
  catchRate: 0.55,        // 0..1 base chance per ball
  baseValue: 60,          // RD granted on catch before multipliers. Scale with rarity and dex position (roughly 10 × 1.06^id × rarityMult)
  entry: "When several of these POKéMON gather, their electricity could build and cause lightning storms.", // short dex flavor, ORIGINAL text, not copied from the games
  legendary: false
}
```
Fossils (138–142), legendaries (144–146, 150), Mew (151) have `rarity: 4|5` and appear only via special sources (see routes `special`).

### Routes — `TG.data.routes` (array, unlock order)
```js
{
  id: "route1",
  name: "Route 1",
  act: 1,                        // 1..4
  cost: 50,                      // RD to unlock (0 for the starting area "pallet")
  requires: { badges: 0, routes: ["pallet"], flags: [] },  // flags: engine flags like "oldman", "pokeflute", "strength"
  encounters: [ { id: 16, weight: 55 }, { id: 19, weight: 45 } ],
  night: [ { id: 41, weight: 100 } ],   // optional: replaces encounters at night (real clock 20:00–06:00)
  encounterRateMult: 1.0,        // optional
  flavor: "Tall grass sways between Pallet and Viridian.",
  special: null                  // or "truck" | "coast" | "glitch_city" | "cerulean_cave" | "cinnabar_lab" | "pokemon_tower" — engine hooks
}
```
Water routes need `flags: ["surf"]`, Cut routes `flags: ["cut"]`. Route 12 needs `flags: ["pokeflute"]`. The "coast" route needs `["surf","champion"]` and the engine only spawns MissingNo. there if flag `oldman` is set.

### Producers — `TG.data.producers` (array, unlock order)
```js
{
  id: "bugcatcher",
  name: "Bug Catcher",
  baseCost: 15,
  costMult: 1.15,
  rd: 0.1,                // RD/sec per unit (may be 0)
  encounters: 0,          // encounters/sec per unit (may be 0)
  balls: 0,               // Poké Balls/sec per unit
  candy: 0,               // candy/sec per unit, distributed round-robin across owned families
  unlock: { badges: 0, routes: ["route1"], producers: {}, rdTotal: 0 },  // visible when met; producers: {id: minOwned}
  flavor: "I like shorts! They're comfy and easy to wear!",
  desc: "Catches bugs. Writes it down."
}
```

### Upgrades — `TG.data.upgrades` (array)
```js
{
  id: "bugnet_1",
  name: "Bug Net",
  cost: 200,                       // RD (or { gb: 50 } for Glitch Bytes in Act 3 — engine supports cost as number OR {rd, gb, balls})
  requires: { producers: { bugcatcher: 10 }, badges: 0, flags: [], upgrades: [], dexCount: 0 },
  effect: { type: "producerMult", target: "bugcatcher", value: 2 },
  flavor: "Twice the bugs. Twice the comfy.",
  desc: "Bug Catchers produce ×2."
}
```
Effect types the engine implements (use only these):
- `producerMult` {target, value} — multiply a producer's output
- `allProducerMult` {value}
- `tapMult` {value} — tap power ×value
- `tapAddRate` {value} — tap also grants value × (RD/sec) per tap (Cookie Clicker "cursor" style)
- `encounterMult` {value}
- `catchRateMult` {value}
- `ballCost` {value} — multiplier on ball price (0.8 = 20% cheaper)
- `dexBonusMult` {value} — multiply the Pokédex % bonus
- `candyMult` {value}
- `offlineCap` {value: seconds}, `offlineMult` {value}
- `autoCatch` {value: throws per second}
- `flag` {value: "flagname"} — sets a flag (e.g. "pokeflute", "bike")
- `encounterQueue` {value: +slots}
- `glitchMult`, `instabilityDecay` (Act 3; engine stores them, late-game agent consumes)

### Gyms — `TG.data.gyms` (array, order)
```js
{
  id: "pewter",
  name: "Pewter Gym",
  leader: "Brock",
  badge: "Boulder Badge",
  badgeIndex: 1,                 // 1..8; Elite Four are 9..12 (badge: null), Champion 13
  cost: 2500,                    // RD
  requires: { dexCount: 8, types: { Water: 1, Grass: 1 }, routes: ["viridian_forest"], badges: 0, flags: [] }, // types: at least N registered species with that type
  quote: "I took you for granted.",   // ORIGINAL line in the leader's voice, not copied
  reward: { flags: ["mart"], globalMult: 1.25, unlockTabs: ["town"] , log: "Brock hands you the BOULDER BADGE." },
  spriteKey: null                // optional sprite
}
```
Flags that badges set (engine reads them): `mart`, `daycare`, `bike`, `cut`, `surf`, `fly`, `strength`, `lab_cinnabar`, `victory_road`, `champion`.

### Story & events — `TG.data.story`, `TG.data.events`
```js
TG.data.story = {
  // trigger key -> array of lines (shown in order; each shown once). Engine fires triggers by name.
  start: ["Your name is... whatever you typed in. Prof. OAK has a task for you.", "..."],
  first_tap: ["..."],
  first_catch: ["..."],
  first_producer: ["..."],
  route_unlock: { route1: ["..."], viridian: ["..."] },    // per-route
  badge: { pewter: ["..."], cerulean: ["..."] },           // per-gym
  dex_10: [...], dex_25: [...], dex_50: [...], dex_100: [...], dex_150: [...], dex_151: [...],
  oldman: ["..."],                                         // the Old Man dialogue (Lab tab action)
  truck_found: [...], truck_moved: [...], mew: [...],
  champion: [...], credits: ["TALL GRASS", "...", "THE END"],
  night: [...], shiny: [...],
  rival: ["taunt 1", "taunt 2", ...],                       // random pick
  rocket: ["..."],
  idle_lines: ["random ambient flavor lines", ...],          // shown occasionally
  glitch_first: [...], missingno_caught: [...], glitch_whisper: [...],  // Act 3, someone else writes in the log
  sram_appear: [...], battery_low: [...], battery_dead: [...], prestige_done: [...],
  ending: [...]
};
TG.data.events = [
  { id: "rival", weight: 10, minAct: 1, duration: 0, text: "{rival}",   // {rival} => random story.rival line
    effect: { type: "none" } },
  { id: "rocket_raid", weight: 5, minAct: 2, duration: 60, text: "TEAM ROCKET is stealing your research!",
    effect: { type: "steal", pct: 0.1, counter: "fight", counterLabel: "FIGHT!" } },
  { id: "lucky_egg", weight: 4, minAct: 1, duration: 30, text: "A LUCKY EGG rolls by.", effect: { type: "rdMult", value: 7 } },
  { id: "zubat_swarm", weight: 6, minAct: 2, night: true, duration: 20, text: "Zubat. Zubat. ZUBAT.", effect: { type: "encounterMult", value: 10, forceSpecies: 41 } }
];
```
Event effect types: `none`, `steal` (counterable by tapping a button), `rdMult`, `encounterMult` (optional `forceSpecies`), `freeBalls` {count}, `candyRain` {count}.

---

## Engine API (what ui.js, systems and data may rely on)

```js
TG.state            // the live save state (see below)
TG.rates            // computed per tick: { rd, encounters, balls, candy, gb }
TG.on(event, fn)    // event bus: 'tick', 'catch', 'buy', 'badge', 'route', 'log', 'act', 'event', 'glitch', 'prestige', 'save', 'load'
TG.emit(event, payload)
TG.log(text, cls)   // push to story log (cls: 'oak'|'sys'|'glitch'|'rival')
TG.fire(triggerName, subkey) // show story lines for a trigger once
TG.flag(name) / TG.setFlag(name)
TG.canAfford(cost) / TG.spend(cost)
TG.buyProducer(id, n=1) / TG.buyUpgrade(id) / TG.unlockRoute(id) / TG.challengeGym(id)
TG.tap() / TG.throwBall(encounterIndex) / TG.evolve(speciesId)
TG.save() / TG.load() / TG.exportSave() / TG.importSave(str) / TG.hardReset()
TG.act                // 1..4 current act
TG.prestige()         // Act 4 (stub in phase 1)
TG.isNight()          // 20:00–06:00 local
```

### State shape (`TG.state`)
```js
{
  v: 1, name: "RED", createdAt, lastSave, lastTick,
  rd, rdTotal, rdLifetime,     // lifetime persists across prestige
  balls, gb, instability,
  taps, combo,
  producers: { bugcatcher: 3, ... },
  upgrades: { bugnet_1: true },
  routes: { pallet: true, route1: true }, currentRoute: "route1",
  dex: { 25: { caught: 4, shiny: 0, seen: true } },   // keyed by id
  candy: { pikachu: 12 },
  badges: 1, badgeIds: ["pewter"], elite: 0, champion: false,
  flags: { mart: true },
  encounters: [ { id: 16, shiny: false, misses: 0 } ],
  storyShown: { start: 2 },        // trigger -> lines shown count
  log: [ { t, text, cls } ],       // last 100
  activeEvent: null,
  truckTaps: 0, titleTaps: 0,
  act: 1,
  prestige: { count: 0, rareCandy: 0 },
  settings: { sound: false, palette: "dmg", reduceMotion: false },
  stats: { catches, shinies, evolutions, playtime }
}
```

### Multiplier stack (engine computes in this order)
`rd/sec = Σ(producer.rd × owned × producerMult) × allProducerMult × dexBonus × badgeMult × rareCandyMult × eventMult × glitchMult`
`dexBonus = 1 + (Σ species bonuses) × dexBonusMult` where species bonus = 0.02 (stage1) / 0.05 (stage2) / 0.10 (stage3), ×2 if shiny registered.
`badgeMult = Π gym.reward.globalMult`. `rareCandyMult = 1.1^rareCandy`.
Tap = `1 × tapMult × (bike ? 5 : 1) + tapAddRate × rd/sec`.

---

## UI conventions

- Tabs in `index.html`: `#tab-grass #tab-dex #tab-town #tab-map #tab-lab #tab-glitch #tab-sram`, each a `<section class="tab">`. Tab bar buttons `.tabbtn[data-tab]`. Hidden tabs have `hidden` attribute.
- ui.js renders by diffing minimal text; never rebuild the whole DOM every tick (mobile perf). Full re-render only on structural events (buy/unlock/badge); per-tick update only numbers/bars.
- Palette via CSS variables on `:root` / `body[data-palette="dmg"|"gbc"|"glitch"]`.
- Glitch effects are CSS classes toggled by `js/systems/glitch.js`: `body.glitch-1 .. glitch-3`, text corruption is done by ui.js reading `TG.state.instability` (if `TG.systems?.glitch` exists).

---

## Content additions

Optional fields/keys added by the content agent (all additive; engine may ignore any of them).

**Pokémon** — `evolvesToAlt: [134,135,136]` on Eevee only (valid evolution targets; `evolvesTo` is the default).

**Routes** — extra route `saffron` (Saffron City: dojo Hitmonlee/Hitmonchan, Silph Lapras). Array is sorted by cost, so `ss_anne` (needs `cut`) comes after `celadon`. `route16_17_18` (Cycling Road) requires flag `bike`. `glitch_city.encounters` is `[]` by design. Every species 1–150 appears in at least one table; Mew (151) appears in none (truck secret only).

**Producers**
- `unlock.flags: [flag...]` — all must be set for the producer to be visible (`mart_shelf` → `["mart"]`, `daycare` → `["daycare"]`, `league` → `["victory_road"]`, `corrupt_*` → `["glitch"]`).
- `act: 1 | 3` — `3` marks the Act 3 corrupted mirrors.
- `corrupt_<id>` producers use `cost: { gb: N }` **instead of** `baseCost` (price = `cost.gb × costMult^owned`, paid in Glitch Bytes), output `rd` = normal × 1000, and add `gb: X` (Glitch Bytes/sec per unit) and `mirrorOf: "<id>"`.

**Upgrades**
- `requires.rdTotal` — minimum `state.rdTotal` to show (tap tiers, first encounter upgrade).
- `group` — UI sorting hint: `producer|tap|ball|auto|encounter|dex|candy|offline|flag|queue`.
- Value conventions: `*Mult` effects multiply; `tapAddRate`, `autoCatch`, `encounterQueue` values add up; `offlineCap` value is the new cap in seconds (take the max).
- `research_1..8` are `allProducerMult ×3` at Pokédex counts 10/25/40/55/70/85/100/120. They are the main late-game multiplier. With the specified producer curve, a rough greedy sim puts Brock at ~5–8 min, Erika at ~2 h and Champion at ~4.8 h; without them Champion takes 12 h+.

**Gyms**
- `defeatQuote` — leader's line after losing.
- `title` — "Gym Leader" | "Elite Four" | "Champion".
- `requires.gyms: [gymId...]` — gyms that must already be beaten (Elite Four order: lorelei → bruno → agatha → lance → champion).
- Gym ids are the city names (`pewter`, `cerulean`, … `viridian`) plus `lorelei`, `bruno`, `agatha`, `lance`, `champion`. They share names with some route ids but are a separate namespace, so key `storyShown` by trigger + subkey.

**Story** (`TG.data.story`) — extra optional trigger keys: `first_upgrade`, `first_evolve`, `first_flee`, `offline_return`, `act: {2:[…],3:[…],4:[…]}`, `hall_of_fame` (corrupted list), `instability_crash`, `pull_cartridge`, `dex_0` (#000 entry), `debug_menu`. `route_unlock` and `badge` have an entry for every route/gym id. Line voice conventions: `"OAK: "` prefix = Oak, `"BLUE: "` = rival, lowercase-no-punctuation lines in Act 3/4 keys = the second voice. Helper `TG.data.storyCls(trigger, line)` returns a suggested `TG.log` cls (`oak|rival|glitch|sys`).

**Events** — 4 more: `ditto_disguise` (freeBalls 10), `oldman_lesson` (candyRain 25), `nugget_bridge` (rdMult 3, 45 s, minAct 2), `pikachu_outbreak` (encounterMult 5, forceSpecies 25).

---

## Engine additions

Optional fields/APIs added by the engine (all additive). Late-game systems may rely on them.

**State (`TG.state`) extra fields**
- `tabs: {grass,dex,lab,town?,map?,glitch?,sram?}` — which tabs are unlocked (UI shows `.tabbtn` only for these). Unlock with `TG.unlockTab(name)` (emits `tabs`).
- `settings.tab` (last open tab), `settings.buyAmt` (`1|10|'max'`).
- `ballsBought` (Poké Mart price scaling), `producersEverBought`.
- `logQueue: [{text, cls}]` — story lines waiting to be revealed (one every `TG.config.logLineDelayMs`, 900 ms). `TG.fire` queues; `TG.log` is immediate.
- `acc: {enc, balls, candy, auto, drip}` — fractional accumulators; `candyRR` (round-robin index); `encUid` (next encounter uid).
- `nextEventAt`, `nextIdleAt` (ms timestamps), `lastNight` (bool|null).
- `stats.ballsThrown`, `stats.eventsSeen`, `stats.fled`.
- Encounter objects: `{ uid, id, shiny, misses, catchRate?, noFlee? }` (`catchRate` overrides the species value, `noFlee` disables fleeing — used for Mew).
- `storyShown` keys are `trigger` or `trigger.subkey` (e.g. `badge.cerulean` vs `route_unlock.cerulean`).

**Engine API extras**
- `TG.config` (set before `engine.js` loads to override): `saveKey`, `tickMs`, `autosaveMs`, `eventEverySec`, `idleEverySec`, `logLineDelayMs`, `forceNight` (true/false/null), `noServiceWorker`.
- `TG.mults` — `{dexBonus, badge, rareCandy, event, glitch, mew, extra, global, dexCount, seenCount}`; `TG.effects` — aggregated upgrade effects (`producerMult{}`, `allProducerMult`, `tapMult`, `tapAddRate`, `encounterMult`, `catchRateMult`, `ballCost`, `dexBonusMult`, `candyMult`, `offlineCap`, `offlineMult`, `autoCatch`, `encounterQueue`, `glitchMult`, `instabilityDecay`).
- Hooks for systems: `TG.addEffectSource(fn(effects))` (mutate aggregated effects), `TG.addRateMod(fn() -> mult)` (extra global RD multiplier, lands in `mults.extra`), `TG.addSpawnHook(fn(enc, route) -> enc | null | undefined)` (replace / cancel a spawn — use for MissingNo. on the coast), `TG.invalidate()` (force effect recompute).
- `TG.systems.glitch.rdMult()` (optional) is the `glitchMult` term of the RD stack; `TG.systems.glitch.species(id)` (optional) lets `TG.species()` resolve non-dex ids (e.g. `"missingno"`). `effects.glitchMult` (upgrade effect) multiplies Glitch Byte output, not RD.
- Glitch Bytes: producers with `gb` output add `rates.gb` (× `effects.glitchMult`) to `state.gb` each tick and offline. Producers with `cost: {gb}` are priced in ▓ (`TG.producerCost` returns `{gb: n}` for them; `TG.producerPrice` returns the number; `TG.producerCurrency(id)` → `'rd'|'gb'`).
- Producers with `act` > `state.act` are hidden unless owned.
- Requirements objects may also contain `gyms: [id]`, `upgrades: [id]`, `producers: {id:n}`, `rdTotal`; `TG.reqStatus(req)` → `[{key,label,ok}]`, `TG.meets(req)`.
- Misc: `TG.species(id)`, `TG.route/producer/upgrade/gym(id)`, `TG.spawnEncounter({id, shiny, catchRate, noFlee, force})`, `TG.registerCatch(enc, weight, silent)`, `TG.throwBallUid(uid)`, `TG.evolveTargets(id)` / `TG.evolve(id, targetId)` (Eevee `evolvesToAlt`), `TG.canEvolve(id)`, `TG.evolutionUnlocked()` (flag `daycare`/`evolution` or 2 badges), `TG.buyBalls(n)`, `TG.ballPrice(n)` (20 RD × `ballCost` × (1 + 0.1% per ball ever bought)), `TG.maxAffordable(id)`, `TG.producerVisible(p)`, `TG.upgradeAvailable(u)`, `TG.routeAvailable(r)`, `TG.setRoute(id)`, `TG.gymStatus(g)`, `TG.tapTruck()`, `TG.truckVisible()`, `TG.talkOldMan()`, `TG.oldManAvailable()`, `TG.counterEvent()`, `TG.startEvent(id)`, `TG.applyOffline(seconds)`, `TG.catchUp()`, `TG.newGame()`, `TG.setAct(n)`, `TG.queueLog(text, cls)`, `TG.flushLog()`, `TG.storyRandom(key)`, `TG.fmtLine(text)` (`{name}`, `{rival}`, `{route}`), `TG.debugInfo()`, `TG.start()/stop()/step(dt)`, `TG.addRD(x)`, `TG.distributeCandy(n)`.
- Extra events: `tap`, `throw`, `encounter` (`{type:'spawn'|'throw'}`), `dex`, `candy`, `evolve`, `flag`, `tabs`, `truck`, `drip`, `story`, `daynight`, `offline` (summary object; systems may push strings to `summary.lines` synchronously — the modal is shown on the next task), `credits` (`{lines}`), `credits_done`, `route_enter` (route object; for the glitch agent), `tabshow`, `boot`.
- Story triggers fired by the engine: `start, first_tap, first_catch, first_producer, first_upgrade, first_evolve, first_flee, route_unlock.<route>, badge.<gym>, dex_10/25/50/100/150/151, oldman, truck_found, truck_moved, mew, champion, night, shiny, act.<n>, offline_return, debug_menu`; random: `idle_lines`, `{rival}` in event text. Log cls comes from `TG.data.storyCls` when present.
- Boot order (`main.js`): `TG.init()` → `TG.ui.init()` → `TG.systems[k].init()` for each system → `TG.catchUp()` → `TG.start()`.
- Sprite shades: `'1'→--c1`, `'2'→--c2`, `'3'→--c3`, `'.'` transparent (`--c0` is the background). Extra palette `'light'` (1→c0, 2→c1, 3→c2) is used for the grass texture.

**UI (`TG.ui`)**: `init, showTab(name), markDirty(...tabs), refresh(), toast(text, ms), modal({title, lines|text|node, buttons:[{label, primary, danger, onClick}]}), confirm(text, onYes, yesLabel), corrupt(text, intensity?), glitchIntensity(), setPalette(p), repaint(), playCredits(lines), toggleDebug(), floatText(xPct, yPct, text, cls)`. `#tab-glitch` / `#tab-sram` sections are empty and owned by the systems. Set `document.body.dataset.paletteLock = '1'` to stop `ui.js` from overriding `data-palette` (e.g. while the glitch palette is forced). CSS: `body.glitch-1..3`, `body.crash`, `body.night`, `body.reduce-motion`, `body[data-act]`.

---

## Late-game additions

Acts 3–4, prestige and the ending live in `js/systems/glitch.js`, `js/systems/sram.js` and `js/data/glitch.js` (loaded after `data/story.js`, before `engine.js`). All fields are created on load by each system's `init()` / `load` handler, so old saves migrate without a version bump.

**State (`TG.state`) extra fields**
- `gbLifetime` — Glitch Bytes ever earned this run (ticks, offline, grants). Drives Act 4.
- `glitchDex: {id: 1}` — glitch dex entries registered this run (`missingno`, `g153` … `g183`).
- `glitch: {nextWhisperAt, nextHintAt, crashes, wild, dup}` — whisper/hint timers (ms), crash count, glitch encounters caught in the wild, the ×128 duplication record `{id, from, to}`.
- `prodOrder: [producerId]` — first-purchase order of producers (the "6th item"); older saves get data order of owned producers.
- `battery` (0–100) and `sram: {startedAt, lowFired, nextFlickerAt}` — Save Battery (meaningful once flag `sram` is set).
- `prestige` gains `seed` (save-stable seed for procedural glitch dex names/sprites, survives prestige), `glitchEver: {id: 1}` (entries registered in any run; the ending needs all 32), `pulls`, `lastGain`, `lastMode` (`battery|full|half`), `lastAt`, `ended`.
- Flags: `glitch` (Act 3, MissingNo. caught), `sram` (Act 4), `prestiged`, `gbc` (harmless, set on prestige), `ended`.
- `S.dex` may contain non-numeric ids (`missingno`, `gNNN`) for glitch species seen/caught in the wild; the engine's dex bonus ignores them (not in `TG.data.pokemon`).

**Data — `TG.data.glitch`** (`js/data/glitch.js`): `total` (32), `fixed` (#152 MISSINGNO., #153 'M, #154 h POKé, #155 PkMn, #156 ゥ), `nameSymbols`, `types`, `entryBits/entryEnds`, `upgrades`. Glitch upgrades use the normal upgrade schema with `cost: {gb}`, `requires.flags: ["glitch"]`, plus `glitch: true` and `instability: N` (added on purchase); they are appended to `TG.data.upgrades` so the engine buys them and aggregates their effects (`glitchMult`, `instabilityDecay`, `allProducerMult`, `catchRateMult`, `dexBonusMult`, `encounterMult`). `ui.js` keeps ▓-priced producers and upgrades out of the Town tab.

**Glitch species**: `TG.systems.glitch.species(id)` resolves `missingno` and `g153…g183` (objects with `no`, `name`, `types`, `catchRate`, `baseValue`, `entry`, `glitch: true`, `family: null`). Generated 16×16 grids are registered at runtime as `TG.sprites[id]`. Glitch City's `encounters` table is filled with them at init (weight ∝ 1/(1+i)^0.6).

**Act 3 rules**: on the coast with `surf+champion+oldman` the next spawn is MISSINGNO. (catchRate 0.3, `noFlee`); without `oldman` the log hints every 90–180 s. Catching it: 6th producer ×128 (cap 1e6), +▓128, flag `glitch`, act 3, Glitch tab, palette locked to `glitch` (`body.dataset.paletteLock`; released on prestige). Instability 0–100: +0.5 per corrupted producer bought (max +6 per purchase), +upgrade `instability`, +3 per glitch dex registration, +1 per wild glitch catch, +0.25/s in Glitch City; decays `0.2 + effects.instabilityDecay` per second. ≥10/40/75 → `body.glitch-1/2/3`; 100 → crash (3 s overlay, −10% RD, instability 50). Glitch dex registration costs `50 × 2.2^(registered−1)` ▓; `rdMult() = 1 + 0.01 × registered`. Wild glitch catches pay `5 + 2 s of ▓/s`. A `story.glitch_whisper` line every 2–4 min.

**Act 4 / prestige rules**: Act 4 at `gbLifetime ≥ 1e7` (greedy sim ≈ 2 h after MissingNo., ~3 h for a real player). Battery drains 100% over 8 h online; offline (and hidden-tab) time drains at 50%. ≤15%: `story.battery_low`, `body.bat-low`, a single slow dim (`body.bat-flicker`) every 25–50 s (none with reduced motion). 0%: `story.battery_dead`, unskippable modal, then prestige. Rare Candy gain = `floor((log10(rdLifetime) − 12) × 3)` (min 1 once Act 4 is reached) + `floor(glitchDex / 5)`; half (min 1) when pulling the cartridge in Act 3. Rare Candy multiplies RD (engine `mults.rareCandy`) and ▓ output (effect source on `glitchMult`). Prestige keeps name, settings, stats, `rdLifetime`, `prestige`, `titleTaps`, dex seen-markers, flags `gbc/prestiged/ended`; the start story is skipped and `pull_cartridge`/`prestige_done` fire. After the first prestige: "Pull the cartridge" (SRAM tab in Act 4 = full candy, Glitch tab in Act 3 = half), Pokédex `#000` cell (`story.dex_0`), battery icons in the header. Ending: `prestige.count ≥ 10` and all 32 glitch entries in `glitchEver` → `story.ending` slow-text overlay on `#credits` (`.credits.ending`), flag `ended`, play continues.

**Events emitted**: `glitch` (`{type:'act3', dup}` | `{type:'crash', lost}` | `{type:'act4'}`), `glitchdex` (`{id}`), `prestige` (`{count, gain, mode}`), `credits_done` (after the ending overlay).

**APIs**: `TG.systems.glitch` — `species, rdMult, list, total, dexCount, everCount, registerCost, register(id), addInstability(v), crash(), level(), enterAct3(), checkDoor(), syncPalette(), markDirty()`. `TG.systems.sram` — `prestige(mode?)` (wired to `TG.prestige()`), `pullCartridge(), canPullFull(), canPullHalf(), rareCandyGain(mode), playEnding(), config`. 

**DOM owned by systems**: `#tab-glitch`, `#tab-sram`, `#hdr-gb` (▓ in the header), `#hdr-pbats` (prestige batteries), `#l-hof` (Hall of Fame in the Lab tab, shown after Champion; corrupted extra entries after Act 3), `#dex-000`, `.crash-ov`. Photosensitivity: nothing flashes faster than 3 Hz (crash glyphs re-scramble at 2.5 Hz, `body.glitch-3::after` noise slowed to 2.5 Hz); with reduced motion the crash overlay is static and `body.crash` inversion is skipped.

**Dev shortcuts** (console only, not in the UI): `TG.dev.champion()`, `.coast(oldman=true)`, `.act3()`, `.act4()`, `.battery(pct)`, `.instability(v)`, `.gb(n)`, `.prestigeCount(n)`, `.glitchAll()`, `.ending()`.

---

## Gags additions

`js/systems/gags.js` (loaded after `systems/sram.js`; optional — nothing references it) adds small set-piece jokes. Text lives in `TG.data.story.gags` (one-shots via `TG.fire('gags', key)`, repeatables via `TG.log`; extra tokens `{n}`, `{amt}`, `{pct}` are filled by gags.js).

**State**: `S.gags` (per run: Magikarp salesman timers/uids, bike purchase + refund time, ledge timer/count, Rocket motto count, Snorlax count, Joey/MOM timers, `momSavings`, miss streak, one-shot markers) and `S.prestige.gags` (survives prestige: `karp` purchases ever, `karpShiny`, `karpCaught`, `joey` call index). Timers are ms timestamps, checked once per second.

**Runtime upgrade**: `gag_mom` "MOM's Savings Plan" (1,500 RD, 1 badge, effect `flag: mom_savings`) is appended to `TG.data.upgrades` at load. Every ~20 min it moves 10% of RD into `S.gags.momSavings`; on `glitch {type:'act3'}` the savings come back ×2.

**UI hooks (ui.js)**: `#g-gags` strip under the grass, `#t-shop` box in Town (both owned by gags.js), elements with `[data-gag]` inside `#grass` are not grass taps, `TG.ui.setNameOverride(text|null)`, events `route_denied` `{id, meets}` (Map unlock refused) and `rename` `{from, to}` (Lab name change). `#g-ballcount` is the tappable Poké Ball counter.

**Dev**: `TG.dev.event(id)` (alias of `TG.startEvent`), `TG.dev.gag(name)` with `salesman | karp n | ledge | joey | mom | leak | snorlax | oak | bike | bikeRefund | motto | nurse | ditto | psyduck`.

---

## Active-play additions

Rule: there should always be something the player could be doing; progress is never gated purely by time.

**Engine**
- Tap floor: `TG.tapPower() = (max(flat, pct × rd/sec) + tapAddRate × rd/sec) × combo`, `pct` = 0.02 (0.04 with the bike). `flat` is the old `tapMult × (bike ? 5 : 1)`.
- Catch floor: a hand-thrown catch pays `max(baseValue × global, s × rd/sec)` with `s` = 8 (new species) / 3 (dupe); auto-catch, offline and evolution keep the plain species value. `registerCatch(enc, weight, silent, manual)`; the `catch` event carries `manual`.
- `TG.spend` emits `spend` (`{rd, gb, balls}`). Auto-catch running dry emits `noballs` (and logs `story.auto_noballs`, at most every 3 min).
- New story triggers: `first_encounter`, `town_open`, `map_open`, `post_credits` (fired by ui.js on `credits_done` while Act 3 has not started), `battery_warn`, `instability_warn`, `auto_noballs` (random), `request_new/_done` and `request_new_glitch/_done_glitch` (random).

**OAK'S REQUESTS** (`js/systems/requests.js`, loaded after `systems/gags.js`): exactly one active request in `state.request` `{kind, key, goal, progress, text, voice: 'oak'|'glitch', reward: {type: 'rd'|'balls'|'candy'|'gb', amount, family?, frag?}, uid}`; `state.requestSkipAt` (ms, 2-minute skip cooldown); `stats.requests` (completed, shown on the Trainer Card) and `stats.rcFragments` (cosmetic). Kinds: `catch_type, catch_species, buy_producer, evolve, unlock_route, tap, throw, new_species, spend` — each generated only when reachable (owned routes, visible producers, unlocked tabs). Act 3+: 30% come from the other voice and pay ▓. Card `#g-req` sits under the Grass stats row. API `TG.systems.requests.{current, complete, skip, generate}`.

**UI**: Town producer rows, Map route/gym rows (requirements met, not affordable) and the next-helper teaser (when only RD earned is missing) show a thin saving-up bar (`.bar.prog`).

## Terrain additions

`js/data/terrain.js` (loaded right after `data/sprites_c.js`): `TG.data.terrain = { types, byRoute }`. `byRoute` maps every route id to a type; anything unmapped uses `grass`. Each type: `{ tile: [16 × 16-char strings of . 1 2 3], ramp: [light, mid, dark], ground, groundDmg: null|hex, shadow, hint, label?, indoor? }`. Tiles are original art drawn to repeat seamlessly on the tap area's 48px grid. Types: `grass town forest cave mountain water tower building power road cave_dark plateau safari glitch` (`glitch` is built at load from seeded 8×4 chunks of the other tiles; `plateau` has no route yet).

**UI** (`ui.js` `syncTerrain`): on route change, palette change, repaint and glitch band change (a MutationObserver on `body` class/`data-palette`; nothing per tick) the `#grass` element gets the tile as its background image (`palette: 'light'` + the type's `ramp`; re-rendered once at `corrupt: 0.15` while `body.glitch-2/3`), inline `--grass` (`ground` in colour mode, `groundDmg` in DMG, otherwise the palette's own), inline `--enc-shadow` (colour mode; the encounter ground shadow is `var(--enc-shadow, var(--c1))`), `data-terrain="<type>"`, `.indoor`, an aria-label from `label`, and the first-tap hint from `hint`. Night: `body.night .grass::after` darkens outdoor types only; `.indoor` skips it and the tower gets a purple tint. Nothing animates.
