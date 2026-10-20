# TALL GRASS — Design Document

> SPOILER WARNING for the project owner: this document describes the whole game, every layer and every secret. Don't read it if you want to be surprised.

## One-line pitch

An idle/incremental game that starts as a cozy Game Boy-green "tap the tall grass, catch Pokémon, fill the Pokédex" clicker and slowly reveals itself to be running inside a dying Game Boy cartridge, descending through gym badges, the Elite Four, the MissingNo. glitch, Glitch City, and finally the save battery itself.

Tone arc: **cozy → adventurous → unsettling → cosmic/meta**, in the spirit of Universal Paperclips and A Dark Room. The UI itself changes as layers unlock (palette, corruption, new panels).

Platform: single static site (vanilla HTML/CSS/JS, no build step, no dependencies). Works from `file://`, any static host, and installs as a PWA on mobile. Portrait-first responsive layout.

Fan work, non-commercial. Pokémon names/types are used as the theme. All sprite art is original 16×16 pixel art in a 4-shade Game Boy palette, authored for this project (never copied from official sprites).

---

## Resources

| Resource | Symbol | Earned by | Spent on |
|---|---|---|---|
| Research Data | RD | tapping grass, catches, producers | producers, upgrades, routes, gyms |
| Poké Balls | ◓ | Oak hands one out every 20s at start; Poké Mart (after badge 1); ball producers | throwing at encounters |
| Candy (per evolution family) | 🍬 | duplicate catches (1 per catch), Day Care | evolving Pokémon |
| Badges | ★ | beating gyms | gate features (see Acts) |
| Glitch Bytes | ▓ (Act 3) | corrupted producers, glitch catches | glitch upgrades, glitch dex |
| Rare Candy | RC (prestige) | "the battery dies" reset | permanent global multiplier, persists across resets |

Numbers are JS doubles formatted with suffixes (K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc …) then scientific.

## Core loop

1. **Tap the tall grass** (big button/area). Each tap: +RD (tap power) and an encounter roll.
2. **Encounters** appear as sprites standing in the grass (up to 5 queued). Tap one → throw a Poké Ball → catch roll by species `catchRate`. Miss keeps the encounter (it flees after 3 misses). Caught: +RD burst (`baseValue × multipliers`), +1 Candy for that family, Pokédex entry registered.
3. **Producers** (buildings) generate RD/sec. Some also generate encounters/sec or Poké Balls/sec, which is what makes catching idle.
4. **Pokédex multipliers**: every registered species gives a permanent +2% RD. Evolved forms (stage 2: +5%, stage 3: +10%) give more. Shiny registered: that species' bonus is doubled.
5. **Routes** unlock new encounter tables (bought with RD, gated by badges for some).
6. **Gyms** are challenged by paying an RD cost and meeting requirements (dex count / specific types caught). Each badge unlocks a mechanic.
7. Spend, expand, repeat. Hidden triggers fire story beats, events, and act transitions.

Auto-catch: unlocked by an upgrade ("Great Ball Thrower" — a Youngster who throws for you) so late game is fully idle.

## Producers (RD/sec), in unlock order

Cost formula: `cost = baseCost × 1.15^owned`. Numbers are starting points; content agent balances them so each next producer is roughly 10× cost / 8× output of the previous.

| id | Name | Flavor | Notes |
|---|---|---|---|
| bugcatcher | Bug Catcher | "I like shorts! They're comfy and easy to wear!" | base 0.1/s |
| youngster | Youngster | throws rocks; +encounters/sec |
| lass | Lass | "You're a trainer, right?" |
| mart_shelf | Poké Mart Shelf | produces balls/sec (after badge 1) |
| nursejoy | Pokémon Center Nurse | "We hope to see you again!" |
| daycare | Day Care Couple | produces Candy for owned families (after badge 2) |
| bill_pc | Bill's PC | boosts dex bonus |
| safari | Safari Zone Warden | encounters/sec, rare species |
| gamecorner | Game Corner | high RD, random swings |
| silph | Silph Co. Lab | big RD |
| league | Indigo Plateau | huge RD, Act 2 end |
| corrupt_* | (Act 3) corrupted mirror of each producer, pays Glitch Bytes |

## Upgrades

Standard incremental: tiered producer multipliers at 10/25/50/100/200 owned, tap-power upgrades, ball upgrades (Great/Ultra/Master Ball = catch rate multipliers), encounter-rate upgrades, dex-bonus upgrades, offline-time upgrades. Each has a Pokémon-flavored name and one line of flavor text.

## Acts and gates

### Act 1 — The Lab (start → Boulder Badge)
Palette: original DMG Game Boy green. Only "Grass", "Pokédex", "Lab" tabs at first; "Town" appears at first producer affordable; "Map" after Route 1.
Story: Prof. Oak needs you to fill the Pokédex. Route 1 → Viridian → Viridian Forest → Pewter.
- **Boulder Badge** (Brock): unlocks Poké Mart (buy balls, ball producers).

