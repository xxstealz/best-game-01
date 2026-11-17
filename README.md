[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/xxstealz/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/xxstealz/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Emberward

**The last ember must not go out.** A top-down arena shooter in plain HTML5 canvas:
you are the Warden of the last ember, holding a circle of light against waves of
shadow creatures. Clear each wave, choose an upgrade, and defeat the Hollow King
on wave 10 to win the run — or keep playing endless after that.

## How to play

- **WASD / Arrow keys** — move
- **Mouse** — aim
- **Hold Click / Space** — fire light bolts
- **1 / 2 / 3 or click a card** — choose an upgrade between waves
- **P / Esc** — pause · **M** — mute · **R** — restart · **C** — continue endless after victory

## The game

- **10 waves, then a win.** Waves 1–4 teach the enemy kinds; wave 5 brings the
  Gloom Herald; wave 10 brings the Hollow King. Beat him and the run is won.
- **Six shadow kinds**, each with its own movement and attack: Wisps that chase,
  Skitters that zig-zag, Spitters that shoot back, Splitters that divide when
  killed, heavy Brutes, and two bosses with radial bursts and summons.
- **Upgrades that matter.** After every wave you pick 1 of 3: more damage, faster
  fire, multishot, piercing bolts, ricochet, crits, a recharging ward, and more.
  Builds diverge fast.
- **Score and combo.** Kills chain a combo multiplier; wave clears pay a bonus;
  the best score is kept between visits.
- **Feel.** Particles, screen shake, hit-stop on big kills, floating damage
  numbers, damage flash, and a fully synthesized WebAudio soundscape — shots,
  deaths, pickups, wave fanfares, boss alarms, and a dark bass-and-pluck score
  that gets busier as the waves rise. No audio files, no network: everything is
  generated in code.
- **Pickups.** Fallen shadows drop hearts, score shards, and rapid-fire stars;
  your magnet pulls them in.

## Play it

Open `game/index.html` in a desktop browser (or `node serve.ts`, then
http://localhost:8080). No build step, no network request: every file the game
loads lives under `game/`.

## Files

| File | Job |
| --- | --- |
| `game/index.html` | The page: a full-window canvas |
| `game/src/main.js` | Boot and the fixed-step loop, screens |
| `game/src/world.js` | The simulation: state, waves, scoring |
| `game/src/config.js` | Every tuning number and colour |
| `game/src/player.js` | The Warden: move, aim, fire, take hits |
| `game/src/enemies.js` | Shadow kinds, their AI, bosses |
| `game/src/projectiles.js` | Light bolts and shadow bolts |
| `game/src/pickups.js` | Hearts, shards, stars |
| `game/src/particles.js` | Sparks, rings, floating text |
| `game/src/waves.js` | Wave composition and boss waves |
| `game/src/upgrades.js` | The upgrade cards |
| `game/src/audio.js` | Synthesized sound and music |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/render.js` | All drawing: arena, HUD, screens |
| `game/src/shots.js` | Deterministic screenshot scenes |
| `game/src/random.js` | Seeded RNG |
| `game/src/storage.js` | Best score and mute, in localStorage |
| `main.ts` | Hands the game in: copies `game/` + `screenshots/`, writes `dossier.json` |
| `serve.ts` | Serves `game/` on http://localhost:8080 |

## License

MIT — see `LICENSE`.
