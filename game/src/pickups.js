// Pickups: what fallen enemies leave behind. Hearts mend, shards are worth score,
// stars grant a few seconds of rapid fire. They drift, blink out after a while, and
// are pulled toward the player by the magnet.

import { FIELD, PLAYER } from './config.js';
import { spawnText } from './particles.js';

export const PICKUP_DEFS = {
  heart: { color: '#ff6b81', glow: '#d13a55', r: 11, label: '♥' },
  shard: { color: '#7fe0ff', glow: '#2b9fd8', r: 9, label: '◆' },
  star: { color: '#ffe066', glow: '#d8a92b', r: 12, label: '★' },
};

const LIFE = 12; // seconds before a pickup fades away

export function spawnPickup(state, kind, x, y) {
  // Keep pickups from stacking on one spot: if another pickup is already
  // close by, try a few ring offsets until this one has breathing room.
  const MIN_GAP = 56;
  let px = x;
  let py = y;
  const crowded = () => state.pickups.some((o) => Math.hypot(o.x - px, o.y - py) < MIN_GAP);
  if (crowded()) {
    for (let attempt = 0; attempt < 8 && crowded(); attempt += 1) {
      const a = state.rng.angle();
      const r = MIN_GAP + attempt * 14;
      px = x + Math.cos(a) * r;
      py = y + Math.sin(a) * r;
    }
  }
  // Stay inside the field.
  px = Math.max(16, Math.min(FIELD.width - 16, px));
  py = Math.max(16, Math.min(FIELD.height - 16, py));
  state.pickups.push({
    kind, x: px, y: py,
    vx: state.rng.range(-24, 24), vy: state.rng.range(-24, 24),
    t: 0, life: LIFE,
  });
}

/** Roll what, if anything, a kill drops. Bosses always leave something good. */
export function dropRoll(state, x, y, boss) {
  if (boss) {
    spawnPickup(state, 'heart', x - 24, y);
    spawnPickup(state, 'star', x + 24, y);
    return;
  }
  const roll = state.rng.next();
  if (roll < 0.06) spawnPickup(state, 'heart', x, y);
  else if (roll < 0.15) spawnPickup(state, 'shard', x, y);
  else if (roll < 0.19) spawnPickup(state, 'star', x, y);
}

export function updatePickups(state, dt) {
  const p = state.player;
  const magnetR = PLAYER.magnet * p.magnetMul;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = state.pickups[i];
    pk.t += dt;
    pk.life -= dt;
    if (pk.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const d = Math.hypot(dx, dy) || 1;
    if (p.alive && d < magnetR) {
      // Pulled in, faster the closer it gets.
      const pull = 620 * (1 - d / magnetR) + 120;
      pk.vx += (dx / d) * pull * dt * 4;
      pk.vy += (dy / d) * pull * dt * 4;
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.vx *= Math.pow(0.9, dt * 60);
    pk.vy *= Math.pow(0.9, dt * 60);
    if (p.alive && d < p.r + 13) {
      if (pk.kind === 'heart') {
        p.hp = Math.min(p.maxHp, p.hp + 20);
        spawnText(state, p.x, p.y - 24, '+20', '#7fe0a8', 15);
        state.sfx.push('pickup');
      } else if (pk.kind === 'shard') {
        state.score += 25;
        spawnText(state, p.x, p.y - 24, '+25', '#7fe0ff', 13);
        state.sfx.push('shard');
      } else {
        p.rapidTimer = PLAYER.rapidSeconds;
        spawnText(state, p.x, p.y - 24, 'RAPID FIRE!', '#ffe066', 16);
        state.sfx.push('pickup');
      }
      state.pickups.splice(i, 1);
    }
  }
}
