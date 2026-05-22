# Skyward Sprout

**Skyward Sprout** is an original vertical endless-jumper for the browser, built with plain HTML/CSS/JavaScript and the Canvas API. No backend, no build step, and no third-party game assets.

The player controls a small sprout that automatically jumps from platforms, climbs through changing biomes, collects orbs and bonuses, and avoids spikes and flying enemies. Best score and mute settings are saved in `localStorage`.

## Live

- GitHub Pages: https://yokki-vans.github.io/platformer/
- Repository: https://github.com/yokki-vans/platformer

## Controls

### Desktop

- `←` / `→` — movement
- `A` / `D` — movement
- `Space` / `Enter` — start, restart, emergency jump when Double Jump is active
- `P` / `Esc` — pause

### Mobile

- Left/right buttons at the bottom of the screen — movement
- Center button — emergency jump when Double Jump is active
- Layout uses `100dvh`, safe-area insets, and a flex structure: root flex column, canvas panel `flex: 1; min-height: 0`, controls below the canvas.
- On desktop, mobile buttons are hidden; on touch/mobile viewports, large accessible buttons are shown without vertical scrolling.

## Features

- Infinite vertical platform generation.
- Auto-jump after landing.
- Horizontal movement with edge wrap.
- Camera scrolls smoothly upward and does not drop back down.
- HUD shows height, score, and best score without a separate biome badge.
- Best score and mute state are saved in `localStorage`.
- States: start, playing, pause, game over, restart.
- Reachability validation:
  - generator calculates `maxJumpHeight = jumpVelocity² / (2 * gravity)`;
  - accounts for airtime and maximum horizontal reach;
  - vertical and horizontal gaps are kept within safe margins;
  - hazard platforms never become mandatory waypoints;
  - when a spike/hazard platform appears, a safe alternative platform is generated.
- Platform types:
  - normal
  - moving
  - fragile/breaking
  - boost
  - hazard/spike
- Bonuses:
  - Spring boost
  - Jetpack / temporary flight
  - Shield
  - Magnet
  - Double / emergency jump
  - Score Multiplier
  - Low Gravity
- Collectible orbs grant score.
- Magnet attracts collectibles.
- Spikes and flying enemies end the run if there is no shield.
- Shield absorbs one hazard hit.
- Biome heights:
  - 0–500: grass/sky
  - 500–1200: clouds
  - 1200–2200: snow/ice
  - 2200–3500: space
  - 3500+: neon/cosmic
- Biomes change background, platform colors, and particles, with smooth transitions and no separate HUD label.
- Canvas animations:
  - player movement/jump/fall/boost
  - squash/stretch
  - landing particles
  - collectible/perk bob/rotation
  - game over shake
  - biome transition flash
- Web Audio API sounds without external files:
  - jump
  - collect
  - perk
  - shield/damage
  - game over
  - biome transition
  - button click

## Local Run

You can open `index.html` directly or run the static server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

## Structure

```text
/index.html
/styles.css
/game.js
/README.md
/.github/workflows/pages.yml
```

## Checks

Completed local checks:

- `node --check game.js`
- HTML parse via Python `html.parser`
- YAML parse workflow
- `git diff --check`
- Desktop runtime via headless Chrome/CDP:
  - start/restart
  - Arrow/A-D movement
  - pause/resume
  - shield hit absorption
  - score multiplier effect
  - game over state
- Mobile runtime/layout via headless Chrome/CDP:
  - viewport 596×1280, 390×844, and 360×640
  - `docH == innerH`, no page scroll
  - mobile controls visible and inside viewport
  - canvas uses remaining height above controls
  - HUD cards do not overlap pause/mute buttons
  - pointerdown/pointerup on mobile right button changes movement state
- Procedural generation validation:
  - generated sample path to 9000px height
  - unreachable anchors: 0
  - hazard-only paths: 0

## Deployment

The repository is configured for GitHub Pages via the GitHub Actions workflow `.github/workflows/pages.yml`.

After pushing to the `master` branch, the workflow publishes the repository root to GitHub Pages:

```text
https://yokki-vans.github.io/platformer/
```

## Known limitations

- This is a static single-player arcade game without a server-side leaderboard.
- Web Audio starts only after the first user interaction — this is a browser requirement.
- Touch layout is verified using headless viewport emulation; a final visual check on a real phone is still useful due to differences in mobile browser UI/safe-area.
