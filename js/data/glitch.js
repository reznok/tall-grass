/* TALL GRASS — js/data/glitch.js (late-game agent)
 * TG.data.glitch: Act 3 content consumed by js/systems/glitch.js and js/systems/sram.js.
 *  - fixed: the first glitch dex entries (#152…), hand-written. The rest (#157…) are generated
 *    procedurally from a save-stable seed (see systems/glitch.js).
 *  - upgrades: glitch upgrades. Same schema as TG.data.upgrades (cost: { gb }), plus
 *    `instability` (added to the Instability bar on purchase). They are appended to
 *    TG.data.upgrades so the engine buys them and aggregates their effects; ui.js keeps
 *    gb-priced upgrades out of the Town tab and systems/glitch.js renders them in the Glitch tab.
 *  - nameSymbols / types / entryBits: building blocks for procedural entries.
 */
window.TG = window.TG || {};
TG.data = TG.data || {};

(function () {
  var G = TG.data.glitch = {};

  G.total = 32; // glitch dex size: #152 .. #183

  // id, dex number, name, types, sprite (null = generated from the base sprite key), entry
  G.fixed = [
    { id: 'missingno', no: 152, name: 'MISSINGNO.', types: ['Bird', 'Normal'], sprite: 'missingno', catchRate: 0.3, baseValue: 5e6,
      entry: 'An entry the POKéDEX was never told about. It is made of the bytes between two other things.' },
    { id: 'g153', no: 153, name: "'M", types: ['Normal'], base: 'missingno', catchRate: 0.2, baseValue: 2e6,
      entry: 'It answers to an apostrophe. Item slot six is always warm after it leaves.' },
    { id: 'g154', no: 154, name: 'h POKé', types: ['Bird', 'Ghost'], base: 'missingno', catchRate: 0.2, baseValue: 2e6,
      entry: 'Half of a word. The other half is still loading.' },
    { id: 'g155', no: 155, name: 'PkMn', types: ['Normal', '???'], base: 'unknown', catchRate: 0.2, baseValue: 2e6,
      entry: 'Two characters wide on the screen and much wider than that everywhere else.' },
    { id: 'g156', no: 156, name: 'ゥ', types: ['???'], base: 'egg', catchRate: 0.2, baseValue: 2e6,
      entry: 'A single character from a font the cartridge does not have.' }
  ];

  G.nameSymbols = ['▓', "'", '.', '4', 'h', 'ゥ', '♀', '♂', 'ド', 'ℓ', 'Ž', '#', 'é', '¤', 'PkMn', 'POKé'];
  G.types = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying',
    'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Bird', '???'];
  G.entryBits = [
    'It was assembled from the leftover bytes of', 'Its cry is the sound of', 'It lives in the space between',
    'Scientists who studied it remember only', 'It appears when the screen scrolls past', 'Its POKéDEX page is a copy of',
    'It weighs exactly as much as', 'It hums at the frequency of'
  ];
  G.entryEnds = [
    'a POKéMON that was deleted before launch.', 'the save battery, slowly.', 'two tiles that should never touch.',
    'the number 255.', 'the edge of the map.', 'an entry with no name.', 'the cartridge contacts.', 'a city that was never finished.'
  ];

  // ---- glitch upgrades (cost in Glitch Bytes). requires.flags ["glitch"] keeps them out of Acts 1–2.
  var list = [];
  function R(o) {
    return { producers: o.producers || {}, badges: 0, flags: ['glitch'].concat(o.flags || []), upgrades: o.upgrades || [], dexCount: 0 };
  }
  function add(id, name, gb, requires, effect, instability, flavor, desc) {
    list.push({ id: id, group: 'glitch', glitch: true, name: name, cost: { gb: gb }, requires: R(requires), effect: effect,
      instability: instability, flavor: flavor, desc: desc });
  }

  // Glitch Byte output (effects.glitchMult)
  add('g_coin_case', 'Coin Case Overflow', 300, {}, { type: 'glitchMult', value: 2 }, 8,
    'The coin counter rolls past 9999 and keeps going somewhere you cannot see.', '▓ output ×2.');
  add('g_item_underflow', 'Item Underflow', 1e4, { upgrades: ['g_coin_case'] }, { type: 'glitchMult', value: 2 }, 10,
    'Toss one more than you have. Now you have all of them.', '▓ output ×2.');
  add('g_bag_255', 'Bag Slot 255', 3e5, { upgrades: ['g_item_underflow'] }, { type: 'glitchMult', value: 2 }, 12,
    'Scroll past CANCEL. The list does not end.', '▓ output ×2.');
  add('g_dock_truck', 'Behind the Truck', 1e7, { upgrades: ['g_bag_255'] }, { type: 'glitchMult', value: 2 }, 14,
    'Where the dock tiles stop being dock tiles.', '▓ output ×2.');
  add('g_select_swap', 'SELECT Swap', 3e8, { upgrades: ['g_dock_truck'] }, { type: 'glitchMult', value: 3 }, 16,
    'Swap the sixth item with the nothing below it.', '▓ output ×3.');
  add('g_ace', 'Arbitrary Code', 1e10, { upgrades: ['g_select_swap'] }, { type: 'glitchMult', value: 3 }, 20,
    'The item list is a program now. You wrote it. Probably.', '▓ output ×3.');

  // Instability decay (effects.instabilityDecay, added to the 0.2/s base)
  add('g_reset_vector', 'Reset Vector', 200, {}, { type: 'instabilityDecay', value: 0.3 }, 0,
    'Hold START, SELECT, A and B. Everything goes back to where it was. Mostly.', 'Instability decays +0.3/s.');
  add('g_checksum', 'Checksum Patch', 2e4, { upgrades: ['g_reset_vector'] }, { type: 'instabilityDecay', value: 0.6 }, 0,
    'The save is valid. The save has always been valid.', 'Instability decays +0.6/s.');
  add('g_soft_reset', 'Soft Reset Ritual', 2e6, { upgrades: ['g_checksum'] }, { type: 'instabilityDecay', value: 1.2 }, 0,
    'Blow on the contacts. It does not help. Do it anyway.', 'Instability decays +1.2/s.');
  add('g_pause', 'Pause Menu Hideout', 2e8, { upgrades: ['g_soft_reset'] }, { type: 'instabilityDecay', value: 2.5 }, 0,
    'Nothing can happen while the menu is open. Something waits politely.', 'Instability decays +2.5/s.');

  // RD and catching, paid in ▓
  add('g_exp_underflow', 'EXP Underflow', 2000, {}, { type: 'allProducerMult', value: 4 }, 10,
    'Level 1 to level 100 in a single step backwards.', 'All producers ×4.');
  add('g_mew_trick', 'The Trainer Fly Trick', 3000, {}, { type: 'catchRateMult', value: 2 }, 6,
    'Fly away mid-battle. The thing you were about to see is still waiting on Route 8.', 'Catch rate ×2.');
  add('g_dex_overflow', 'POKéDEX Overflow', 5e4, {}, { type: 'dexBonusMult', value: 2 }, 8,
    'The counter says 151. The list underneath keeps going.', 'Pokédex bonus ×2.');
  add('g_encounter_flood', 'Tile Seam Walker', 8e4, {}, { type: 'encounterMult', value: 3 }, 10,
    'Walk the line where grass meets water. Things come up from the seam.', 'Encounters ×3.');
  add('g_rare_dupe', 'Rare Candy Dupe', 5e5, { upgrades: ['g_exp_underflow'] }, { type: 'allProducerMult', value: 4 }, 14,
    'One in slot six. One hundred and twenty-eight in slot six.', 'All producers ×4.');
  add('g_cloning', 'PC Box Cloning', 4e7, { upgrades: ['g_rare_dupe'] }, { type: 'allProducerMult', value: 5 }, 18,
    'Pull the power at exactly the right moment. Two of everything.', 'All producers ×5.');

  G.upgrades = list;
  TG.data.upgrades = (TG.data.upgrades || []).concat(list);
})();
