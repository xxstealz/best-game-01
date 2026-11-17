// Bolts: the player's light bolts and the enemies' shadow bolts. A player bolt knows
// how many enemies it may still pierce and how many times it may bounce; an enemy bolt
// just flies straight. Hits queue sounds in state.sfx; the world plays them.

import { ENEMIES, FIELD, PLAYER } from './config.js';
import { damageEnemy } from './enemies.js';
import { spawnBurst, spawnText } from './particles.js';

/** Fire the player's current spread toward the aim point. */
export function firePlayerBolts(state) {
  const p = state.player;
  const aim = state.aim;
  const dx = aim.x - p.x;
  const dy = aim.y - p.y;
  const base = Math.atan2(dy, dx);
  const count = p.projectiles;
  const spread = 0.14; // radians between bolts in a spread
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spread;
    const angle = base + offset;
    state.bolts.push({
      x: p.x + Math.cos(angle) * (p.r + 6),
      y: p.y + Math.sin(angle) * (p.r + 6),
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      r: PLAYER.bulletR,
      dmg: PLAYER.damage * p.damageMul,
      pierce: p.pierce,
      bounces: p.ricochet,
      crit: p.crit,
      hit: new Set(),
      life: 1.6,
    });
  }
  state.stats.shots += count;
  state.sfx.push('shoot');
  spawnBurst(state, p.x + Math.cos(base) * (p.r + 8), p.y + Math.sin(base) * (p.r + 8), '#ffd97a', 2, 60, 0.18, 2);
}

/** One shadow bolt, fired by an enemy toward an angle. */
export function spawnEnemyBolt(state, x, y, angle, speed, dmg) {
  state.enemyBolts.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 6, dmg, life: 4,
  });
}

/** The nearest living enemy to (x, y), excluding `except`, within `maxDist`. */
export function nearestEnemy(state, x, y, except, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const e of state.enemies) {
    if (!e.alive || e === except) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function moveBolt(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life -= dt;
}

function outOfField(b, margin) {
  return b.x < -margin || b.x > FIELD.width + margin || b.y < -margin || b.y > FIELD.height + margin;
}

/** Move every bolt, resolve its hits, and drop the spent ones. */
export function updateProjectiles(state, dt) {
  // Player bolts vs enemies.
  for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
    const b = state.bolts[i];
    moveBolt(b, dt);
    if (b.life <= 0 || outOfField(b, 40)) {
      state.bolts.splice(i, 1);
      continue;
    }
    let consumed = false;
    for (const e of state.enemies) {
      if (!e.alive || b.hit.has(e)) continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d < e.r + b.r) {
        b.hit.add(e);
        const isCrit = state.rng.next() < b.crit;
        const dmg = b.dmg * (isCrit ? 2 : 1);
        damageEnemy(state, e, dmg, isCrit);
        state.stats.hits += 1;
        state.sfx.push('hit');
        spawnBurst(state, b.x, b.y, '#ffe9a8', 3, 120, 0.2, 2.5);
        if (isCrit) spawnText(state, e.x, e.y - e.r - 6, `${Math.round(dmg)}!`, '#ffd97a', 16);
        if (b.bounces > 0) {
          const next = nearestEnemy(state, e.x, e.y, e, 300);
          if (next) {
            b.bounces -= 1;
            const a = Math.atan2(next.y - b.y, next.x - b.x);
            const speed = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(a) * speed;
            b.vy = Math.sin(a) * speed;
            b.x = e.x;
            b.y = e.y;
            continue;
          }
        }
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          consumed = true;
        }
        break;
      }
    }
    if (consumed) state.bolts.splice(i, 1);
  }

  // Enemy bolts vs the player.
  const p = state.player;
  for (let i = state.enemyBolts.length - 1; i >= 0; i -= 1) {
    const b = state.enemyBolts[i];
    moveBolt(b, dt);
    if (b.life <= 0 || outOfField(b, 40)) {
      state.enemyBolts.splice(i, 1);
      continue;
    }
    if (p.alive && p.invuln <= 0) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < p.r + b.r) {
        state.pendingDamage += b.dmg;
        state.enemyBolts.splice(i, 1);
      }
    }
  }
}
