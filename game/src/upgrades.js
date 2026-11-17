// The upgrades offered between waves. Each one names what it does in plain words,
// stacks up to its max level, and applies its effect to the player's stats. A run
// offers three different cards; when few are left, a healing card fills the gaps.

export const UPGRADES = [
  {
    id: 'damage', name: 'Sharpened Light', icon: '◆', max: 5,
    desc: '+25% bolt damage',
    apply(p) { p.damageMul *= 1.25; },
  },
  {
    id: 'rapid', name: 'Rapid Wick', icon: '≫', max: 5,
    desc: '+20% fire rate',
    apply(p) { p.fireMul *= 1.2; },
  },
  {
    id: 'multishot', name: 'Twin Flames', icon: '✦', max: 3,
    desc: '+1 bolt per shot',
    apply(p) { p.projectiles += 1; },
  },
  {
    id: 'pierce', name: 'Piercing Rays', icon: '➶', max: 3,
    desc: 'Bolts pierce +1 enemy',
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'swift', name: 'Swift Boots', icon: '»', max: 4,
    desc: '+12% move speed',
    apply(p) { p.speedMul *= 1.12; },
  },
  {
    id: 'heart', name: 'Ember Heart', icon: '♥', max: 5,
    desc: '+25 max HP and heal 25',
    apply(p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'magnet', name: 'Shard Magnet', icon: '◎', max: 3,
    desc: '+70% pickup radius',
    apply(p) { p.magnetMul *= 1.7; },
  },
  {
    id: 'aegis', name: 'Aegis Ward', icon: '⛨', max: 1,
    desc: 'A shield blocks one hit, recharges in 18s',
    apply(p) { p.shieldMax = 1; p.shield = 1; },
  },
  {
    id: 'ricochet', name: 'Ricochet', icon: '↯', max: 2,
    desc: 'Bolts bounce to +1 nearby enemy',
    apply(p) { p.ricochet += 1; },
  },
  {
    id: 'crit', name: 'Crit Spark', icon: '✧', max: 5,
    desc: '+8% chance bolts crit for double damage',
    apply(p) { p.crit += 0.08; },
  },
  {
    id: 'mend', name: 'Mend Wounds', icon: '+', max: 99,
    desc: 'Restore 40 HP now',
    apply(p) { p.hp = Math.min(p.maxHp, p.hp + 40); },
  },
];

/** Roll three different upgrades the player can still take. */
export function rollChoices(rng, levels) {
  const pool = UPGRADES.filter((u) => u.id !== 'mend' && (levels[u.id] || 0) < u.max);
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const index = Math.floor(rng.next() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }
  while (picks.length < 3) picks.push(UPGRADES.find((u) => u.id === 'mend'));
  return picks.map((def) => ({ def, level: (levels[def.id] || 0) + 1 }));
}

/** Apply the chosen upgrade and record its new level. */
export function applyUpgrade(state, choice) {
  const { def } = choice;
  state.upgradeLevels[def.id] = (state.upgradeLevels[def.id] || 0) + 1;
  def.apply(state.player);
}
