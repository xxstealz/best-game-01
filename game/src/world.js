// The world: the whole simulation in one state object. It owns the player, the
// enemies, the bolts, the pickups and the particles, advances them in fixed steps,
// and reports what happened through state.events (screen changes) and state.sfx
// (sound names for the audio engine). The renderer only reads this state; it never
// changes a rule.

import { FIELD, FINAL_WAVE, STEP } from './config.js';
import { createPlayer, damagePlayer, updatePlayer, EVENT_HIT, EVENT_OVER } from './player.js';
import { updateEnemies, spawnEnemy, EVENT_BOSS_DIED } from './enemies.js';
import { updateProjectiles } from './projectiles.js';
import { updatePickups } from './pickups.js';
import { updateParticles, spawnText } from './particles.js';
import { rollChoices, applyUpgrade } from './upgrades.js';
import { startWave, spawnNext } from './waves.js';

export { EVENT_HIT, EVENT_OVER };
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_UPGRADE = 8;
export const EVENT_VICTORY = 16;
export { EVENT_BOSS_DIED };

const EMBER_COUNT = 42;

export function createWorld(rng) {
  const state = {
    rng,
    time: 0,
    mode: 'attract', // attract | play | upgrade | over | victory
    wave: 0,
    score: 0,
    best: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    player: createPlayer(),
    aim: { x: FIELD.width / 2, y: FIELD.height / 2 - 120 },
    enemies: [],
    bolts: [],
    enemyBolts: [],
    pickups: [],
    particles: [],
    texts: [],
    embers: [],
    spawnQueue: [],
    spawnTimer: 0,
    spawnGap: 0.6,
    boss: null,
    banner: null,
    shake: 0,
    hitStop: 0,
    pendingDamage: 0,
    upgradeLevels: {},
    upgradeChoices: [],
    stats: { shots: 0, hits: 0 },
    events: 0,
    sfx: [],
    lure: { x: FIELD.width / 2, y: FIELD.height / 2, angle: 0 },
  };
  resetWorld(state);
  return state;
}

function initEmbers(state) {
  state.embers = [];
  for (let i = 0; i < EMBER_COUNT; i += 1) {
    state.embers.push({
      x: state.rng.range(0, FIELD.width),
      y: state.rng.range(0, FIELD.height),
      vy: state.rng.range(6, 22),
      sway: state.rng.range(0.4, 1.4),
      phase: state.rng.range(0, Math.PI * 2),
      size: state.rng.range(1, 2.6),
      alpha: state.rng.range(0.15, 0.5),
    });
  }
}

export function resetWorld(state) {
  state.time = 0;
  state.mode = 'attract';
  state.wave = 0;
  state.score = 0;
  state.kills = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.player = createPlayer();
  state.player.alive = false; // the title screen has no player to hurt
  state.aim = { x: FIELD.width / 2, y: FIELD.height / 2 - 120 };
  state.enemies = [];
  state.bolts = [];
  state.enemyBolts = [];
  state.pickups = [];
  state.particles = [];
  state.texts = [];
  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.boss = null;
  state.banner = null;
  state.shake = 0;
  state.hitStop = 0;
  state.pendingDamage = 0;
  state.upgradeLevels = {};
  state.upgradeChoices = [];
  state.stats = { shots: 0, hits: 0 };
  state.events = 0;
  state.sfx = [];
  state.lure = { x: FIELD.width / 2, y: FIELD.height / 2, angle: 0 };
  initEmbers(state);
  // A few wisps drift behind the title screen.
  for (let i = 0; i < 5; i += 1) {
    const a = state.rng.angle();
    const r = 180 + state.rng.range(0, 160);
    spawnEnemy(state, 'wisp',
      FIELD.width / 2 + Math.cos(a) * r, FIELD.height / 2 + Math.sin(a) * r);
  }
}

/** Begin a fresh run: a live player, wave 1, the clock running. */
export function startRun(state) {
  resetWorld(state);
  state.player = createPlayer();
  state.player.alive = true;
  state.mode = 'play';
  startWave(state, 1);
}

/** After an upgrade is chosen, open the next wave. */
export function beginNextWave(state) {
  state.upgradeChoices = [];
  state.mode = 'play';
  startWave(state, state.wave + 1);
}

/** After victory, keep playing past wave 10 with no more win screen. */
export function continueEndless(state) {
  state.mode = 'play';
  startWave(state, state.wave + 1);
}

