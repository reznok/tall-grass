/* TALL GRASS — js/data/routes.js (content agent)
 * TG.data.routes: array in unlock order (sorted by cost). Schema per docs/ARCHITECTURE.md.
 * Notes:
 *  - Starters (1/4/7) live in Pallet's table at low weight ("Oak's lab spillover").
 *  - Trade evolutions, Eeveelutions and starter evolutions appear as rare encounters so that every
 *    species 1–150 is catchable somewhere. Mew (151) is only obtainable via the truck secret.
 *  - "Saffron City" is an extra route (dojo: Hitmonlee/Hitmonchan; Silph: Lapras).
 *  - Cycling Road (route16_17_18) requires flag "bike".
 *  - glitch_city has an empty table on purpose; the late-game system fills it.
 * Cost curve: ~x3 early, ~x1.5–2 late; Champion era ≈ 1e12–1e13 RD.
 */
window.TG = window.TG || {};
TG.data = TG.data || {};

(function () {
  // E(id, weight, id, weight, ...) -> [{id, weight}, ...]
  function E() {
    var out = [];
    for (var i = 0; i < arguments.length; i += 2) out.push({ id: arguments[i], weight: arguments[i + 1] });
    return out;
  }
  function req(badges, routes, flags) { return { badges: badges, routes: routes || [], flags: flags || [] }; }

  TG.data.routes = [
    {
      id: "pallet", name: "Pallet Town", act: 1, cost: 0, requires: req(0, []),
      encounters: E(16, 45, 19, 45, 1, 2, 4, 2, 7, 2),
      flavor: "A quiet town. Something small keeps escaping from the lab.",
      special: null
    },
    {
      id: "route1", name: "Route 1", act: 1, cost: 28, requires: req(0, ["pallet"]),
      encounters: E(16, 55, 19, 45),
      night: E(19, 75, 16, 25),
      flavor: "Tall grass sways between Pallet and Viridian. It has always swayed exactly like this.",
      special: null
    },
    {
      id: "viridian", name: "Viridian City", act: 1, cost: 98, requires: req(0, ["route1"]),
      encounters: E(60, 45, 16, 25, 19, 25, 10, 5),
      flavor: "The pond behind the city is quiet. The fishing is good. The gym is locked.",
      special: null
    },
    {
      id: "route22", name: "Route 22", act: 1, cost: 340, requires: req(0, ["viridian"]),
      encounters: E(19, 30, 21, 30, 29, 15, 32, 15, 56, 10),
      flavor: "A road west toward a gate you are not allowed through. Not yet.",
      special: null
    },
    {
      id: "viridian_forest", name: "Viridian Forest", act: 1, cost: 840, requires: req(0, ["viridian"]),
      encounters: E(10, 28, 13, 28, 11, 12, 14, 12, 16, 10, 25, 5),
      night: E(10, 25, 13, 25, 11, 15, 14, 15, 48, 12, 25, 8),
      flavor: "A deep forest. Bug Catchers stand in exactly the same spots, every day, forever.",
      special: null
    },
    {
      id: "route3", name: "Route 3", act: 2, cost: 6600, requires: req(1, ["viridian_forest"]),
      encounters: E(21, 30, 27, 20, 23, 15, 39, 10, 19, 10, 29, 7, 32, 7, 56, 5),
      flavor: "A rocky road that ends at a mountain. The trainers here all want to fight. All of them.",
      special: null
    },
    {
      id: "mt_moon", name: "Mt. Moon", act: 2, cost: 16000, requires: req(1, ["route3"]),
      encounters: E(41, 50, 74, 25, 46, 15, 35, 6, 27, 4),
      night: E(41, 45, 35, 30, 74, 15, 46, 10),
      flavor: "A cave of soft stone. Some nights the ceiling glows. The ceiling is not supposed to glow.",
      special: null
    },
    {
      id: "route4", name: "Route 4", act: 2, cost: 33000, requires: req(1, ["mt_moon"]),
      encounters: E(19, 25, 21, 25, 23, 20, 27, 20, 56, 10),
      flavor: "A one-way ledge. You can go down. You can never quite go back up.",
      special: null
    },
    {
      id: "cerulean", name: "Cerulean City", act: 2, cost: 66000, requires: req(1, ["route4"]),
      encounters: E(54, 38, 60, 25, 79, 14, 98, 10, 118, 7, 61, 4, 119, 2),
      flavor: "A city of water. Someone's house was robbed. Someone always is.",
      special: null
    },
    {
      id: "route24_25", name: "Nugget Bridge", act: 2, cost: 240000, requires: req(1, ["cerulean"]),
      encounters: E(43, 20, 69, 20, 48, 12, 63, 10, 16, 10, 10, 7, 13, 7, 11, 5, 14, 5, 17, 4, 12, 1, 15, 1),
      flavor: "Five trainers on a bridge, then a man with a nugget and a very generous offer.",
      special: null
    },
    {
      id: "route5_6", name: "Routes 5 & 6", act: 2, cost: 1.9e6, requires: req(2, ["cerulean"]),
      encounters: E(43, 18, 69, 18, 52, 18, 16, 15, 56, 12, 54, 8, 63, 6, 39, 5),
      flavor: "The road south runs under Saffron through a tunnel nobody has ever seen the middle of.",
      special: null
    },
    {
      id: "vermilion", name: "Vermilion City", act: 2, cost: 4.3e6, requires: req(2, ["route5_6"]),
      encounters: E(72, 25, 98, 25, 90, 20, 116, 15, 129, 10, 83, 3, 86, 2),
      flavor: "A harbor town. Gulls, ropes, and a fan club that will not stop talking.",
      special: null
    },
    {
      id: "route11", name: "Route 11", act: 2, cost: 1.9e6, requires: req(3, ["vermilion"]),
      encounters: E(96, 25, 23, 20, 27, 20, 21, 20, 16, 10, 19, 5),
      flavor: "A gatehouse with a telescope. Through it: a field you cannot reach from here.",
      special: null
    },
    {
      id: "diglett_cave", name: "Diglett's Cave", act: 2, cost: 3.7e6, requires: req(3, ["route11"]),
      encounters: E(50, 90, 51, 10),
      encounterRateMult: 1.25,
      flavor: "A tunnel dug entirely by DIGLETT. The walls are smooth. The DIGLETT will not say how.",
      special: null
    },
    {
      id: "route9_10", name: "Routes 9 & 10", act: 2, cost: 7.4e6, requires: req(3, ["cerulean"]),
      encounters: E(19, 20, 21, 20, 23, 15, 27, 15, 100, 12, 81, 12, 66, 6),
      flavor: "A power line hums over the road. The grass beneath it leans the same direction.",
      special: null
    },
    {
      id: "rock_tunnel", name: "Rock Tunnel", act: 2, cost: 1.5e7, requires: req(3, ["route9_10"]),
      encounters: E(41, 35, 74, 30, 66, 18, 95, 10, 75, 4, 42, 3),
      encounterRateMult: 1.1,
      flavor: "No light at all. You count steps. The count is different on the way out.",
      special: null
    },
    {
      id: "lavender", name: "Lavender Town", act: 2, cost: 3.1e7, requires: req(3, ["rock_tunnel"]),
      encounters: E(16, 30, 19, 25, 52, 20, 92, 15, 104, 10),
      flavor: "A small town with a tall tower. The music here is in a key that makes children cry.",
      special: null
    },
    {
      id: "pokemon_tower", name: "Pokémon Tower", act: 2, cost: 5.6e7, requires: req(3, ["lavender"]),
      encounters: E(92, 70, 104, 20, 93, 10),
      night: E(92, 50, 93, 32, 104, 10, 105, 5, 94, 3),
      flavor: "Seven floors of graves. The seventh floor has an eighth step.",
      special: "pokemon_tower"
    },
    {
      id: "route8_7", name: "Routes 8 & 7", act: 2, cost: 8.7e7, requires: req(3, ["lavender"]),
      encounters: E(58, 15, 37, 15, 52, 15, 16, 15, 23, 10, 27, 10, 56, 8, 63, 6, 39, 6),
      flavor: "Two short roads and an underground path that a guard insists is quicker. It is not.",
      special: null
    },
    {
      id: "celadon", name: "Celadon City", act: 2, cost: 1.4e8, requires: req(3, ["route8_7"]),
      encounters: E(88, 20, 109, 20, 35, 10, 63, 10, 30, 8, 33, 8, 133, 3, 137, 3, 123, 2, 127, 2, 147, 1),
      flavor: "A department store, a Game Corner, and a prize counter that sells POKéMON by the coin.",
      special: null
    },
    {
      id: "ss_anne", name: "Vermilion Dock", act: 2, cost: 3.6e8, requires: req(4, ["vermilion"], ["cut"]),
      encounters: E(72, 30, 98, 20, 90, 15, 116, 15, 66, 10, 129, 10),
      flavor: "The S.S. ANNE has sailed. A truck sits on the empty pier. Nobody remembers parking it.",
      special: "truck"
    },
    {
      id: "saffron", name: "Saffron City", act: 2, cost: 5.4e8, requires: req(4, ["celadon"]),
      encounters: E(16, 20, 63, 15, 66, 15, 19, 15, 96, 10, 67, 5, 64, 5, 106, 3, 107, 3, 122, 3, 65, 1, 131, 2),
      flavor: "A walled city around a tall office building. The dojo next door lost its sign.",
      special: null
    },
    {
      id: "route12_13", name: "Routes 12 & 13", act: 2, cost: 8.5e8, requires: req(4, ["lavender"], ["pokeflute"]),
      encounters: E(43, 12, 69, 12, 48, 10, 16, 10, 129, 10, 72, 8, 17, 6, 44, 5, 70, 5, 116, 5, 98, 5, 118, 5, 83, 3, 132, 3, 143, 1),
      flavor: "A long pier and a maze of fences. Something large used to block the way. It still might.",
      special: null
    },
    {
      id: "route14_15", name: "Routes 14 & 15", act: 2, cost: 1.3e9, requires: req(4, ["route12_13"]),
      encounters: E(43, 15, 69, 15, 48, 15, 17, 12, 16, 10, 44, 8, 70, 8, 49, 6, 132, 5),
      flavor: "Fields of grass in every direction. Birdkeepers watch them from the fenceposts.",
      special: null
    },
    {
      id: "fuchsia", name: "Fuchsia City", act: 2, cost: 2.1e9, requires: req(4, ["route14_15"]),
      encounters: E(118, 25, 129, 25, 98, 15, 54, 10, 79, 10, 119, 8, 99, 4, 130, 1),
      flavor: "A city built around a fenced-in wilderness. The warden has lost his teeth again.",
      special: null
    },
    {
      id: "safari_zone", name: "Safari Zone", act: 2, cost: 6.5e9, requires: req(5, ["fuchsia"]),
      encounters: E(111, 10, 102, 10, 29, 8, 32, 8, 48, 8, 46, 8, 84, 8, 30, 5, 33, 5, 47, 4, 49, 3,
                    115, 3, 123, 3, 127, 3, 128, 3, 147, 3, 113, 2, 148, 1),
      encounterRateMult: 1.5,
      flavor: "You get thirty balls and a time limit. The POKéMON here have heard about the time limit.",
      special: null
    },
    {
      id: "route16_17_18", name: "Cycling Road", act: 2, cost: 9.8e9, requires: req(5, ["celadon"], ["bike"]),
      encounters: E(84, 25, 21, 15, 19, 15, 77, 12, 22, 8, 20, 8, 85, 3, 108, 2, 143, 1),
      flavor: "Downhill all the way. Bikers gather at the bottom and say nothing about the top.",
      special: null
    },
    {
      id: "route19_20_seafoam", name: "Seafoam Islands", act: 2, cost: 3.2e10, requires: req(6, ["fuchsia"], ["surf"]),
      encounters: E(72, 25, 86, 10, 90, 10, 120, 8, 73, 8, 79, 6, 54, 6, 116, 6, 41, 6, 98, 5,
                    87, 6, 80, 3, 55, 3, 117, 3, 42, 3, 91, 5, 99, 2, 124, 5, 134, 1, 131, 3, 144, 1),
      flavor: "Two icy islands where the currents run in circles. The cold at the bottom is not weather.",
      special: null
    },
    {
      id: "cinnabar", name: "Cinnabar Island", act: 2, cost: 4.8e10, requires: req(6, ["route19_20_seafoam"], ["surf"]),
      encounters: E(88, 12, 109, 12, 77, 10, 19, 10, 58, 8, 37, 8, 20, 5, 89, 4, 110, 4, 78, 4, 126, 4, 132, 4, 136, 1),
      flavor: "A volcano, a gym, and a burned mansion full of diaries about something that got loose.",
      special: null
    },
    {
      id: "cinnabar_lab", name: "Cinnabar Lab", act: 2, cost: 1.5e11, requires: req(7, ["cinnabar"], ["lab_cinnabar"]),
      encounters: E(81, 18, 100, 18, 88, 12, 109, 12, 132, 10, 137, 6, 82, 6, 101, 6, 138, 3, 140, 3, 142, 2, 139, 1, 141, 1),
      flavor: "They can bring back anything from a fossil. They are less sure what comes back.",
      special: "cinnabar_lab"
    },
    {
      id: "route21", name: "Route 21", act: 2, cost: 1.8e11, requires: req(7, ["cinnabar"], ["surf"]),
      encounters: E(72, 18, 16, 15, 114, 12, 19, 12, 17, 10, 20, 8, 90, 8, 120, 8, 118, 7, 18, 2, 121, 2),
      flavor: "A sea lane back to Pallet. From the water, home looks smaller than you remember.",
      special: null
    },
    {
      id: "power_plant", name: "Power Plant", act: 2, cost: 2.4e11, requires: req(7, ["route9_10"], ["surf"]),
      encounters: E(81, 22, 100, 20, 25, 20, 82, 10, 101, 8, 125, 8, 26, 6, 135, 1, 145, 1),
      flavor: "Abandoned, but the lights still flicker. Something here is very much switched on.",
      special: null
    },
    {
      id: "victory_road", name: "Victory Road", act: 2, cost: 1.2e12, requires: req(8, ["route22"], ["victory_road"]),
      encounters: E(66, 12, 74, 12, 95, 12, 67, 10, 75, 10, 41, 10, 42, 10, 105, 5, 49, 5, 28, 4, 68, 2, 76, 2, 146, 1),
      encounterRateMult: 1.2,
      flavor: "Boulders, ladders and switches. Everyone who walks through comes out a little older.",
      special: null
    },
    {
      id: "cerulean_cave", name: "Cerulean Cave", act: 2, cost: 3.7e14, requires: req(8, ["cerulean"], ["champion"]),
      encounters: E(42, 10, 47, 8, 132, 8, 64, 6, 26, 6, 101, 6, 112, 6, 40, 6, 85, 6, 28, 6, 24, 6, 57, 6, 82, 6,
                    105, 5, 53, 4, 97, 4, 113, 3, 12, 2, 15, 2, 18, 2, 31, 2, 34, 2, 36, 2, 38, 2, 45, 2, 59, 2,
                    62, 2, 71, 2, 103, 2, 130, 2, 2, 1, 5, 1, 8, 1, 3, 1, 6, 1, 9, 1, 149, 1, 150, 1),
      flavor: "A cave that was not on the map until you became Champion. It was waiting for that.",
      special: "cerulean_cave"
    },
    {
      id: "coast", name: "Cinnabar Coast", act: 3, cost: 5.9e14, requires: req(8, ["cinnabar"], ["surf", "champion"]),
      encounters: E(72, 30, 90, 15, 120, 15, 98, 15, 116, 10, 73, 10, 99, 5),
      flavor: "The east shore, where the land tiles meet the water tiles. Surf along the seam.",
      special: "coast"
    },
    {
      id: "glitch_city", name: "Gl̸itch C̸ity", act: 3, cost: 3.6e14, requires: req(8, ["coast"], ["glitch"]),
      encounters: [],
      flavor: "The tiles here were loaded from the wrong place. Walk carefully. Do not save here.",
      special: "glitch_city"
    }
  ];
})();
