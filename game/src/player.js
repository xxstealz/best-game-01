// The player: the Warden of the last ember. Moves with WASD or arrows, aims with the
// mouse, fires light bolts while the mouse or Space is held. Takes hits through the
// shield first, then health, with a second of mercy after each hit.

import { FIELD, PLAYER } from './config.js';
import { firePlayerBolts } from './projectiles.js';
import { spawnBurst, spawnText } from './particles.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;

export function createPlayer() {
  return {
    x: FIELD.width / 2, y: FIELD.height / 2 + 80,
    vx: 0, vy: 0, r: PLAYER.r,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    alive: true,
    // Multipliers and stacks from upgrades; 1 is unmodified.
    speedMul: 1, damageMul: 1, fireMul: 1,
    projectiles: 1, pierce: 0, ricochet: 0, crit: 0, magnetMul: 1,
    shieldMax: 0, shield: 0, shieldTimer: 0,
    fireTimer: 0, invuln: 0, rapidTimer: 0,
    aimAngle: -Math.PI / 2,
  };
}

export function updatePlayer(state, controls, dt) {
  const p = state.player;
  if (!p.alive) return;
  // Smooth movement toward the held direction.
  const tx = controls.move.x * PLAYER.speed * p.speedMul;
  const ty = controls.move.y * PLAYER.speed * p.speedMul;
  const k = 1 - Math.pow(0.0001, dt);
  p.vx += (tx - p.vx) * k;
  p.vy += (ty - p.vy) * k;
  p.x = Math.max(p.r + 6, Math.min(FIELD.width - p.r - 6, p.x + p.vx * dt));
  p.y = Math.max(p.r + 6, Math.min(FIELD.height - p.r - 6, p.y + p.vy * dt));
  p.aimAngle = Math.atan2(controls.aim.y - p.y, controls.aim.x - p.x);
  state.aim = controls.aim;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.rapidTimer > 0) p.rapidTimer -= dt;
  if (p.shieldMax > 0 && p.shield <= 0) {
    p.shieldTimer -= dt;
    if (p.shieldTimer <= 0) {
      p.shield = 1;
      spawnText(state, p.x, p.y - 26, 'WARD UP', '#8b93a3', 13);
    }
  }
  p.fireTimer -= dt;
  if (controls.firing && p.fireTimer <= 0) {
    const rate = PLAYER.fireRate * p.fireMul * (p.rapidTimer > 0 ? 2 : 1);
    p.fireTimer = 1 / rate;
    firePlayerBolts(state);
  }
}

export function damagePlayer(state, dmg) {
  const p = state.player;
  if (!p.alive || p.invuln > 0 || dmg <= 0) return;
  if (p.shield > 0) {
    p.shield = 0;
    p.shieldTimer = 18;
    p.invuln = 0.6;
    spawnText(state, p.x, p.y - 26, 'BLOCKED', '#8b93a3', 15);
    spawnBurst(state, p.x, p.y, '#9aa3b8', 10, 160, 0.35, 3);
    state.sfx.push('hit');
    state.events |= EVENT_HIT;
    return;
  }
  p.hp -= dmg;
  p.invuln = PLAYER.invuln;
  state.shake = Math.min(1, state.shake + 0.45);
  state.events |= EVENT_HIT;
  state.sfx.push('hurt');
  spawnBurst(state, p.x, p.y, '#ff5e6e', 12, 200, 0.4, 3);
  spawnText(state, p.x, p.y - 26, `-${Math.round(dmg)}`, '#ff5e6e', 15);
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    state.events |= EVENT_OVER;
    state.sfx.push('gameOver');
    spawnBurst(state, p.x, p.y, '#ffd97a', 46, 320, 0.9, 4);
    spawnBurst(state, p.x, p.y, '#ff5e6e', 30, 240, 0.7, 3);
    state.shake = 1;
  }
}

export function healPlayer(state, amount) {
  const p = state.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}
