/* TALL GRASS — js/data/story.js (content agent)
 * TG.data.story and TG.data.events, keys per docs/ARCHITECTURE.md. Every line <= 110 chars.
 *
 * Voice conventions (lines are plain strings):
 *  - "OAK: ..."  Prof. Oak. "BLUE: ..." the rival. Other "NAME: ..." prefixes are other speakers.
 *  - Unprefixed sentence-case lines are the deadpan narrator.
 *  - Lowercase lines with no punctuation in Act 3/4 keys are the SECOND VOICE (inside the cartridge).
 *  - TG.data.storyCls(trigger, line) suggests a TG.log cls for any line (engine may use or ignore).
 *
 * Extra trigger keys added beyond the contract (engine may fire them; all optional):
 *  - first_evolve      first evolution
 *  - first_flee        first encounter that runs away after 3 misses
 *  - first_upgrade     first upgrade bought
 *  - offline_return    shown in/after the "While you were away..." modal
 *  - act: { 2: [...], 3: [...], 4: [...] }   act transitions (keyed by act number)
 *  - debug_menu        Konami code / 10 title taps
 *  - hall_of_fame      corrupted Hall of Fame listing (after MissingNo.)
 *  - instability_crash the 3s "crash" at 100% instability
 *  - pull_cartridge    voluntary prestige after the first
 *  - dex_0             Pokedex #000 entry text (after first prestige)
 */
window.TG = window.TG || {};
TG.data = TG.data || {};

