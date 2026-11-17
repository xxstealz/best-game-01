// Waves: what comes at the player, and when. Each wave has a point budget spent on
// enemy kinds that unlock as waves rise; waves 5 and 10 are boss waves — a boss up
// front, then a trickle of smaller shadows while it fights.

import { FINAL_WAVE } from './config.js';
import { spawnAtEdge, spawnEnemy } from './enemies.js';

const COST = { wisp: 1, skitter: 2, spitter: 3, splitter: 3, brute: 5 };

function unlockedKinds(wave) {
  const kinds = ['wisp'];
  if (wave >= 2) kinds.push('skitter');
  if (wave >= 3) kinds.push('spitter');
  if (wave >= 4) kinds.push('splitter', 'brute');
  return kinds;
}

/** Build a wave's spawn queue. Returns { queue, boss } — boss spawns at once. */
export function buildWave(rng, wave) {
  if (wave === 5) {
    return {
      boss: 'herald',
      queue: ['wisp', 'wisp', 'skitter', 'wisp', 'skitter', 'wisp', 'spitter', 'wisp'],
    };
  }
  if (wave === FINAL_WAVE) {
    return {
      boss: 'king',
      queue: ['wisp', 'wisp', 'skitter', 'wisp', 'skitter', 'spitter', 'wisp', 'brute', 'skitter', 'wisp'],
    };
  }
  const kinds = unlockedKinds(wave);
  let budget = 6 + wave * 5;
  const queue = [];
  while (budget > 0) {
    const kind = rng.pick(kinds);
    const cost = COST[kind];
    if (cost > budget && queue.length > 0) break;
    queue.push(kind);
    budget -= cost;
  }
  // Shuffle so the wave never arrives in kind order.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return { boss: null, queue };
}

/** Seconds between spawns inside a wave; waves get denser as they rise. */
export function spawnInterval(wave) {
  return Math.max(0.28, 0.75 - wave * 0.04);
}

export function waveTitle(wave) {
  if (wave === 5) return 'THE GLOOM HERALD';
  if (wave === FINAL_WAVE) return 'THE HOLLOW KING';
  return `WAVE ${wave}`;
}

export function waveSubtitle(wave) {
  if (wave === 5) return 'A herald of the dark has come — break it';
  if (wave === FINAL_WAVE) return 'Defeat the Hollow King to win the run';
  return 'Clear every shadow';
}

/** Start a wave: boss up front, the rest trickling in from the edges. */
export function startWave(state, wave) {
  state.wave = wave;
  const built = buildWave(state.rng, wave);
  state.spawnQueue = built.queue;
  state.spawnTimer = 0.6;
  state.spawnGap = spawnInterval(wave);
  if (built.boss) {
    state.boss = spawnEnemy(state, built.boss, 640, 130);
    state.sfx.push('bossWarn');
  }
  state.banner = {
    title: waveTitle(wave),
    sub: waveSubtitle(wave),
    timer: 2.4,
  };
}

export function spawnNext(state) {
  const kind = state.spawnQueue.shift();
  if (kind) spawnAtEdge(state, kind);
}
