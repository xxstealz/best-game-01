// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the real rules
// forward from a fresh world for a fixed time, steered by a simple autopilot (kite away
// from danger, aim at the nearest shadow, fire always), so the frame is what a real
// game looks like and the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { stepWorld, startRun, chooseUpgrade } from './world.js';
import { UPGRADES } from './upgrades.js';
import { damagePlayer } from './player.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const BOSS_SECONDS = 75;
const END_LIMIT_SECONDS = 240;

/** The autopilot's controls for one step. */
function autopilot(state, careless) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  if (!careless) {
    // Repulsion from nearby enemies and bolts.
    for (const e of state.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 190) {
        const w = (190 - d) / 190;
        mx += (dx / d) * w * 2.2;
        my += (dy / d) * w * 2.2;
      }
    }
    for (const b of state.enemyBolts) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 130) {
        const w = (130 - d) / 130;
        mx += (dx / d) * w * 1.6;
        my += (dy / d) * w * 1.6;
      }
    }
    // A gentle pull toward the nearest pickup.
    let pk = null;
    let pkD = 220;
    for (const item of state.pickups) {
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < pkD) {
        pkD = d;
        pk = item;
      }
    }
    if (pk) {
      mx += ((pk.x - p.x) / pkD) * 0.5;
      my += ((pk.y - p.y) / pkD) * 0.5;
    }
    // Stay off the walls.
    const m = 90;
    if (p.x < m) mx += 1;
    if (p.x > FIELD.width - m) mx -= 1;
    if (p.y < m) my += 1;
    if (p.y > FIELD.height - m) my -= 1;
  } else {
    // Careless: drift in a slow circle and never dodge.
    mx = Math.cos(state.time * 0.7);
    my = Math.sin(state.time * 0.7);
  }
  const len = Math.hypot(mx, my) || 1;
  // Aim at the nearest enemy (the boss first, when there is one).
  let target = state.boss;
  if (!target) {
    let best = Infinity;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) {
        best = d;
        target = e;
      }
    }
  }
  const aim = target ? { x: target.x, y: target.y } : { x: p.x, y: p.y - 120 };
  return {
    move: { x: mx / len, y: my / len },
    aim,
    firing: true,
    actions: 0,
    click: null,
  };
}

function runSteps(state, seconds, careless, stopWhen) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, autopilot(state, careless), STEP);
    if (state.mode === 'upgrade') {
      // The autopilot takes an upgrade and keeps playing.
      chooseUpgrade(state, state.rng.int(0, 2));
    }
    if (stopWhen && stopWhen(state)) break;
    if (!state.player.alive) break;
  }
}

/**
 * Set the world to the named scene (start, play, boss or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world;
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      stepWorld(state, null, STEP);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  startRun(state);
  if (name === 'play') {
    // A busy regular-wave frame: mid-wave 6, after the wave-5 boss.
    // (Wave 6 has the full enemy mix and a fat spawn queue, so the field is crowded.)
    runSteps(state, 90, false, (s) => s.wave >= 6 && s.mode === 'play');
    runSteps(state, 6, false);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'boss') {
    // A seasoned warden for the boss portrait: real upgrades, applied the same way
    // the game applies them, and a sturdier heart for the long fight.
    const p = state.player;
    for (const id of ['damage', 'multishot', 'pierce', 'rapid']) {
      const def = UPGRADES.find((u) => u.id === id);
      def.apply(p);
      state.upgradeLevels[id] = (state.upgradeLevels[id] || 0) + 1;
    }
    p.hp = 400;
    p.maxHp = 400;
    // Play until wave 5 is under way.
    runSteps(state, BOSS_SECONDS, false, (s) => s.wave >= 5 && s.mode === 'play');
    // Then until the boss is hurt and the fight is busy — the boss bar showing.
    // The boss is still healthy here, so the shot reads as a fight, not a mop-up.
    runSteps(state, 25, false, (s) => s.boss && s.boss.hp < s.boss.maxHp * 0.7);
    // One more second so a radial burst is likely on screen.
    runSteps(state, 1, false);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  // end: a careless warden who fights hard but falls late — a real, long run.
  state.player.hp = 100;
  runSteps(state, END_LIMIT_SECONDS, true);
  if (state.player.alive) {
    // Still standing after the cap: end it with a real, ordinary hit.
    damagePlayer(state, state.player.hp);
  }
  return { screen: SCREEN_OVER, best: state.score };
}
