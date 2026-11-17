// A small seeded random generator (mulberry32) so a run — and a screenshot scene —
// plays the same way from the same seed. The game creates one per run; the live game
// seeds it from the clock, the screenshot scenes from a fixed number.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with the given probability. */
    chance(p) {
      return next() < p;
    },
    /** One element of the array, uniformly. */
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    /** An angle in radians, uniform over the circle. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}
