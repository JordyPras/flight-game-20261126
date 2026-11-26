// A tiny seeded random number generator (mulberry32), so the same seed always
// builds the same archipelago, the same ring course and the same screenshot.

/** Make a generator that returns a float in [0, 1) from an integer seed. */
export function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float between min (inclusive) and max (exclusive). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer between min and max, inclusive. */
export function rangeInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Pick one entry from an array. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smoothstep easing for fades and transitions. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
