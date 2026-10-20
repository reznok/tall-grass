/* TALL GRASS — js/data/upgrades.js (content agent)
 * TG.data.upgrades: array. Schema per docs/ARCHITECTURE.md, plus:
 *  - requires.rdTotal: number (optional, default 0) — lifetime-this-run RD (state.rdTotal) needed to show.
 *  - group: "producer"|"tap"|"ball"|"auto"|"encounter"|"dex"|"candy"|"offline"|"flag"|"queue" (UI sorting hint).
 * Effect value conventions (content intent; engine owns the math):
 *  - *Mult effects multiply together.
 *  - tapAddRate, autoCatch, encounterQueue values ADD to the running total.
 *  - offlineCap value is the NEW cap in seconds (engine should take max(current, value)).
 */
window.TG = window.TG || {};
TG.data = TG.data || {};

(function () {
  var list = [];

  function R(o) {
    return {
      producers: o.producers || {},
      badges: o.badges || 0,
      flags: o.flags || [],
      upgrades: o.upgrades || [],
      dexCount: o.dexCount || 0,
      rdTotal: o.rdTotal || 0
    };
  }
  function add(id, group, name, cost, requires, effect, flavor, desc) {
    list.push({ id: id, group: group, name: name, cost: cost, requires: R(requires), effect: effect, flavor: flavor, desc: desc });
  }

  // ---- Producer tiers: owned 10/25/50/100/200 => ×2, cost = baseCost × 10/50/500/5000/50000
  var OWNED = [10, 25, 50, 100, 200];
  var COSTX = [10, 50, 500, 5000, 50000];
  var tiers = [
    ["bugcatcher", "Bug Catchers", 15, [
      ["Bug Net", "Twice the bugs. Twice the comfy."],
      ["Comfy Shorts", "They are comfy. They are easy to wear. They are mandatory."],
      ["Sweet Honey Jar", "Smear it on a tree. Wait. Write down what arrives."],
      ["Straw Hat Brigade", "A hundred straw hats bobbing through the forest in perfect unison."],
      ["Bug Contest Trophy", "From a contest that will not be held for several more years."]]],
    ["youngster", "Youngsters", 100, [
      ["Smooth Pebbles", "Better rocks. Rounder rocks. Rocks with real potential."],
      ["Top-Percentage Training", "Every RATTATA is above average if you only count the right ones."],
      ["Rock Collection", "Each rock is labeled. Each label says ROCK."],
      ["Slingshot", "Range improved. Accuracy unchanged. Enthusiasm unbounded."],
      ["Joey's Phone Number", "He will call you about his RATTATA. He will call you about his RATTATA."]]],
    ["lass", "Lasses", 1100, [
      ["Pink Binder", "Color-coded notes. The colors are all pink."],
      ["Gossip Network", "Everything that happens on every route reaches her by noon."],
      ["Matching Outfits", "Lasses in matching outfits take notes in matching handwriting."],
      ["Picnic Basket", "Fieldwork goes faster when there are sandwiches."],
      ["Friendship Bracelets", "Every Lass in Kanto is now technically one Lass."]]],
    ["mart_shelf", "Poké Mart Shelves", 12000, [
      ["Stock Clerk", "He has worked here for years. He has never been seen arriving."],
      ["Shelf Labels", "Now you can tell the POKé BALLS apart from the other POKé BALLS."],
      ["Express Checkout", "Ten items or fewer. Everyone has exactly one item."],
      ["Bulk Pallets", "Forklifts. In a Poké Mart. Do not think about the ceiling height."],
      ["Silph Wholesale Contract", "Straight from the factory floor, still warm."]]],
    ["nursejoy", "Nurses", 130000, [
      ["Healing Machine Jingle", "Da-da-da-dum-dum. Productivity rises with every chime."],
      ["Chansey Assistant", "It carries the trays. It carries the clipboard. It carries the place."],
      ["Night Shift", "The Center never closes. Neither, now, do its nurses."],
      ["Cousin Network", "Every town's Nurse is a cousin. There are a lot of cousins."],
      ["Full Restore Drip", "Nobody is tired anymore. Nobody is anything anymore. Very efficient."]]],
    ["daycare", "Day Care Couples", 1.4e6, [
      ["Warm Blankets", "Your POKéMON sleep better and grow faster. So does the couple."],
      ["Second Rocking Chair", "Now they can both watch the yard at the same time."],
      ["Mysterious Egg", "They found it behind the fence. They do not know whose it is either."],
      ["Garden Expansion", "The fence moved outward overnight. Nobody moved it."],
      ["We Raised It Well", "Your POKéMON came back taller, kinder, and slightly too quiet."]]],
    ["bill_pc", "Bill's PCs", 2e7, [
      ["Extra Storage Box", "Box 2 is now available. It was always available. Now you know."],
      ["Teleporter Calibration", "No more accidental half-POKéMON. Probably."],
      ["Cell Separation Patch", "Bill swears this version does not turn you into anything."],
      ["Network Uplink", "Every PC in Kanto now talks to every other PC. They have a lot to say."],
      ["Bill's Sea Cottage", "A quiet place by the sea where all the data goes to sleep."]]],
    ["safari", "Wardens", 3.3e8, [
      ["Bait Bucket", "The POKéMON come closer. The POKéMON get bolder."],
      ["Rock Pile", "For throwing. Gently. Mostly gently."],
      ["Safari Jeep", "Cover the whole zone in an afternoon. Bring sunscreen."],
      ["Gold Teeth", "Returned at last. The Warden can finally pronounce \"Exeggcute\"."],
      ["Extra Rest Houses", "More rest houses, deeper in. Some are not on the map."]]],
    ["gamecorner", "Game Corners", 5.1e9, [
      ["Coin Case", "Holds up to 9,999 coins. Nobody has ever needed more. Yet."],
      ["Lucky Slots", "The third reel is always 7. Do not tell management."],
      ["Loaded Reels", "Not technically cheating if the machine agrees to it."],
      ["Jackpot Lights", "The whole street turns gold every few minutes."],
      ["Back Room Poster", "Behind the poster: a switch. Behind the switch: more profit."]]],
    ["silph", "Silph Labs", 7.5e10, [
      ["Lift Key", "The elevator now visits floors it did not used to visit."],
      ["Card Key", "Every door opens. Even the ones painted on the walls."],
      ["Prototype Ball", "It never misses. Silph would prefer you did not ask how."],
      ["Porygon Project", "A POKéMON made of code, working on other code. Productive."],
      ["Silph Scope", "See what is really there. The researchers wish they hadn't."]]],
    ["league", "Indigo Plateaus", 1e12, [
      ["Victory Fanfare", "Plays every time anyone wins anything anywhere."],
      ["Hall of Fame Plaque", "Your name, engraved. The engraver hesitated before the last letter."],
      ["Champion's Cape", "Heavy. Warm. It still smells like your rival."],
      ["Elite Training Regimen", "The Elite Four train the Elite Four. It is a loop."],
      ["Indigo Torchlight", "The torches on the plateau never go out. Nobody lit them."]]]
  ];
  tiers.forEach(function (t) {
    var pid = t[0], plural = t[1], base = t[2];
    t[3].forEach(function (nf, i) {
      var owned = {}; owned[pid] = OWNED[i];
      add(pid + "_" + (i + 1), "producer", nf[0], base * COSTX[i],
        { producers: owned, upgrades: i ? [pid + "_" + i] : [] },
        { type: "producerMult", target: pid, value: 2 },
        nf[1], plural + " produce ×2.");
    });
  });

  // ---- Tap power (tapMult ×2 at RD milestones)
  var taps = [
    [50, "Sturdy Sneakers", "Good for kicking through grass. Bad for sneaking up on anything."],
    [5000, "Running Shoes", "A gift from Mom. They make a little squeak. The grass hates it."],
    [5e5, "Grass Whistle", "Blow it while you tap. The grass blows back."],
    [5e7, "Focus Band", "Tap with intent. Tap with your whole heart. Tap."],
    [5e9, "Silk Scarf", "Normal-type moves are stronger. Tapping is the most Normal move there is."],
    [5e11, "Choice Band", "You may only do one thing now. You have chosen tapping."]
  ];
  taps.forEach(function (t, i) {
    add("tap_" + (i + 1), "tap", t[1], t[0], { rdTotal: t[0], upgrades: i ? ["tap_" + i] : [] },
      { type: "tapMult", value: 2 }, t[2], "Tap power ×2.");
  });

  // ---- Tap adds a share of RD/sec
  add("tapadd_1", "tap", "Sweet Scent", 5e4, { badges: 1, upgrades: ["tap_2"] },
    { type: "tapAddRate", value: 0.01 }, "Every tap smells like something worth finding.",
    "Each tap also grants 1% of your RD/sec.");
  add("tapadd_2", "tap", "Rustle Technique", 5e7, { badges: 3, upgrades: ["tapadd_1"] },
    { type: "tapAddRate", value: 0.02 }, "A wrist flick taught by a very old Bug Catcher.",
    "Each tap also grants +2% of your RD/sec.");
  add("tapadd_3", "tap", "Grass Knot", 5e10, { badges: 5, upgrades: ["tapadd_2"] },
    { type: "tapAddRate", value: 0.05 }, "You tie the grass into knots. The grass ties you into the research.",
    "Each tap also grants +5% of your RD/sec.");

  // ---- Balls
  add("great_ball", "ball", "GREAT BALL", 5000, { flags: ["mart"] },
    { type: "catchRateMult", value: 1.5 }, "Blue, with red stripes. Slightly greater than a POKé BALL.",
    "Catch rate ×1.5.");
  add("ultra_ball", "ball", "ULTRA BALL", 1e8, { badges: 4, upgrades: ["great_ball"] },
    { type: "catchRateMult", value: 2 }, "Black and yellow. Ultra, in the marketing sense.",
    "Catch rate ×2.");
  add("master_ball", "ball", "MASTER BALL", 1e13, { flags: ["champion"], upgrades: ["ultra_ball"] },
    { type: "catchRateMult", value: 10 }, "It never fails. Silph built exactly one. You now own it, somehow, in bulk.",
    "Catch rate ×10.");
  add("mart_card", "ball", "Mart Membership Card", 2e4, { flags: ["mart"] },
    { type: "ballCost", value: 0.8 }, "Members save 20%. Membership is free. Do not ask what it costs.",
    "POKé BALLS cost 20% less.");
  add("bulk_balls", "ball", "Bulk Order Form", 1e7, { badges: 3, upgrades: ["mart_card"] },
    { type: "ballCost", value: 0.8 }, "Order ninety-nine at once. The clerk does not blink.",
    "POKé BALLS cost another 20% less.");

  // ---- Auto-catch
  add("auto_1", "auto", "Youngster Joey Pitches", 8000, { badges: 1, flags: ["mart"] },
    { type: "autoCatch", value: 0.2 }, "Joey throws for you. Overhand. With a lot of feeling.",
    "Automatically throws 0.2 balls/s at encounters.");
  add("auto_2", "auto", "Bug Catcher Relay", 2e6, { badges: 2, upgrades: ["auto_1"] },
    { type: "autoCatch", value: 0.5 }, "A line of Bug Catchers passes balls hand to hand into the grass.",
    "+0.5 automatic throws/s.");
  add("auto_3", "auto", "Ace Trainer Arm", 5e8, { badges: 4, upgrades: ["auto_2"] },
    { type: "autoCatch", value: 1 }, "A professional. She does not miss. She does not speak.",
    "+1 automatic throw/s.");
  add("auto_4", "auto", "Ball Cannon", 1e11, { badges: 6, upgrades: ["auto_3"] },
    { type: "autoCatch", value: 2 }, "Silph engineering. Fires POKé BALLS at a rate best described as \"many\".",
    "+2 automatic throws/s.");

  // ---- Encounter rate
  add("enc_1", "encounter", "Long Grass Seeds", 2000, { rdTotal: 1000 },
    { type: "encounterMult", value: 1.5 }, "Plant them anywhere. Something will be living in them by morning.",
    "Encounters ×1.5.");
  add("enc_2", "encounter", "Poké Doll Decoy", 3e5, { badges: 2, upgrades: ["enc_1"] },
    { type: "encounterMult", value: 1.5 }, "Wild POKéMON come to investigate. It is a very convincing doll.",
    "Encounters ×1.5.");
  add("enc_3", "encounter", "OLD ROD", 3e7, { badges: 3, upgrades: ["enc_2"] },
    { type: "encounterMult", value: 2 }, "Fish, for once. You will mostly catch MAGIKARP. You will love them anyway.",
    "Encounters ×2.");
  add("enc_4", "encounter", "SUPER ROD", 3e10, { badges: 6, upgrades: ["enc_3"] },
    { type: "encounterMult", value: 2 }, "From the Fishing Guru's younger brother. He is also a guru.",
    "Encounters ×2.");

  // ---- Dex bonus (Bill's PC)
  add("dex_1", "dex", "Bill's Notes", 2e5, { dexCount: 20 },
    { type: "dexBonusMult", value: 1.5 }, "Bill's margin notes on your Pokédex. Some are about you.",
    "Pokédex bonus ×1.5.");
  add("dex_2", "dex", "Cell Separation System", 2e8, { dexCount: 50, upgrades: ["dex_1"] },
    { type: "dexBonusMult", value: 1.5 }, "Bill used it on himself once. Your data is in much better hands.",
    "Pokédex bonus ×1.5.");
  add("dex_3", "dex", "Storage System v2", 2e11, { dexCount: 100, upgrades: ["dex_2"] },
    { type: "dexBonusMult", value: 2 }, "Twelve boxes of twenty. Room for everything. Room for more than everything.",
    "Pokédex bonus ×2.");
  add("dex_4", "dex", "Sea Cottage Archive", 2e13, { dexCount: 140, upgrades: ["dex_3"] },
    { type: "dexBonusMult", value: 2 }, "Bill backed up the whole Pokédex to a cottage by the sea. Twice.",
    "Pokédex bonus ×2.");

  // ---- Research milestones: global ×3 at Pokédex counts (the main late-game multiplier; keeps the
  //      Champion at ~4–6 h with the producer curve as specified — see pacing note in ARCHITECTURE.md)
  var milestones = [
    [10, 1e3, "Oak's Field Notes", "OAK reads your notes aloud to his aides. They clap. The research moves faster."],
    [25, 1e5, "Regional Survey Grant", "Somebody in an office approved funding. Nobody knows who. Nobody asks."],
    [40, 1e7, "Pokémon Journal Feature", "Your photo is in the magazine. You are blinking in it."],
    [55, 1e9, "Fan Club Membership", "The Chairman talks about his RAPIDASH for an hour. It is weirdly motivating."],
    [70, 1e10, "Professors' Conference", "Every professor in the region agrees on one thing: you."],
    [85, 1e11, "Kanto Research Network", "Every lab, every PC, every Lass's pink binder, all linked."],
    [100, 1e12, "Oak's Life's Work", "OAK hands you a thick folder. It has your name on it. It was always going to."],
    [120, 1e13, "The Complete Picture", "Almost every page is filled. The last few pages are slightly warm."]
  ];
  milestones.forEach(function (m, i) {
    add("research_" + (i + 1), "dex", m[2], m[1], { dexCount: m[0], upgrades: i ? ["research_" + i] : [] },
      { type: "allProducerMult", value: 3 }, m[3], "All producers ×3. Requires " + m[0] + " Pokédex entries.");
  });

  // ---- Candy
  add("candy_1", "candy", "Berry Patch", 3e6, { flags: ["daycare"] },
    { type: "candyMult", value: 2 }, "The Day Care couple grows berries out back. The POKéMON share.",
    "Candy gains ×2.");
  add("candy_2", "candy", "Candy Jar", 3e9, { badges: 4, upgrades: ["candy_1"] },
    { type: "candyMult", value: 2 }, "A big glass jar on Oak's desk. It is never empty and never full.",
    "Candy gains ×2.");
  add("candy_3", "candy", "Sweet Tooth Program", 3e12, { badges: 7, upgrades: ["candy_2"] },
    { type: "candyMult", value: 3 }, "Silph research suggests POKéMON evolve faster when spoiled.",
    "Candy gains ×3.");

  // ---- Offline
  add("sleeping_bag", "offline", "Sleeping Bag", 5e5, { badges: 2 },
    { type: "offlineCap", value: 14400 }, "Camp in the grass. The research keeps going while you sleep.",
    "Offline progress cap raised to 4 hours.");
  add("exp_all", "offline", "EXP. ALL", 5e8, { badges: 4 },
    { type: "offlineMult", value: 1.5 }, "Everyone learns, even the ones who were not paying attention.",
    "Offline progress ×1.5.");
  add("night_stay", "offline", "Pokémon Center Night Stay", 5e10, { flags: ["fly"], upgrades: ["sleeping_bag"] },
    { type: "offlineCap", value: 43200 }, "A bed upstairs that was always there. Nobody else ever uses it.",
    "Offline progress cap raised to 12 hours.");

  // ---- Flags
  add("pokeflute", "flag", "POKé FLUTE", 2e8, { badges: 4 },
    { type: "flag", value: "pokeflute" }, "MR. FUJI gives you a flute. \"Play it gently. Everything sleeping wants to wake.\"",
    "Wakes the sleeping POKéMON on Route 12.");

  // ---- Encounter queue
  add("queue_1", "queue", "Bigger Patch", 1e5, { badges: 1 },
    { type: "encounterQueue", value: 1 }, "More grass, more room. More things standing in it.",
    "+1 encounter slot.");
  add("queue_2", "queue", "Tall Grass Expansion", 1e9, { badges: 4, upgrades: ["queue_1"] },
    { type: "encounterQueue", value: 1 }, "The grass reaches the edge of the screen now.",
    "+1 encounter slot.");
  add("queue_3", "queue", "Endless Meadow", 1e12, { badges: 7, upgrades: ["queue_2"] },
    { type: "encounterQueue", value: 1 }, "The grass keeps going past the edge of the screen.",
    "+1 encounter slot.");

  TG.data.upgrades = list;
})();