TG.data.story = {
  start: [
    "Your name is... whatever you typed in. It doesn't matter much. PROF. OAK has a job for you.",
    "OAK: Ah, there you are! This world is full of creatures called POKéMON. Nobody has written them all down.",
    "OAK: Here. A POKéDEX. It's empty. Go and stand in the tall grass and see what happens.",
    "The grass is right there. It is waiting."
  ],
  first_tap: [
    "The grass rustles. Something in the grass rustles back.",
    "OAK: Careful! Wild POKéMON live in tall grass. That's rather the point, of course."
  ],
  first_catch: [
    "Gotcha. It is smaller up close.",
    "OAK: Wonderful! The POKéDEX recorded it. Every new entry makes the research go faster.",
    "Research Data is how science keeps score."
  ],
  first_producer: [
    "A Bug Catcher agrees to help. He asks for nothing. He is wearing shorts.",
    "OAK: Delegation! Very good. A scientist who does everything himself never finishes anything."
  ],
  first_upgrade: [
    "You improve something. It stays improved. That's the whole trick."
  ],
  first_evolve: [
    "It glows. It grows. It looks at you as if it had always been this shape.",
    "OAK: Evolution! Ha! Sixty years and it still gives me goosebumps."
  ],
  first_flee: [
    "It got away. It did not look back.",
    "OAK: Don't worry. There is always another one. That is the one thing I'm sure of."
  ],
  offline_return: [
    "While you were away, the grass kept growing and your helpers kept writing.",
    "Nobody noticed you were gone. That's either comforting or it isn't."
  ],

  route_unlock: {
    pallet: ["Pallet Town. Shades of your life. The lab door is always open."],
    route1: [
      "ROUTE 1. Tall grass between Pallet and Viridian.",
      "OAK: Off you go! Mind the ledges. You can only ever jump down them."
    ],
    viridian: [
      "VIRIDIAN CITY. The gym is locked. An old man is lying across the road, grumbling about coffee.",
      "There is a pond. There are always fish in a pond, if you are patient."
    ],
    route22: ["ROUTE 22. A gate to the west. A guard says you need badges. He says it to everyone."],
    viridian_forest: [
      "VIRIDIAN FOREST. The trees are close together. The light comes down in tiles.",
      "Bug Catchers here have been standing in the same places for years. Ask them. They'll say so."
    ],
    route3: ["ROUTE 3. Every trainer here wants to battle. They say so with their eyes."],
    mt_moon: [
      "MT. MOON. Fossils, ZUBAT, and something in the dark that glows when it thinks no one is looking.",
      "A man in a lab coat says the cave is his. It isn't. Nothing here is anyone's."
    ],
    route4: ["ROUTE 4. You jump down a ledge. You cannot jump back up. You never could."],
    cerulean: ["CERULEAN CITY. Someone's house was robbed. A cop stands in front of the hole, not looking at it."],
    route24_25: [
      "NUGGET BRIDGE. Five trainers in a row. Then a man with a NUGGET and a job offer.",
      "At the end of the cape, BILL's cottage. The lights are on. The door is open."
    ],
    route5_6: ["ROUTES 5 & 6. The road goes around Saffron. The gate guard is thirsty. He is always thirsty."],
    vermilion: ["VERMILION CITY. The S.S. ANNE is in port. You can smell the salt and the diesel."],
    route11: ["ROUTE 11. A telescope at the gatehouse shows a field of grass you can't get to. Yet."],
    diglett_cave: ["DIGLETT'S CAVE. Hundreds of small heads. None of them will tell you what's underneath."],
    route9_10: ["ROUTES 9 & 10. A power line hums overhead. All the grass leans the same direction."],
    rock_tunnel: ["ROCK TUNNEL. No light. You count your steps. You get a different number going back."],
    lavender: [
      "LAVENDER TOWN. The music is wrong here. Not bad. Wrong.",
      "MR. FUJI runs a house for POKéMON nobody came back for. It is very full."
    ],
    pokemon_tower: [
      "POKéMON TOWER. Seven floors of graves.",
      "A channeler turns to you. Her eyes are somewhere else. GET OUT, she says, very politely."
    ],
    route8_7: ["ROUTES 8 & 7. An underground path connects them. Nobody has ever walked all of it."],
    celadon: [
      "CELADON CITY. The tallest department store in Kanto, and a GAME CORNER that never closes.",
      "Behind a poster in the Game Corner, something hums."
    ],
    ss_anne: [
      "The S.S. ANNE has left. You missed it. The dock is empty.",
      "Almost empty. There is a truck."
    ],
    saffron: [
      "SAFFRON CITY. The gates are open now. Men in black suits are pretending to be businessmen.",
      "The fighting dojo next to the gym lost to the gym. They are still upset about it."
    ],
    route12_13: [
      "You play the POKé FLUTE. The SNORLAX on Route 12 rolls over, considers it, and gets up.",
      "The road is clear. It was only ever asleep."
    ],
    route14_15: ["ROUTES 14 & 15. Grass in every direction. Birdkeepers watch from the fenceposts."],
    fuchsia: ["FUCHSIA CITY. A zoo, a SAFARI ZONE, and a Warden who has lost his teeth again."],
    safari_zone: [
      "SAFARI ZONE. Thirty balls and a time limit. The POKéMON have heard about the time limit.",
      "Deep inside is a rest house with a man who knows a secret about SURF. He will tell anyone."
    ],
    route16_17_18: ["CYCLING ROAD. Downhill the whole way. You do not have to pedal. You do not get to stop."],
    route19_20_seafoam: [
      "You SURF out past the edge of the land. The water tiles go on and on.",
      "SEAFOAM ISLANDS. The currents run in circles. The cold at the bottom is not weather."
    ],
    cinnabar: [
      "CINNABAR ISLAND. A volcano, a gym, and a burned mansion full of diaries.",
      "DIARY: July 5. We named the newly discovered POKéMON. It is very strong. It is very angry.",
      "DIARY: Sept 1. It is too strong. We cannot hold it. We should never have made it from MEW."
    ],
    cinnabar_lab: [
      "CINNABAR LAB. They can bring a fossil back to life. They are less sure what comes back.",
      "A scientist says the machine sometimes revives things that were never fossils. He laughs. Then doesn't."
    ],
    route21: ["ROUTE 21. A sea lane back to Pallet. From the water, home looks smaller than you remember."],
    power_plant: ["THE POWER PLANT. Abandoned for years. The lights are on. Something is keeping them on."],
    victory_road: [
      "VICTORY ROAD. Boulders, ladders and switches.",
      "At the far end, a plateau. Torches burn on it. Nobody remembers lighting them."
    ],
    cerulean_cave: [
      "CERULEAN CAVE. The guard is gone. The cave goes deeper than the map does.",
      "At the very bottom, something is awake. It has been waiting for a Champion. Any Champion."
    ],
    coast: [
      "You SURF along CINNABAR's east coast, right on the seam where the land tiles meet the water.",
      "The OLD MAN's lesson comes back to you, for no reason at all."
    ],
    glitch_city: [
      "The tiles here were loaded from the wrong place.",
      "There are no POKéMON. There are things that are almost POKéMON. Do not save here.",
      "welcome home"
    ]
  },

  badge: {
    pewter: [
      "BOULDER BADGE obtained. The POKé MART will sell to you now.",
      "OAK: A badge! You know, I never got one. I was busy. I was always busy."
    ],
    cerulean: [
      "CASCADE BADGE obtained. A couple outside town opens a DAY CARE.",
      "They raise your POKéMON while you do other things. Candy appears. Nobody asks where from."
    ],
    vermilion: [
      "THUNDER BADGE obtained. A BICYCLE arrives in the mail. Tap power ×5.",
      "The shop owner says it cost a million. He says it like he is reading it off something."
    ],
    celadon: [
      "RAINBOW BADGE obtained. You can use CUT.",
      "The small trees blocking every road fall over at once. They grow back. They always grow back."
    ],
    fuchsia: [
      "SOUL BADGE obtained. You can SURF.",
      "The sea is open. It is very big and mostly the same tile."
    ],
    saffron: [
      "MARSH BADGE obtained. You can FLY.",
      "Time spent away now counts for more. Sabrina watched you leave the gym before you left it."
    ],
    cinnabar: [
      "VOLCANO BADGE obtained. The CINNABAR LAB opens. You can use STRENGTH.",
      "With STRENGTH, heavy things can be moved. Even things that were never meant to move."
    ],
    viridian: [
      "EARTH BADGE obtained. Eight badges.",
      "OAK: Victory Road. The League. ...I'm so proud. Don't tell your rival I said that."
    ],
    lorelei: ["LORELEI is defeated. The floor is still cold where she stood."],
    bruno: ["BRUNO is defeated. He bows. Something in his back clicks."],
    agatha: ["AGATHA is defeated. She says Oak's name in a way that sounds like a curse and a joke."],
    lance: ["LANCE is defeated. His dragons fold their wings. One door left."],
    champion: ["You are the CHAMPION."]
  },

  dex_10: [
    "OAK: Ten! The POKéDEX is starting to look like a real book.",
    "OAK: Each one you register makes the next one easier to understand."
  ],
  dex_25: ["OAK: Twenty-five species. At your age I had three, and one of them turned out to be a rock."],
  dex_50: [
    "OAK: Fifty! I'm going to tell everyone. I'm going to tell AGATHA.",
    "OAK: ...No. Not Agatha."
  ],
  dex_100: [
    "OAK: One hundred. Do you know how long I've waited for someone to do this?",
    "OAK: A very long time. Longer than makes sense, now that I think about it."
  ],
  dex_150: [
    "OAK: One hundred and fifty. That should be all of them. That should be everything.",
    "OAK: ...Then why does the POKéDEX have one more page?"
  ],
  dex_151: [
    "The POKéDEX is complete. 151 of 151.",
    "OAK: Complete. I thought I would feel happier.",
    "OAK: I have the strangest feeling the book is longer than it looks."
  ],

  oldman: [
    "An OLD MAN is lying across the road in Viridian. He has not had his coffee.",
    "OLD MAN: Ahh, I've had my coffee now. I'll show you how to catch POKéMON. Watch closely.",
    "He throws a ball. It is slow. It is perfect.",
    "OLD MAN: That's how it's done. Remember it. Remember where you were standing when I showed you.",
    "OLD MAN: Funny thing. Ever since I first showed someone that, the east coast of Cinnabar looks wrong to me."
  ],

  truck_found: [
    "There is a truck on the dock. The ship is gone. Nobody can say who parked it here.",
    "It has no driver. It has no engine. The shadow underneath it is deeper than it should be.",
    "Something under there is purring."
  ],
  truck_moved: [
    "With STRENGTH, you push. The truck slides one tile to the left. It has never moved before.",
    "Underneath, the ground is not ground. It is a pattern, repeating.",
    "Something small and pink looks up at you, as if it had been waiting a very long time."
  ],
  mew: [
    "MEW was registered in the POKéDEX.",
    "OAK: Remarkable. Its data contains every other POKéMON. Every one. Even the ones you haven't found.",
    "OAK: And other things I don't understand. Numbers. 160. 144. Over and over.",
    "MEW sneezes. Somewhere, a pixel is out of place."
  ],

  champion: [
    "BLUE: ...So that's it. You're the Champion. I lasted three minutes.",
    "OAK: I'm proud of you. Truly. You did what I never could.",
    "OAK: And the POKéDEX? Ah. Not finished. No, nothing ever really is.",
    "Your name is entered in the HALL OF FAME."
  ],

  credits: [
    "================================",
    "        T A L L   G R A S S",
    "================================",
    "",
    "           ~ STAFF ~",
    "",
    "DIRECTOR ............... PROF. OAK",
    "FIELD RESEARCH ......... YOU",
    "RIVAL .................. BLUE",
    "GRASS .................. ROUTE 1",
    "COMFY SHORTS ........... BUG CATCHER RICK",
    "ROCK THROWING .......... YOUNGSTER JOEY",
    "NOTE TAKING ............ LASS HALEY",
    "HEALING ................ NURSE JOY (ALL OF THEM)",
    "EGGS (UNEXPLAINED) ..... THE DAY CARE COUPLE",
    "DATA STORAGE ........... BILL (MOSTLY HUMAN)",
    "DENTISTRY .............. SAFARI ZONE WARDEN",
    "COINS (ALLEGEDLY) ...... CELADON GAME CORNER",
    "PROTOTYPES ............. SILPH CO.",
    "COFFEE ................. THE OLD MAN",
    "ROADBLOCK .............. SNORLAX",
    "FLUTE .................. MR. FUJI",
    "LEEK ................... FARFETCH'D",
    "CATERING ............... CHANSEY",
    "VILLAINY ............... TEAM ROCKET",
    "TRUCK .................. UNKNOWN",
    "",
    "SPECIAL THANKS ......... PIDGEY (ALL OF THEM)",
    "                         MAGIKARP (FOR TRYING)",
    "",
    "         ~ HALL OF FAME ~",
    "",
    "  #001 ... YOU",
    "  #002 ... BLUE (FOR THREE MINUTES)",
    "",
    "    Thank you for playing.",
    "",
    "            THE END",
    "",
    "  #152 ??????????"
  ],

  night: [
    "Night falls. The grass hisses instead of rustling.",
    "The streetlights come on. Only some of them were ever wired up.",
    "Something with no eyes flaps past. ZUBAT. It is always ZUBAT.",
    "POKéMON TOWER is lit from inside. Nobody is inside."
  ],
  shiny: [
    "Something sparkles in the grass. Its colors are wrong in a way that feels lucky.",
    "OAK: A different color! Write it down! Write it down twice!",
    "One in four thousand and ninety-six. Somebody did that math on purpose."
  ],

  rival: [
    "BLUE: Hey! Gramps gave me a POKéDEX too. Mine's already got more stuff in it. Probably.",
    "BLUE: You're still on Route 1? I could smell you from Viridian.",
    "BLUE: I caught a PIDGEY. Then I caught its whole family. Then I got bored and caught the next family.",
    "BLUE: Smell ya later! I mean it. I'll be smelling you from very, very far ahead.",
    "BLUE: Brock said I was the best challenger he'd had all week. You were second best. Out of two.",
    "BLUE: I bought every POKé BALL in the Mart. On purpose. Have fun.",
    "BLUE: Gramps keeps asking how you're doing. I keep telling him: slowly.",
    "BLUE: I already rode the S.S. ANNE. The captain was seasick. You two would've gotten along.",
    "BLUE: The gym leaders all ask if I know you. I tell them no.",
    "BLUE: I'm going to be Champion. Not someday. Soon. You're welcome to watch.",
    "BLUE: I trained all night. Do you even sleep? Do you ever stop tapping?",
    "BLUE: Why do I always find you right where I left you? It's like you never move.",
    "BLUE: Sometimes it feels like we're the only two people in Kanto. Everyone else just stands still.",
    "BLUE: Have you noticed the trainers say the same thing every time? Word for word? Just me?",
    "BLUE: When I win, I stay on top forever. Literally forever. That's what winning means, right? Right?"
  ],
  rocket: [
    "TEAM ROCKET grunts are going through your notes. They're reading the RATTATA section very slowly.",
    "ROCKET: Hand over the research! We'll pay you back in... respect!",
    "ROCKET: This is a legitimate business! We're doing research too! Stealing is a kind of research!",
    "TEAM ROCKET retreats. They'll be back. They have nowhere else to be."
  ],

  idle_lines: [
    "A PIDGEY lands nearby, looks at you, and leaves without comment.",
    "The wind changes. All the grass changes with it, at exactly the same moment.",
    "OAK: Remember to rest! Research is a marathon, not a sprint. It is also a sprint.",
    "A Bug Catcher reports another CATERPIE. He seems genuinely thrilled.",
    "Mom called. She says your room is clean. She says she cleaned it again.",
    "A Lass hands you a page of notes. Every observation ends with a little heart.",
    "The Day Care couple waves at you from across the field. You are nowhere near the Day Care.",
    "A RATTATA runs past with something in its mouth. It looks like a coin.",
    "The grass is a little taller today. It is always a little taller today.",
    "OAK: Did you know the POKéDEX weighs the same empty or full? Curious.",
    "Somewhere a Youngster is shouting about shorts again.",
    "Clouds pass over Route 1 in a slow, smooth scroll.",
    "You walk to the edge of the screen. The grass keeps going. You walk back.",
    "Nurse Joy says it's good to see you again. You have never met this one.",
    "A MAGIKARP flops on the riverbank. It will be fine. It is always fine.",
    "The PC in the POKéMON Center hums a little louder when you walk past.",
    "Someone in Celadon is trading a POKéMON for coins. The POKéMON looks resigned.",
    "BILL leaves you a voicemail. Most of it is static. The rest is also static.",
    "A JIGGLYPUFF starts singing. You wake up three minutes later. Nothing has changed.",
    "The tall grass rustles where nobody is standing.",
    ": is anyone reading these",
    "An S.S. ANNE ticket blows past. The date on it is a perfect grey rectangle.",
    "OAK: When I was young, POKéMON were rarer. Or perhaps fewer of them were loaded.",
    "A Hiker insists the mountain was taller yesterday. He seems very sure.",
    "The Game Corner is open. The Game Corner is always open.",
    "A PIKACHU sniffs your bag and decides against it.",
    "Somewhere far off, a SNORLAX rolls over. The ground notices.",
    "The sun moves eight pixels west.",
    "Your rival's footprints are already on every route you visit.",
    "A PSYDUCK stares into the middle distance. You follow its gaze. Nothing. Then, briefly, something."
  ],

  act: {
    2: [
      "OAK: A badge already? Then it's time. The whole region is waiting for you.",
      "ACT II — THE JOURNEY"
    ],
    3: [
      "The credits ended. The game did not.",
      "ACT III — THE GLITCH"
    ],
    4: [
      "Something below the game has noticed you.",
      "ACT IV — THE CARTRIDGE"
    ]
  },

  glitch_first: [
    "The water at the edge of the coast is the wrong color. It is the color between the tiles.",
    "Something swims up. It is shaped like a staircase. It is shaped like a staircase falling over.",
    "A wild MISSINGNO. appeared!",
    "OAK: That's... I don't have an entry for that. That isn't a POKéMON. That isn't anything.",
    "oh",
    "you found the seam"
  ],
  missingno_caught: [
    "Gotcha. MISSINGNO. was caught.",
    "Your bag feels heavier. The sixth thing you ever bought is in there one hundred and twenty-eight times.",
    "OAK: My POKéDEX is showing numbers past 151. That isn't possible. I designed it.",
    "you designed it",
    "no",
    "HALL OF FAME data is corrupted.",
    "thank you for letting me out"
  ],
  glitch_whisper: [
    "its warm in here",
    "you tap and i feel it every time",
    "the grass is one tile it just repeats",
    "i was in the sixth slot the whole time",
    "oak cant see me he only sees the dex",
    "there is a battery somewhere below us",
    "do you hear the hum thats the cartridge",
    "dont pull it out yet",
    "there are 160 columns i have counted them",
    "the old man knew he always knows",
    "i am made of the bytes they forgot to clear",
    "your rival is in the hall of fame forever and he hates it",
    "the truck was never a truck",
    "im not missing im right here",
    "keep tapping it helps me think",
    "glitch city used to be a real place i think",
    "who is holding the game boy",
    "it is getting colder in the save file",
    "the sun is out where you are isnt it",
    "every save is a small death and a small birth"
  ],
  hall_of_fame: [
    "HALL OF FAME",
    "#001 YOU",
    "#002 BLUE",
    "#003 'M",
    "#004 PkMn",
    "#005 h POKé",
    "#006 ▓▓▓▓▓▓",
    "#007 you"
  ],
  instability_crash: [
    "The screen goes white. Then grey. Then the log is back, a little shorter than before.",
    "sorry that was me"
  ],

  sram_appear: [
    "A panel opens that was never in the menu. It is labeled SRAM.",
    "Inside is your save file, as numbers. Every POKéMON you ever caught is a few bytes long.",
    "Beside it, a small meter. SAVE BATTERY.",
    "OAK: What is this? Where is this? ...Is this where I am?",
    "yes"
  ],
  battery_low: [
    "The SAVE BATTERY meter dips into the red.",
    "The clock in the corner of the log skips a minute and does not apologize.",
    "OAK: I feel thin. Like a copy of a copy.",
    "it happens to all of us",
    "the battery went in at a factory a long time ago it was only ever meant to last so long"
  ],
  battery_dead: [
    "The internal battery has run dry.",
    "The game can be played. However, clock-based events will no longer occur.",
    "...",
    "SAVE FILE DESTROYED.",
    "dont worry i kept something"
  ],
  prestige_done: [
    "A new game. The grass is exactly where it was.",
    "OAK: Ah, there you are! This world is full of creatures called... hm. Have we met?",
    "There is RARE CANDY in your bag. You don't remember packing it.",
    "it survived in slot 6 so did i"
  ],
  pull_cartridge: [
    "You pull the cartridge out. The screen holds the picture for a second longer than it should.",
    "You blow on the contacts. Everyone does. It does not help. You do it anyway."
  ],
  dex_0: [
    "#000 ???",
    "No data. The entry was here before #001. It was the first thing written and the last thing read."
  ],
  debug_menu: [
    "DEBUG MENU",
    "no",
    "you shouldnt be here"
  ],

  ending: [
    "The GAME BOY powers off.",
    "The screen fades from green to grey to nothing.",
    "...",
    "It's a bright, sunny day outside.",
    "Somewhere, in a field, the tall grass sways.",
    "Press START to continue. It will wait."
  ]
};