function updateEmbers(state, dt) {
  for (const e of state.embers) {
    e.y -= e.vy * dt;
    e.phase += dt * e.sway;
    e.x += Math.sin(e.phase) * 12 * dt;
    if (e.y < -4) {
      e.y = FIELD.height + 4;
      e.x = state.rng.range(0, FIELD.width);
    }
  }
}

// The HOW TO PLAY panel on the title screen (render.js drawTitle), expanded
// by a margin so the attract-mode wisps never cross its edge.
const TITLE_PANEL = { x: 350 - 28, y: 392 - 28, w: 580 + 56, h: 132 + 56 };

function keepWispsOffPanel(state) {
  for (const e of state.enemies) {
    if (e.x < TITLE_PANEL.x || e.x > TITLE_PANEL.x + TITLE_PANEL.w
      || e.y < TITLE_PANEL.y || e.y > TITLE_PANEL.y + TITLE_PANEL.h) continue;
    // Inside the keep-out: push out through the nearest edge.
    const left = e.x - TITLE_PANEL.x;
    const right = TITLE_PANEL.x + TITLE_PANEL.w - e.x;
    const top = e.y - TITLE_PANEL.y;
    const bottom = TITLE_PANEL.y + TITLE_PANEL.h - e.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) e.x = TITLE_PANEL.x - e.r;
    else if (m === right) e.x = TITLE_PANEL.x + TITLE_PANEL.w + e.r;
    else if (m === top) e.y = TITLE_PANEL.y - e.r;
    else e.y = TITLE_PANEL.y + TITLE_PANEL.h + e.r;
  }
}

function updateAttract(state, dt) {
  // The lure wanders; the title wisps chase it, harmlessly.
  state.lure.angle += dt * 0.25;
  state.lure.x = FIELD.width / 2 + Math.cos(state.lure.angle) * 220;
  // Keep the lure above the HOW TO PLAY panel, so the wisps mostly drift
  // in the open upper area instead of crossing the panel.
  state.lure.y = FIELD.height / 2 - 40 + Math.sin(state.lure.angle * 1.3) * 60;
  state.player.x = state.lure.x;
  state.player.y = state.lure.y;
  updateEnemies(state, dt);
  keepWispsOffPanel(state);
  updateParticles(state, dt);
  updateEmbers(state, dt);
}

function checkWaveClear(state) {
  if (state.spawnQueue.length > 0 || state.enemies.length > 0 || state.boss) return;
  if (state.wave === FINAL_WAVE) {
    state.mode = 'victory';
    state.events |= EVENT_VICTORY;
    state.sfx.push('victory');
    return;
  }
  const bonus = 100 * state.wave;
  state.score += bonus;
  spawnText(state, FIELD.width / 2, FIELD.height / 2 - 60, `WAVE BONUS +${bonus}`, '#f2c94c', 20);
  state.upgradeChoices = rollChoices(state.rng, state.upgradeLevels);
  state.mode = 'upgrade';
  state.events |= EVENT_WAVE_CLEAR | EVENT_UPGRADE;
  state.sfx.push('waveClear');
}

/** Advance the simulation one fixed step. Controls are null on the title screen. */
export function stepWorld(state, controls, dt = STEP) {
  state.events = 0;
  if (state.hitStop > 0) {
    state.hitStop -= dt;
    return;
  }
  updateEmbers(state, dt);
  if (state.banner) {
    state.banner.timer -= dt;
    if (state.banner.timer <= 0) state.banner = null;
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.8);
  if (state.mode === 'attract') {
    updateAttract(state, dt);
    return;
  }
  if (state.mode !== 'play') {
    updateParticles(state, dt);
    return;
  }
  state.time += dt;
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }
  updatePlayer(state, controls, dt);
  // Trickle the wave in from the edges.
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = state.spawnGap * (0.8 + state.rng.next() * 0.4);
      spawnNext(state);
    }
  }
  updateEnemies(state, dt);
  updateProjectiles(state, dt);
  updatePickups(state, dt);
  updateParticles(state, dt);
  if (state.pendingDamage > 0) {
    const dmg = state.pendingDamage;
    state.pendingDamage = 0;
    damagePlayer(state, dmg);
  }
  if (state.player.alive) checkWaveClear(state);
}

/** Apply an upgrade choice by index (0, 1 or 2) and open the next wave. */
export function chooseUpgrade(state, index) {
  const choice = state.upgradeChoices[index];
  if (!choice) return false;
  applyUpgrade(state, choice);
  state.sfx.push('upgrade');
  beginNextWave(state);
  return true;
}
