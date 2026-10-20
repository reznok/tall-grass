# Tall Grass

A Pokémon-themed idle / incremental game. Tap the grass. Fill the Pokédex. Keep going.

No spoilers here. (`docs/DESIGN.md` has all of them — don't read it if you want the surprises.)

## Play

It is a static site with no build step. Any of these work:

- Open `index.html` directly in a browser.
- Serve the folder with any static server, e.g.

```bash
python -m http.server 8765
```

then open http://localhost:8765.

- Host the folder on GitHub Pages / Netlify / any static host.

On a phone, open the hosted URL and use "Add to Home Screen" — it installs as an offline-capable app.

## Saving

The game autosaves to the browser's local storage every 10 seconds. Progress continues while you're away (with a cap). The Lab tab has export/import for moving a save between devices.

## Tech

Vanilla HTML/CSS/JS, no dependencies. `js/engine.js` is the simulation, `js/ui.js` the rendering, `js/data/*` the content, `js/systems/*` the later layers. `docs/ARCHITECTURE.md` describes the data contracts.

All pixel art is original 16×16 work drawn for this project. Fan project, non-commercial. Pokémon is © Nintendo / Creatures / GAME FREAK.
