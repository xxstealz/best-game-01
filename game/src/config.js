// EMBERWARD — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the best score and the mute choice are kept between visits (this browser only). */
export const BEST_KEY = 'emberward.best';
export const MUTE_KEY = 'emberward.muted';

/** The last wave. Defeating the Hollow King on wave 10 wins the run. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  r: 14,
  speed: 275,
  maxHp: 100,
  fireRate: 5.5, // shots per second
  damage: 14,
  bulletSpeed: 560,
  bulletR: 6,
  invuln: 1.0, // seconds of mercy after taking a hit
  magnet: 95, // pickup attraction radius
  rapidSeconds: 6, // how long a star's rapid fire lasts
};

export const COMBO = {
  window: 2.5, // seconds between kills to keep the combo alive
  perKill: 0.04, // multiplier added per combo step
  cap: 25, // combo steps counted toward the multiplier
};

/** Enemy kinds. hp/speed/dmg scale a little with the wave; score is flat. */
export const ENEMIES = {
  wisp: {
    name: 'Wisp', hp: 22, speed: 78, r: 12, dmg: 8, score: 50,
    color: '#8b7ff0', glow: '#6a5ae0', eye: '#e8e4ff',
  },
  skitter: {
    name: 'Skitter', hp: 16, speed: 168, r: 10, dmg: 6, score: 80,
    color: '#f07fc0', glow: '#d14a9e', eye: '#ffe4f2',
  },
  spitter: {
    name: 'Spitter', hp: 30, speed: 56, r: 13, dmg: 10, score: 120,
    color: '#7fe0a8', glow: '#3fae72', eye: '#e4ffee',
  },
  splitter: {
    name: 'Splitter', hp: 34, speed: 92, r: 15, dmg: 10, score: 150,
    color: '#f0a35e', glow: '#d97e2b', eye: '#fff0dc',
  },
  brute: {
    name: 'Brute', hp: 135, speed: 46, r: 26, dmg: 20, score: 250,
    color: '#e5534b', glow: '#b02e28', eye: '#ffe0de',
  },
  herald: {
    name: 'Gloom Herald', hp: 1300, speed: 40, r: 46, dmg: 25, score: 2000,
    color: '#b07ff0', glow: '#7a3fd0', eye: '#f2e8ff',
  },
  king: {
    name: 'Hollow King', hp: 3000, speed: 34, r: 58, dmg: 30, score: 5000,
    color: '#ff5e7a', glow: '#c22a48', eye: '#ffeef1',
  },
};

/** Enemy bullets (shadow bolts). */
export const BOLT = { r: 6, speed: 210, dmg: 10 };

export const PALETTE = {
  backdrop: '#070a16',
  backdropTop: '#0b1024',
  backdropBottom: '#05070f',
  grid: '#141a30',
  wall: '#232c4d',
  wallGlow: '#3b4a7d',
  player: '#ffd97a',
  playerCore: '#fff3c4',
  playerGlow: '#ff9d2e',
  bullet: '#ffe9a8',
  bulletGlow: '#ffb52e',
  heart: '#ff6b81',
  shard: '#7fe0ff',
  star: '#ffe066',
  text: '#eef1f5',
  muted: '#9aa3b8',
  dim: '#5d6680',
  panel: '#12172a',
  panelEdge: '#2a3358',
  gold: '#f2c94c',
  danger: '#ff5e6e',
  heal: '#7fe0a8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
