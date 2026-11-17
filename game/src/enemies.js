// Enemies: the shadow creatures. Each kind has its own movement and attack; bosses
// add radial bursts and summons. A kill awards score through the combo multiplier,
// bursts into particles, and may drop a pickup. Contact with the player queues damage
// in state.pendingDamage for the world to apply once per step.

import { ENEMIES, FIELD } from './config.js';
import { spawnBurst, spawnRing, spawnText } from './particles.js';
import { dropRoll } from './pickups.js';

/** One shadow bolt, pushed straight into the enemy-bolt list (same shape as projectiles'). */
function fireBolt(state, x, y, angle, speed, dmg) {
  state.enemyBolts.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 6, dmg, life: 4,
  });
}

export const EVENT_BOSS_DIED = 64;

function scaleWithWave(def, wave) {
  // Enemies get tougher as waves rise, so early waves stay fair and late ones bite.
  const hpMul = 1 + (wave - 1) * 0.14;
  const speedMul = 1 + Math.min(0.35, (wave - 1) * 0.025);
  return { hp: def.hp * hpMul, speed: def.speed * speedMul };
}

export function spawnEnemy(state, kind, x, y) {
  const def = ENEMIES[kind];
  const scaled = scaleWithWave(def, state.wave);
  const e = {
    kind, def, x, y, vx: 0, vy: 0,
    hp: scaled.hp, maxHp: scaled.hp,
    r: def.r, speed: scaled.speed, dmg: def.dmg, score: def.score,
    t: 0, alive: true, flash: 0, spawnIn: 0.35,
    shootTimer: 1.2 + state.rng.next() * 1.2,
    summonTimer: 6 + state.rng.next() * 3,
    burstTimer: 2.5 + state.rng.next(),
    spiralTimer: 0.9, spiralAngle: 0,
    wobble: state.rng.angle(), wobbleSpeed: 2 + state.rng.next() * 2,
  };
  state.enemies.push(e);
  spawnRing(state, x, y, def.glow, def.r + 14);
  return e;
}

export function spawnAtEdge(state, kind) {
  const m = 30;
  const side = state.rng.int(0, 3);
  let x;
  let y;
  if (side === 0) { x = state.rng.range(m, FIELD.width - m); y = m; }
  else if (side === 1) { x = state.rng.range(m, FIELD.width - m); y = FIELD.height - m; }
  else if (side === 2) { x = m; y = state.rng.range(m, FIELD.height - m); }
  else { x = FIELD.width - m; y = state.rng.range(m, FIELD.height - m); }
  return spawnEnemy(state, kind, x, y);
}

function steer(e, tx, ty, dt, weight = 1) {
  const d = Math.hypot(tx - e.x, ty - e.y) || 1;
  e.vx += ((tx - e.x) / d) * e.speed * weight * dt * 4;
  e.vy += ((ty - e.y) / d) * e.speed * weight * dt * 4;
  const v = Math.hypot(e.vx, e.vy);
  const max = e.speed * (e.kind === 'skitter' ? 1.15 : 1);
  if (v > max) {
    e.vx = (e.vx / v) * max;
    e.vy = (e.vy / v) * max;
  }
}

function fireRadial(state, e, count, speed, dmg) {
  const offset = state.rng.angle();
  for (let i = 0; i < count; i += 1) {
    fireBolt(state, e.x, e.y, offset + (i / count) * Math.PI * 2, speed, dmg);
  }
}

function bossAct(state, e, dt) {
  const p = state.player;
  e.burstTimer -= dt;
  if (e.burstTimer <= 0) {
    e.burstTimer = e.kind === 'king' ? 2.2 : 2.6;
    fireRadial(state, e, e.kind === 'king' ? 16 : 12, 190, 12);
    state.sfx.push('bossWarn');
    spawnRing(state, e.x, e.y, e.def.glow, e.r + 30);
  }
  e.summonTimer -= dt;
  if (e.summonTimer <= 0) {
    e.summonTimer = 7;
    for (let i = 0; i < 3; i += 1) {
      const a = state.rng.angle();
      spawnEnemy(state, e.kind === 'king' ? 'skitter' : 'wisp',
        e.x + Math.cos(a) * (e.r + 20), e.y + Math.sin(a) * (e.r + 20));
    }
  }
  if (e.kind === 'king') {
    e.spiralTimer -= dt;
    if (e.spiralTimer <= 0) {
      e.spiralTimer = 0.9;
      for (let k = 0; k < 3; k += 1) {
        fireBolt(state, e.x, e.y, e.spiralAngle + k * 0.5, 170, 10);
      }
      e.spiralAngle += 0.7;
    }
  }
  steer(e, p.x, p.y, dt, 0.8);
}