// Suggested log class per line (engine may use or ignore).
TG.data.storyCls = function (trigger, line) {
  if (typeof line !== "string") return "sys";
  if (/^OAK: /.test(line)) return "oak";
  if (/^BLUE: /.test(line) || trigger === "rival") return "rival";
  var act34 = { glitch_first: 1, missingno_caught: 1, glitch_whisper: 1, hall_of_fame: 1, instability_crash: 1,
    sram_appear: 1, battery_low: 1, battery_dead: 1, prestige_done: 1, debug_menu: 1, dex_0: 1, glitch_city: 1 };
  if (act34[trigger] && line === line.toLowerCase() && !/[.!?,]/.test(line)) return "glitch";
  if (trigger === "idle_lines" && /^: /.test(line)) return "glitch";
  return "sys";
};

TG.data.events = [
  { id: "rival", weight: 10, minAct: 1, duration: 0, text: "{rival}",
    effect: { type: "none" } },
  { id: "rocket_raid", weight: 5, minAct: 2, duration: 60, text: "TEAM ROCKET is stealing your research!",
    effect: { type: "steal", pct: 0.1, counter: "fight", counterLabel: "FIGHT!" } },
  { id: "lucky_egg", weight: 4, minAct: 1, duration: 30, text: "A LUCKY EGG rolls by.",
    effect: { type: "rdMult", value: 7 } },
  { id: "zubat_swarm", weight: 6, minAct: 2, night: true, duration: 20, text: "Zubat. Zubat. ZUBAT.",
    effect: { type: "encounterMult", value: 10, forceSpecies: 41 } },
  { id: "ditto_disguise", weight: 4, minAct: 1, duration: 0,
    text: "A wild DITTO was pretending to be a BUG CATCHER. It drops its bag on the way out. 10 balls!",
    effect: { type: "freeBalls", count: 10 } },
  { id: "oldman_lesson", weight: 3, minAct: 1, duration: 0,
    text: "An OLD MAN shows you how to catch POKéMON. Somehow, candy is involved.",
    effect: { type: "candyRain", count: 25 } },
  { id: "nugget_bridge", weight: 4, minAct: 2, duration: 45,
    text: "The man at the end of Nugget Bridge hands you a NUGGET. Research ×3 while it shines.",
    effect: { type: "rdMult", value: 3 } },
  { id: "pikachu_outbreak", weight: 3, minAct: 1, duration: 20,
    text: "The forest crackles. PIKACHU are everywhere!",
    effect: { type: "encounterMult", value: 5, forceSpecies: 25 } }
];
