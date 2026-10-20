/* TALL GRASS — js/data/producers.js (content agent)
 * TG.data.producers: array in unlock order. Schema per docs/ARCHITECTURE.md, plus:
 *  - unlock.flags: [flagName...]   all must be set for the producer to be visible (e.g. ["mart"]).
 *  - act: number (optional; default 1). Producers with act: 3 are Act 3 "corrupt_*" mirrors.
 *  - cost: { gb: N } (corrupt_* only) — used INSTEAD of baseCost; price = cost.gb × costMult^owned,
 *    paid in Glitch Bytes. Engine treats `gb` costs as Act 3 currency.
 *  - gb: number — Glitch Bytes/sec per unit (corrupt_* only).
 *  - mirrorOf: id of the normal producer a corrupt_* mirrors.
 * Normal producers: each step ≈ ×10 cost, ≈ ×5–8 output (Cookie Clicker curve).
 */
window.TG = window.TG || {};
TG.data = TG.data || {};

(function () {
  function U(o) {
    return {
      badges: o.badges || 0,
      routes: o.routes || [],
      producers: o.producers || {},
      rdTotal: o.rdTotal || 0,
      flags: o.flags || []
    };
  }

  var normal = [
    {
      id: "bugcatcher", name: "Bug Catcher", baseCost: 35, costMult: 1.15,
      rd: 0.25, encounters: 0, balls: 0, candy: 0,
      unlock: U({ rdTotal: 10 }),
      flavor: "I like shorts! They're comfy and easy to wear!",
      desc: "Catches bugs. Writes it down. +0.25 RD/s."
    },
    {
      id: "youngster", name: "Youngster", baseCost: 100, costMult: 1.15,
      rd: 2.2, encounters: 0.01, balls: 0, candy: 0,
      unlock: U({ producers: { bugcatcher: 1 }, rdTotal: 75 }),
      flavor: "My RATTATA is in the top percentage of RATTATA. Statistically.",
      desc: "Throws rocks into the grass. Things come out. +2.2 RD/s, +0.01 encounters/s."
    },
    {
      id: "lass", name: "Lass", baseCost: 1100, costMult: 1.15,
      rd: 10, encounters: 0, balls: 0, candy: 0,
      unlock: U({ routes: ["route1"], rdTotal: 600 }),
      flavor: "You're a trainer, right? Then you have to take notes with me.",
      desc: "Keeps meticulous field notes in a pink binder. +10 RD/s."
    },
    {
      id: "mart_shelf", name: "Poké Mart Shelf", baseCost: 12000, costMult: 1.15,
      rd: 0, encounters: 0, balls: 0.12, candy: 0,
      unlock: U({ badges: 1, flags: ["mart"] }),
      flavor: "May I help you? We have exactly one item, and it is round.",
      desc: "Restocks itself with POKé BALLS. +0.12 balls/s."
    },
    {
      id: "nursejoy", name: "Pokémon Center Nurse", baseCost: 130000, costMult: 1.15,
      rd: 120, encounters: 0, balls: 0, candy: 0,
      unlock: U({ badges: 1, rdTotal: 650000 }),
      flavor: "We hope to see you again! We will. We always do.",
      desc: "Heals, records, files, heals again. +120 RD/s."
    },
    {
      id: "daycare", name: "Day Care Couple", baseCost: 1.4e6, costMult: 1.15,
      rd: 100, encounters: 0, balls: 0, candy: 0.02,
      unlock: U({ badges: 2, rdTotal: 7e6, flags: ["daycare"] }),
      flavor: "We raised your POKéMON. We do not know where the eggs come from either.",
      desc: "Raises your POKéMON. +100 RD/s, +0.02 candy/s spread across owned families."
    },
    {
      id: "bill_pc", name: "Bill's PC", baseCost: 2e7, costMult: 1.15,
      rd: 1800, encounters: 0, balls: 0, candy: 0,
      unlock: U({ badges: 2, rdTotal: 1e8 }),
      flavor: "Accessed BILL's PC. Accessed POKéMON Storage System.",
      desc: "Sorts every record into boxes, then sorts the boxes. +1,800 RD/s."
    },
    {
      id: "safari", name: "Safari Zone Warden", baseCost: 3.3e8, costMult: 1.15,
      rd: 7000, encounters: 0.05, balls: 0, candy: 0,
      unlock: U({ badges: 3, rdTotal: 1.7e9 }),
      flavor: "Ah ha fwah! Ma tooth! Thanksh, I mean, thanks.",
      desc: "Herds rare POKéMON toward your grass. +7,000 RD/s, +0.05 encounters/s."
    },
    {
      id: "gamecorner", name: "Game Corner", baseCost: 5.1e9, costMult: 1.15,
      rd: 32000, encounters: 0, balls: 0, candy: 0,
      unlock: U({ badges: 3, routes: ["celadon"], rdTotal: 2.6e10 }),
      flavor: "The slots are hot today. They are always hot today.",
      desc: "Converts coins into research somehow. Nobody asks how. +32,000 RD/s."
    },
    {
      id: "silph", name: "Silph Co. Lab", baseCost: 7.5e10, costMult: 1.15,
      rd: 110000, encounters: 0, balls: 0, candy: 0,
      unlock: U({ badges: 4, routes: ["saffron"], rdTotal: 3.8e11 }),
      flavor: "Eleven floors. Card-key doors. A prototype in a locked case on the top floor.",
      desc: "Industrial-scale POKéMON science. +110,000 RD/s."
    },
    {
      id: "league", name: "Indigo Plateau", baseCost: 1e12, costMult: 1.15,
      rd: 1000000, encounters: 0, balls: 0, candy: 0,
      unlock: U({ badges: 8, rdTotal: 5e12, flags: ["victory_road"] }),
      flavor: "Every trainer's road leads here. It has always been the end of the map.",
      desc: "The League records every battle ever fought. +1,000,000 RD/s."
    }
  ];

  // Act 3 corrupted mirrors. Pay Glitch Bytes; cost in gb. rd = normal × 1000.
  var corrupt = [
    ["bugcatcher", "B̸ug C@tcher", 10, 0.05, "i like shorts i have always liked shorts i will always", "Catches something. It is not a bug."],
    ["youngster", "Y0UNGSTER", 60, 0.2, "my rattata is in the top 0x00 percent", "Throws rocks at the wall of the world."],
    ["lass", "L̸ass", 400, 1, "you're a trainer right you're a trainer right you're a", "Her binder is full of the same page."],
    ["mart_shelf", "Pöké M@rt Sh̸elf", 3000, 3, "may i help you may i help you may i", "Restocks items that do not have names."],
    ["nursejoy", "N̸URSE", 20000, 8, "we hope to see you again we hope to see you again", "Heals nothing. Records everything."],
    ["daycare", "D̸ay C̸are", 150000, 20, "we raised it we raised it it raised us", "The eggs are warm. The eggs are not eggs."],
    ["bill_pc", "BILL'̸s P̸C", 1e6, 60, "accessed someone's pc accessed someone accessed", "Box 13 is open. There is no box 13."],
    ["safari", "S̸afari W̸arden", 8e6, 180, "ma tooth ma tooth ma", "Herds things in from outside the fence."],
    ["gamecorner", "G̸ame C̸orner", 6e7, 500, "the slots are always hot the slots are always", "Every reel shows the same symbol: you."],
    ["silph", "S̸ILPH", 5e8, 1500, "the prototype is not in the case anymore", "Floor 12 exists now."],
    ["league", "IN̸DIGO", 4e9, 5000, "every road leads here every road leads", "The Hall of Fame keeps adding names."]
  ];

  var byId = {};
  normal.forEach(function (p) { p.act = 1; byId[p.id] = p; });

  var mirrors = corrupt.map(function (c) {
    var src = byId[c[0]];
    return {
      id: "corrupt_" + c[0],
      name: c[1],
      act: 3,
      mirrorOf: c[0],
      cost: { gb: c[2] },
      costMult: 1.15,
      rd: src.rd * 1000,
      encounters: src.encounters,
      balls: src.balls * 1000,
      candy: src.candy,
      gb: c[3],
      unlock: U({ flags: ["glitch"] }),
      flavor: c[4],
      desc: c[5]
    };
  });

  TG.data.producers = normal.concat(mirrors);
})();