function updateOne(state, e, dt) {
  const p = state.player;
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.spawnIn > 0) e.spawnIn -= dt;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;

  switch (e.kind) {
    case 'wisp':
    case 'splitter': {
      // Chase, weaving side to side.
      const wob = Math.sin(e.t * e.wobbleSpeed + e.wobble) * 0.6;
      const px = -dy / dist;
      const py = dx / dist;
      steer(e, p.x + px * wob * 60, p.y + py * wob * 60, dt);
      break;
    }
    case 'skitter': {
      // Fast zig-zag charge.
      const wob = Math.sin(e.t * 6 + e.wobble) * 1.4;
      const px = -dy / dist;
      const py = dx / dist;
      steer(e, p.x + px * wob * 90, p.y + py * wob * 90, dt, 1.1);
      break;
    }
    case 'spitter': {
      // Hold a middle distance and shoot.
      if (dist > 300) steer(e, p.x, p.y, dt, 0.9);
      else if (dist < 210) steer(e, e.x - dx, e.y - dy, dt, 0.9);
      else steer(e, e.x - dy / dist * 40, e.y + dx / dist * 40, dt, 0.5);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 520) {
        e.shootTimer = 2.4;
        const a = Math.atan2(dy, dx);
        fireBolt(state, e.x, e.y, a, 210, 10);
        spawnBurst(state, e.x, e.y, e.def.glow, 4, 80, 0.25, 2);
      }
      break;
    }
    case 'brute': {
      steer(e, p.x, p.y, dt, 0.9);
      break;
    }
    case 'herald':
    case 'king': {
      bossAct(state, e, dt);
      break;
    }
    default:
      steer(e, p.x, p.y, dt);
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.x = Math.max(e.r, Math.min(FIELD.width - e.r, e.x));
  e.y = Math.max(e.r, Math.min(FIELD.height - e.r, e.y));
}

/** Award score for a kill, through the combo multiplier. */
function awardKill(state, enemy) {
  state.combo += 1;
  state.comboTimer = 2.5;
  const mult = 1 + Math.min(state.combo, 25) * 0.04;
  const gained = Math.round(enemy.score * mult);
  state.score += gained;
  spawnText(state, enemy.x, enemy.y - enemy.r - 4, `+${gained}`, '#f2c94c', 13);
}

export function damageEnemy(state, enemy, dmg, isCrit) {
  if (!enemy.alive) return;
  enemy.hp -= dmg;
  enemy.flash = 0.09;
  // Knockback, except the heavy kinds barely move.
  const kb = enemy.kind === 'brute' || enemy.kind === 'herald' || enemy.kind === 'king' ? 12 : 90;
  const p = state.player;
  const d = Math.hypot(enemy.x - p.x, enemy.y - p.y) || 1;
  enemy.vx += ((enemy.x - p.x) / d) * kb;
  enemy.vy += ((enemy.y - p.y) / d) * kb;
  // Damage numbers, throttled per enemy so a multishot volley is one readable
  // number instead of a stack.
  if (!isCrit && state.time - (enemy.lastTextT || 0) > 0.12) {
    enemy.lastTextT = state.time;
    spawnText(state, enemy.x, enemy.y - enemy.r - 4, `${Math.round(dmg)}`, '#eef1f5', 12);
  }
  if (enemy.hp <= 0) killEnemy(state, enemy);
}

function killEnemy(state, enemy) {
  enemy.alive = false;
  state.kills += 1;
  awardKill(state, enemy);
  const big = enemy.kind === 'brute' || enemy.kind === 'herald' || enemy.kind === 'king';
  spawnBurst(state, enemy.x, enemy.y, enemy.def.color, big ? 26 : 12, big ? 260 : 180, 0.5, 3);
  spawnRing(state, enemy.x, enemy.y, enemy.def.glow, enemy.r + 22);
  state.sfx.push(big ? 'bruteDie' : 'enemyDie');
  if (big) {
    state.shake = Math.min(1, state.shake + 0.55);
    state.hitStop = Math.max(state.hitStop, 0.05);
  }
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const a = state.rng.angle();
      spawnEnemy(state, 'wisp', enemy.x + Math.cos(a) * 18, enemy.y + Math.sin(a) * 18);
    }
  }
  if (enemy.kind === 'herald' || enemy.kind === 'king') {
    state.boss = null;
    state.events |= EVENT_BOSS_DIED;
    state.sfx.push('bossDie');
    state.shake = 1;
    spawnRing(state, enemy.x, enemy.y, '#ffd97a', 160);
    spawnBurst(state, enemy.x, enemy.y, '#ffd97a', 40, 320, 0.8, 4);
    dropRoll(state, enemy.x, enemy.y, true);
  } else {
    dropRoll(state, enemy.x, enemy.y, false);
  }
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    updateOne(state, e, dt);
    // Contact with the player hurts (once the spawn-in fades).
    if (p.alive && e.spawnIn <= 0 && p.invuln <= 0) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < p.r + e.r - 2) {
        state.pendingDamage += e.dmg;
        // Shove the enemy back so one touch is one hit.
        const push = (p.r + e.r - d) + 6;
        e.x += ((e.x - p.x) / (d || 1)) * push;
        e.y += ((e.y - p.y) / (d || 1)) * push;
      }
    }
  }
  // Gentle separation so enemies do not stack on one pixel.
  const list = state.enemies;
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r - 4;
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push * 0.5;
        a.y -= ny * push * 0.5;
        b.x += nx * push * 0.5;
        b.y += ny * push * 0.5;
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.alive);
}