### Act 2 — The Journey (badges 2–8, Elite Four, Champion)
Each badge maps to an HM/feature:
- **Cascade** (Misty): Day Care (candy production), Evolution.
- **Thunder** (Lt. Surge): Bicycle — tap power ×5, tap combo meter.
- **Rainbow** (Erika): HM Cut — routes 9–15, S.S. Anne dock (**the truck** secret appears).
- **Soul** (Koga): HM Surf — water routes, Seafoam, Cinnabar coast (Act 3 door).
- **Marsh** (Sabrina): HM Fly — offline progress cap 2h → 8h, ×2 offline rate.
- **Volcano** (Blaine): Cinnabar Lab — fossils (Omanyte/Kabuto/Aerodactyl), Pokémon Mansion diary pages (Mewtwo foreshadowing). HM Strength.
- **Earth** (Giovanni): Victory Road, Elite Four (4 sequential bosses), Champion (rival). Beating Champion → ASCII **credits roll** over the game. Game "ends". Then the Hall of Fame has one too many entries.
Also: Day/night by real clock (night: Ghost types in Pokémon Tower, Zubat spam joke), Rival events, Team Rocket raids, shiny 1/4096 (sparkle, ×10 value), Snorlax blocks Route 12 until Poké Flute, Mewtwo in Cerulean Cave post-Champion.

### Act 3 — The Glitch (post-Champion)
Door: Surf along Cinnabar's east coast (a "Coast" route) after having talked to the Old Man in Viridian (a dialogue action in the Lab tab that the player must have done). First encounter on that coast is **MISSINGNO.** The UI begins to corrupt: random characters in headers, sprite tiles scrambling, palette flickers. Catching it:
- "The 6th item in your bag has been duplicated ×128" — the player's 6th-purchased producer count jumps ×128 (huge RD jump — the classic glitch, rewarded).
- Hall of Fame corrupts; Pokédex extends past 151: `'M`, `MISSINGNO.` forms, `h POKé`, `PkMn` etc. Glitch dex entries have procedurally corrupted names.
- New currency **Glitch Bytes** (▓). Corrupted producers mirror normal ones, pay ▓. Glitch upgrades are powerful but add **Instability** (a bar). At 100% instability the screen "crashes" for 3s and 10% RD is lost — can be mitigated.
- Text corruption intensity scales with instability. New route: Glitch City.

### Act 4 — The Cartridge (deep post-glitch)
Trigger: Glitch Bytes ≥ threshold → a new panel appears: **"SRAM"** showing a **Save Battery** meter and the save file as hex bytes. The game becomes aware it runs on a cartridge. The battery drains slowly (real-time, in the fiction). When it hits 0 → **"The internal battery has run dry. The game can be played. However, clock-based events will no longer occur. … SAVE FILE DESTROYED."** This is the **prestige**: full reset, except Rare Candies (computed from lifetime RD) which "survived in slot 6". Rare Candy: +10% all production each, compounding. After the first prestige, the player can "Pull the cartridge" voluntarily. Prestige also unlocks GBC palette (color) and shows the battery count on the title.

Deep secrets:
- **Mew under the truck**: on the S.S. Anne dock (after Cut), a truck sprite. Tapping it 50 times with Strength (Volcano Badge) makes it move: Mew. Mew = ×2 global, and its dex entry is the first hint about the cartridge.
- **Konami code** on keyboard / tapping the title 10× on mobile: "DEBUG MENU — no, you shouldn't be here." Shows real internal rates, nothing else. A fun tell.
- Pokédex #000: entry appears after prestige, "???".
- The log occasionally prints the professor's dialogue; after Act 3 someone else starts writing in the log.
- Ending (infinite continues after): complete glitch dex + prestige 10 → "The GAME BOY powers off. … It's a bright, sunny day outside." Then continue.

## Screens / layout

Portrait-first. Top: header with RD counter + rate. Middle: active tab content. Bottom (mobile) / left (desktop): tab bar.

Tabs (appear when unlocked): **Grass** (tap area + encounters + tap stats + story log), **Pokédex** (grid of sprites; unknown = silhouette; tap for entry/evolve), **Town** (producers, upgrades, shop), **Map** (routes, gyms, Elite Four), **Lab** (Oak dialogue/story log, Old Man, settings, save import/export), **Glitch** (Act 3), **SRAM** (Act 4).

Visual style: Game Boy DMG palette by default (#0f380f, #306230, #8bac0f, #9bbc0f), monospace pixel font (system monospace; `Press Start 2P` via Google Fonts optional with fallback). Panels have 2px dark borders like GB menu boxes. Sprites: 16×16 pixel grids rendered to canvas, `image-rendering: pixelated`.

Audio: tiny Web Audio chiptune: square-wave blips for tap, catch, badge jingle, glitch noise. Starts muted until first user gesture; mute toggle in Lab.

## Save / offline

- localStorage key `tallgrass.save.v1`, JSON, autosave every 10 s and on visibility change.
- Offline progress: on load, compute elapsed seconds, cap (2h base, 8h after Fly, 24h after an Act 4 upgrade), grant RD = rate × elapsed × offlineMult (0.5 base, 1.0 after Fly). Auto-catch encounters are simulated. Show "While you were away…" modal.
- Export/import save as base64 string. Hard reset in Lab (with confirm).
- Save versioning with a `v` field and migration function.

## Balancing targets

- First producer affordable in ~10 taps. Second in ~1 min. Boulder Badge at ~10 min active. Each subsequent badge roughly ×2 longer. Champion at ~4–6 hours mostly idle. MissingNo. within the first hour after Champion if the Old Man flag is set. First prestige around 12–24 h total. Nothing should ever hard-stall: every gate has an RD-only path even if slow.
