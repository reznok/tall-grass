/* TALL GRASS — js/data/gyms.js (content agent)
 * TG.data.gyms: 8 gyms, Elite Four (badgeIndex 9–12, badge null), Champion (13). Schema per
 * docs/ARCHITECTURE.md, plus:
 *  - defeatQuote: string — the leader's line after losing (log it with the reward).
 *  - title: string — short role label for UI ("Gym Leader", "Elite Four", "Champion").
 *  - requires.gyms: [gymId...] (optional) — gyms that must already be beaten (Elite Four order).
 * Badge flags exactly per DESIGN.md: mart, daycare, bike, cut, surf, fly, lab_cinnabar+strength,
 * victory_road; Champion sets "champion".
 * Gym ids match their city; they are a separate namespace from route ids.
 */
window.TG = window.TG || {};
TG.data = TG.data || {};

(function () {
  function Q(o) {
    return {
      dexCount: o.dexCount || 0,
      types: o.types || {},
      routes: o.routes || [],
      badges: o.badges || 0,
      flags: o.flags || [],
      gyms: o.gyms || []
    };
  }

  TG.data.gyms = [
    {
      id: "pewter", name: "Pewter Gym", leader: "Brock", title: "Gym Leader", badge: "Boulder Badge", badgeIndex: 1,
      cost: 2500,
      requires: Q({ dexCount: 8, types: { Water: 1 }, routes: ["viridian_forest"], badges: 0 }),
      quote: "My POKéMON are like stone: patient, heavy, hard to move. Let's see how hard you can push.",
      defeatQuote: "You moved a mountain. Take the badge and keep walking. I'll stay here and keep standing.",
      reward: { flags: ["mart"], globalMult: 1.25, unlockTabs: [], log: "BROCK hands you the BOULDER BADGE. The POKé MART opens its doors." },
      spriteKey: null
    },
    {
      id: "cerulean", name: "Cerulean Gym", leader: "Misty", title: "Gym Leader", badge: "Cascade Badge", badgeIndex: 2,
      cost: 1e5,
      requires: Q({ dexCount: 18, types: { Grass: 1, Electric: 1 }, routes: ["cerulean"], badges: 1 }),
      quote: "My strategy? All-out offense with water. Try to keep your head above it.",
      defeatQuote: "Ugh, fine! Take it. Don't think this makes us friends. ...Okay, maybe a little.",
      reward: { flags: ["daycare"], globalMult: 1.25, unlockTabs: [], log: "MISTY hands you the CASCADE BADGE. A couple on Route 5 starts a DAY CARE." },
      spriteKey: null
    },
    {
      id: "vermilion", name: "Vermilion Gym", leader: "Lt. Surge", title: "Gym Leader", badge: "Thunder Badge", badgeIndex: 3,
      cost: 2e6,
      requires: Q({ dexCount: 28, types: { Ground: 2 }, routes: ["vermilion"], badges: 2 }),
      quote: "Hey, kid! Electric types kept me alive in the war. Let's see if they keep you humble!",
      defeatQuote: "Whoa! You're the real deal, kid. That was a genuinely shocking performance.",
      reward: { flags: ["bike"], globalMult: 1.25, unlockTabs: [], log: "LT. SURGE hands you the THUNDER BADGE. Someone gives you a BICYCLE. Tap power ×5." },
      spriteKey: null
    },
    {
      id: "celadon", name: "Celadon Gym", leader: "Erika", title: "Gym Leader", badge: "Rainbow Badge", badgeIndex: 4,
      cost: 3e8,
      requires: Q({ dexCount: 40, types: { Fire: 1, Poison: 4 }, routes: ["celadon"], badges: 3 }),
      quote: "Oh, I was dozing. The garden is so peaceful today. Shall we disturb it a little?",
      defeatQuote: "Oh my. You battle like a summer storm. Please take this, and visit the garden again.",
      reward: { flags: ["cut"], globalMult: 1.25, unlockTabs: [], log: "ERIKA hands you the RAINBOW BADGE. You can now use CUT. The harbor gate opens." },
      spriteKey: null
    },
    {
      id: "fuchsia", name: "Fuchsia Gym", leader: "Koga", title: "Gym Leader", badge: "Soul Badge", badgeIndex: 5,
      cost: 4e9,
      requires: Q({ dexCount: 55, types: { Psychic: 2, Ground: 4 }, routes: ["fuchsia"], badges: 4 }),
      quote: "Fwahaha! A ninja does not fight fair. A ninja fights to win. You will not see me coming.",
      defeatQuote: "You saw through every trick. Few ever have. Take the Soul Badge and walk upon the water.",
      reward: { flags: ["surf"], globalMult: 1.25, unlockTabs: [], log: "KOGA hands you the SOUL BADGE. You can now SURF. The sea opens up." },
      spriteKey: null
    },
    {
      id: "saffron", name: "Saffron Gym", leader: "Sabrina", title: "Gym Leader", badge: "Marsh Badge", badgeIndex: 6,
      cost: 3e10,
      requires: Q({ dexCount: 70, types: { Bug: 6, Ghost: 2 }, routes: ["saffron"], badges: 5 }),
      quote: "I already know how this ends. Not the battle. All of it. I have watched it end many times.",
      defeatQuote: "I saw this too. I hoped I was wrong. Take the badge. Fly far. It won't be far enough.",
      reward: { flags: ["fly"], globalMult: 1.25, unlockTabs: [], log: "SABRINA hands you the MARSH BADGE. You can now FLY. Time away counts for more." },
      spriteKey: null
    },
    {
      id: "cinnabar", name: "Cinnabar Gym", leader: "Blaine", title: "Gym Leader", badge: "Volcano Badge", badgeIndex: 7,
      cost: 1.5e11,
      requires: Q({ dexCount: 85, types: { Water: 12, Ground: 6 }, routes: ["cinnabar"], badges: 6 }),
      quote: "Hah! Hope you packed BURN HEAL, because my quiz only has one answer, and it's FIRE!",
      defeatQuote: "I've burned out! The Volcano Badge is yours. Go see the lab. They've been expecting you.",
      reward: { flags: ["lab_cinnabar", "strength"], globalMult: 1.25, unlockTabs: [], log: "BLAINE hands you the VOLCANO BADGE. The CINNABAR LAB opens. You can now use STRENGTH." },
      spriteKey: null
    },
    {
      id: "viridian", name: "Viridian Gym", leader: "Giovanni", title: "Gym Leader", badge: "Earth Badge", badgeIndex: 8,
      cost: 6e11,
      requires: Q({ dexCount: 100, types: { Water: 15, Grass: 10, Ice: 2 }, routes: ["route21"], badges: 7 }),
      quote: "So. The child who keeps interfering. I built this gym. I do not intend to lose it to you.",
      defeatQuote: "Hmph. My organization is finished, for now. Wear the Earth Badge. The road ahead is long.",
      reward: { flags: ["victory_road"], globalMult: 1.25, unlockTabs: [], log: "GIOVANNI hands you the EARTH BADGE. The road to the INDIGO PLATEAU opens." },
      spriteKey: null
    },
    {
      id: "lorelei", name: "Elite Four", leader: "Lorelei", title: "Elite Four", badge: null, badgeIndex: 9,
      cost: 1.5e12,
      requires: Q({ dexCount: 105, types: { Electric: 5, Fighting: 3 }, routes: ["victory_road"], badges: 8, flags: ["victory_road"] }),
      quote: "Welcome to the League. Ice is patient. It will wait as long as it takes for you to freeze.",
      defeatQuote: "You thawed me out. Go on, then. Three more doors.",
      reward: { flags: [], globalMult: 1.5, unlockTabs: [], log: "LORELEI steps aside. The next door opens." },
      spriteKey: null
    },
    {
      id: "bruno", name: "Elite Four", leader: "Bruno", title: "Elite Four", badge: null, badgeIndex: 10,
      cost: 3e12,
      requires: Q({ dexCount: 110, types: { Psychic: 6, Flying: 8 }, routes: ["victory_road"], badges: 8, flags: ["victory_road"], gyms: ["lorelei"] }),
      quote: "I have trained in the mountains for a decade. Muscle is a kind of truth. Hoo hah!",
      defeatQuote: "Brains over brawn. I accept it. Then I will go back to the mountains and train twice as hard.",
      reward: { flags: [], globalMult: 1.5, unlockTabs: [], log: "BRUNO bows deeply. The next door opens." },
      spriteKey: null
    },
    {
      id: "agatha", name: "Elite Four", leader: "Agatha", title: "Elite Four", badge: null, badgeIndex: 11,
      cost: 6e12,
      requires: Q({ dexCount: 115, types: { Psychic: 8, Ground: 8 }, routes: ["victory_road"], badges: 8, flags: ["victory_road"], gyms: ["bruno"] }),
      quote: "Oak's errand child, is it? He was a fine trainer once. Let me show you what old ghosts do.",
      defeatQuote: "Hmph. You win, child. Tell that old fool Oak I said so. And tell him I said 'once'.",
      reward: { flags: [], globalMult: 1.5, unlockTabs: [], log: "AGATHA cackles and waves you on. The next door opens." },
      spriteKey: null
    },
    {
      id: "lance", name: "Elite Four", leader: "Lance", title: "Elite Four", badge: null, badgeIndex: 12,
      cost: 1.2e13,
      requires: Q({ dexCount: 120, types: { Ice: 4, Dragon: 1 }, routes: ["victory_road"], badges: 8, flags: ["victory_road"], gyms: ["agatha"] }),
      quote: "I have been waiting for you. Dragons are the oldest and proudest POKéMON. They do not bow.",
      defeatQuote: "So you are the one. Go. Your rival is already in the last room. He got there first.",
      reward: { flags: [], globalMult: 1.5, unlockTabs: [], log: "LANCE stands aside. The last door opens." },
      spriteKey: null
    },
    {
      id: "champion", name: "Indigo Plateau", leader: "BLUE", title: "Champion", badge: null, badgeIndex: 13,
      cost: 3e13,
      requires: Q({ dexCount: 125, types: { Fire: 5, Water: 20, Grass: 12, Electric: 8 }, routes: ["victory_road"], badges: 8, flags: ["victory_road"], gyms: ["lance"] }),
      quote: "Hey! I've been the Champion for about three minutes. You want it? Come and take it.",
      defeatQuote: "What? I was supposed to win. I was always supposed to win. Gramps... why are you smiling?",
      reward: { flags: ["champion"], globalMult: 2, unlockTabs: [], log: "You are the POKéMON LEAGUE CHAMPION. Your name goes into the Hall of Fame." },
      spriteKey: null
    }
  ];
})();
