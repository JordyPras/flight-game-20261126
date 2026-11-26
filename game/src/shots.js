// Langit Nusantara — Island Courier: the screenshot scenes behind
// ?shot=start|play|ring|end. Each one flies the real rules forward from a fresh
// world for a fixed number of steps, steered by a simple autopilot that aims at
// the next ring, so the frame is what a real flight looks like and the same
// seed always gives the same frame.

import { STEP } from './config.js';
import { clamp } from './random.js';
import { EVENT_OVER, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, World } from './world.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const RING_SECONDS = 14;
const END_LIMIT_SECONDS = 600;
/** How hard the play autopilot chases the ring: full stick, well flown. */
const PILOT_PLAY = { pitchGain: 0.03, bankGain: 0.03, throttle: 0.85 };
/** The end-scene pilot is sloppy: it wanders, flies level, and meets a mountain. */
const PILOT_END = { pitchGain: 0.004, bankGain: 0.004, throttle: 0.55 };

/**
 * Steer toward the next ring by pursuit: bank until the nose points at the
 * hoop, climb until the climb angle points at it. A heading-error controller
 * instead of a lateral-offset one, so the plane curves onto the hoop instead
 * of swinging past it and back.
 */
function autopilot(world, pilot) {
  const plane = world.plane;
  const ring = world.nextRing();
  if (!ring) return { pitch: 0, bank: 0, throttle: 0.3, brake: false };
  const dx = ring.x - plane.x;
  const dy = ring.y - plane.y;
  const dz = Math.max(30, ring.z - plane.z);
  const desiredHeading = Math.atan2(dx, dz);
  let headingError = desiredHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const desiredClimb = Math.atan2(dy, dz);
  return {
    pitch: clamp(desiredClimb / 0.38, -1, 1),
    bank: clamp(headingError * 2.2, -1, 1),
    throttle: pilot.throttle - plane.throttle > 0 ? 0.4 : -0.2,
    brake: false,
  };
}

/**
 * The sloppy end-scene pilot: it picks a new bank every few seconds, never
 * climbs, and wanders until the islands catch it.
 */
function wanderPilot(world, seconds) {
  const pick = Math.sin(seconds * 0.35) > 0 ? 0.7 : -0.7;
  return { pitch: -0.15, bank: pick, throttle: 0.2, brake: false };
}

/** Take off from the runway the way a player would: throttle up, pull up. */
function takeoff(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const plane = world.plane;
    const input = { pitch: plane.speed > 30 ? 0.8 : 0, bank: 0, throttle: 1, brake: false };
    world.step(STEP, input);
  }
}

/**
 * Set `world` to the named scene (start, play, ring or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'ring' && name !== 'end') {
    // Title: sit on the runway a while, engine idling, islands ahead.
    world.plane.throttle = 0.25;
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.stepTitle(STEP);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  // Every flying scene starts with a real takeoff.
  world.screen = SCREEN_PLAY;
  takeoff(world, 5);
  const seconds = name === 'ring' ? RING_SECONDS : name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const pilot = name === 'end' ? PILOT_END : PILOT_PLAY;
  for (let index = 0; index < seconds / STEP; index += 1) {
    const input = name === 'end' ? wanderPilot(world, index * STEP) : autopilot(world, pilot);
    if (world.step(STEP, input) & EVENT_OVER) break;
  }
  const over = world.screen === SCREEN_OVER;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.floor(world.score) };
}

export { World };
