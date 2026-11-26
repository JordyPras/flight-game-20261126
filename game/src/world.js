// Langit Nusantara — Island Courier: the simulation. One World owns the plane, the
// archipelago, the ring course, the clouds, the wind, the score and the lives.
// It steps at a fixed rate, takes a small input shape, and reports what happened
// as an event bitmask, so the renderer and the screenshot autopilot stay dumb.

import {
  CLOUD,
  DISTANCE_POINTS_PER_10M,
  ISLAND,
  LIVES,
  PLANE,
  RING,
  STEP,
  WIND,
} from './config.js';
import { clamp, lerp, makeRandom, range } from './random.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_OVER = 4;
export const EVENT_LEVEL = 8;
export const EVENT_LAND = 16;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

/** The runway on the home island: a flat strip the courier starts on. */
const HOME_RUNWAY = { x: 0, z0: -30, z1: 150, halfWidth: 11 };

/** Home island: low, green, with the runway cut through its middle. */
const HOME_ISLAND = { x: 0, z: 60, radius: 150, peak: 10, hue: 0, runway: true };

/**
 * Smooth hill height of one island at a lateral offset: 1 at the summit,
 * falling to 0 at the shore.
 */
function islandHeightAt(island, x, z) {
  const dx = x - island.x;
  const dz = z - island.z;
  const d = Math.sqrt(dx * dx + dz * dz) / island.radius;
  if (d >= 1) return 0;
  return island.peak * (1 - d * d);
}

export class World {
  constructor(seed = 7) {
    this.seed = seed;
    this.best = 0;
    this.reset();
  }

  reset() {
    const random = makeRandom(this.seed);
    this.random = random;
    this.time = 0;
    this.screen = SCREEN_TITLE;
    this.paused = false;
    this.mode = 'ground';
    this.plane = {
      x: 0,
      y: PLANE.startAltitude,
      z: 0,
      heading: 0,
      speed: 0,
      throttle: 0,
      pitch: 0,
      bank: 0,
      verticalSpeed: 0,
    };
    this.score = 0;
    this.best = 0;
    this.ringsPassed = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.lives = LIVES;
    this.level = 1;
    this.distance = 0;
    this.rings = [];
    this.islands = [HOME_ISLAND];
    this.clouds = [];
    this.particles = [];
    this.windSpeed = 0;
    this.windGust = 0;
    this.shake = 0;
    this.message = '';
    this.messageTimer = 0;
    this.checkpoint = { x: 0, y: 80, z: 0, heading: 0 };
    this.nextRingZ = RING.firstDistance;
    this.lastRingX = 0;
    this.lastRingY = 55;
    this.generatedUpToZ = 300;
    this.touchdowns = 0;
    this.levelledAt = 0;
    this.events = 0;
    for (let index = 0; index < CLOUD.count; index += 1) {
      this.clouds.push(this.makeCloud(random, index * 90));
    }
    this.generateAhead();
  }

  /** Height of the land or sea under a point; 0 is the waterline. */
  terrainHeightAt(x, z) {
    if (z >= HOME_RUNWAY.z0 && z <= HOME_RUNWAY.z1 && Math.abs(x - HOME_RUNWAY.x) <= HOME_RUNWAY.halfWidth) {
      return 0;
    }
    let height = 0;
    for (let index = 0; index < this.islands.length; index += 1) {
      const island = this.islands[index];
      if (Math.abs(x - island.x) > island.radius || Math.abs(z - island.z) > island.radius) continue;
      height = Math.max(height, islandHeightAt(island, x, z));
    }
    return height;
  }

  /** True while the plane is over the home runway strip. */
  overRunway(x, z) {
    return z >= HOME_RUNWAY.z0 && z <= HOME_RUNWAY.z1 && Math.abs(x - HOME_RUNWAY.x) <= HOME_RUNWAY.halfWidth;
  }

  makeCloud(random, zOffset) {
    return {
      x: range(random, -420, 420),
      y: range(random, CLOUD.minAltitude, CLOUD.maxAltitude),
      z: zOffset + range(random, 0, 400),
      size: range(random, CLOUD.minSize, CLOUD.maxSize),
      storm: random() < ISLAND.stormChance,
      drift: range(random, -2, 2),
      seed: random() * Math.PI * 2,
    };
  }

  /** Grow islands, rings and clouds ahead of the plane as it flies on. */
  generateAhead() {
    const random = this.random;
    const target = this.plane.z + 2600;
    while (this.generatedUpToZ < target) {
      this.generatedUpToZ += ISLAND.bandSpacing;
      if (random() < 0.72) {
        const peak = range(random, ISLAND.minPeak, ISLAND.maxPeak);
        this.islands.push({
          x: range(random, -ISLAND.lateralRange, ISLAND.lateralRange),
          z: this.generatedUpToZ + range(random, -90, 90),
          radius: range(random, ISLAND.minRadius, ISLAND.maxRadius),
          peak,
          hue: Math.floor(range(random, -14, 14)),
          runway: false,
        });
      }
      if (random() < 0.4) {
        const cloud = this.makeCloud(random, this.generatedUpToZ);
        cloud.z = this.generatedUpToZ + range(random, 0, 300);
        this.clouds.push(cloud);
      }
    }
    while (this.nextRingZ < target) {
      const radius = Math.max(RING.minRadius, RING.startRadius - (this.level - 1) * RING.radiusPerLevel);
      // The course is a chain: each hoop sits near the previous one, winding
      // gently, so a pilot who steers from hoop to hoop can thread it and one
      // who does not cannot blame the course.
      const prevX = this.lastRingX ?? 0;
      const prevY = this.lastRingY ?? 55;
      const ringX = clamp(prevX + range(random, -90, 90), -260, 260);
      const ringY = clamp(prevY + range(random, -35, 45), RING.minAltitude, RING.maxAltitude);
      this.rings.push({
        x: ringX,
        y: ringY,
        z: this.nextRingZ,
        radius,
        passed: false,
        missed: false,
      });
      this.lastRingX = ringX;
      this.lastRingY = ringY;
      this.nextRingZ += RING.spacing;
    }
    // Drop what is far behind so the lists stay short.
    const behind = this.plane.z - 260;
    this.islands = this.islands.filter((island) => island.z + island.radius > behind || island.runway);
    this.rings = this.rings.filter((ring) => ring.z > behind - 60);
    this.clouds = this.clouds.filter((cloud) => cloud.z > behind - 100);
  }

  /** The next ring the pilot should aim for. */
  nextRing() {
    for (let index = 0; index < this.rings.length; index += 1) {
      if (!this.rings[index].passed && !this.rings[index].missed) return this.rings[index];
    }
    return null;
  }

  ringRadiusNow() {
    return Math.max(RING.minRadius, RING.startRadius - (this.level - 1) * RING.radiusPerLevel);
  }

  showMessage(text, seconds = 2) {
    this.message = text;
    this.messageTimer = seconds;
  }

  /** Fly one fixed step. `input` is { pitch, bank, throttle, brake }; returns events. */
  step(dt, input) {
    this.events = 0;
    if (this.screen !== SCREEN_PLAY || this.paused) return this.events;
    const plane = this.plane;
    this.time += dt;

    // Wind: a slow gust that pushes the plane sideways and shows on the HUD.
    this.windGust = Math.sin(this.time / WIND.gustPeriod) * 0.6 + Math.sin(this.time / 3.1) * 0.4;
    this.windSpeed = this.windGust * WIND.maxSpeed;

    // Throttle and speed.
    plane.throttle = clamp(plane.throttle + (input.throttle || 0) * dt * 0.55, 0, 1);
    const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    plane.speed += (targetSpeed - plane.speed) * PLANE.speedResponse * dt;
    if (this.mode === 'ground') {
      // Rolling resistance on the runway: the plane slows unless it is powered.
      plane.speed -= plane.speed * 0.25 * dt;
      if (input.brake) plane.speed -= 18 * dt;
      plane.speed = Math.max(0, plane.speed);
    }

    // Bank and heading: banking turns the plane.
    const bankTarget = (input.bank || 0) * 0.95;
    plane.bank += (bankTarget - plane.bank) * Math.min(1, 5 * dt);
    const speedFactor = clamp(plane.speed / PLANE.maxSpeed, 0.25, 1);
    plane.heading += plane.bank * PLANE.turnRate * speedFactor * dt;

    // Pitch and climb. Below stall speed the nose drops on its own.
    const pitchTarget = input.pitch || 0;
    plane.pitch += (pitchTarget - plane.pitch) * Math.min(1, 4 * dt);
    let pitchAngle = plane.pitch * 0.38;
    if (plane.speed < PLANE.stallSpeed && this.mode === 'air') {
      pitchAngle -= (PLANE.stallSpeed - plane.speed) * 0.012;
    }
    plane.verticalSpeed = plane.speed * Math.sin(pitchAngle);

    // Move.
    const forwardX = Math.sin(plane.heading);
    const forwardZ = Math.cos(plane.heading);
    plane.x += forwardX * plane.speed * dt + this.windSpeed * dt * 0.7;
    plane.z += forwardZ * plane.speed * dt;
    plane.y += plane.verticalSpeed * dt;
    plane.y = clamp(plane.y, PLANE.minAltitude, PLANE.maxAltitude);
    this.distance += plane.speed * dt;
    this.score += (plane.speed * dt * DISTANCE_POINTS_PER_10M) / 10;

    // Takeoff: fast enough and pulling up lifts off the runway.
    if (this.mode === 'ground' && plane.speed > 38 && plane.pitch > 0.25) {
      this.mode = 'air';
      plane.y = 3;
      this.showMessage('AIRBORNE — GEAR UP!', 2);
    }

    // Clouds drift with the wind.
    for (let index = 0; index < this.clouds.length; index += 1) {
      const cloud = this.clouds[index];
      cloud.x += (cloud.drift + this.windSpeed * 0.4) * dt;
      if (cloud.x > 480) cloud.x = -480;
      if (cloud.x < -480) cloud.x = 480;
    }

    this.generateAhead();
    this.checkRings();
    this.checkHazards();
    if (this.screen !== SCREEN_PLAY) return this.events;

    // Messages and shake decay.
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    this.updateParticles(dt);

    // Level up every RING.ringsPerLevel clean passes.
    if (this.ringsPassed > 0 && this.ringsPassed % RING.ringsPerLevel === 0 && this.levelledAt !== this.ringsPassed) {
      this.levelledAt = this.ringsPassed;
      this.level += 1;
      this.score += RING.levelBonus;
      this.showMessage(`LEVEL ${this.level} — FASTER, TIGHTER, WINDIER`, 2.5);
      this.events |= EVENT_LEVEL;
    }
    return this.events;
  }

  checkRings() {
    const plane = this.plane;
    for (let index = 0; index < this.rings.length; index += 1) {
      const ring = this.rings[index];
      if (ring.passed || ring.missed) continue;
      if (plane.z < ring.z) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const offset = Math.sqrt(dx * dx + dy * dy);
      if (offset <= ring.radius) {
        ring.passed = true;
        this.ringsPassed += 1;
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const points = RING.points * (1 + Math.floor(this.combo / 5));
        this.score += points;
        this.checkpoint = { x: ring.x, y: ring.y, z: ring.z, heading: plane.heading };
        this.showMessage(`RING! +${points}  (COMBO x${this.combo})`, 1.6);
        this.events |= EVENT_RING;
      } else {
        ring.missed = true;
        this.combo = 0;
      }
    }
  }

  checkHazards() {
    const plane = this.plane;
    // Storm clouds: flying into one is a crash.
    for (let index = 0; index < this.clouds.length; index += 1) {
      const cloud = this.clouds[index];
      if (!cloud.storm) continue;
      const dx = plane.x - cloud.x;
      const dy = plane.y - cloud.y;
      const dz = plane.z - cloud.z;
      if (dx * dx + dy * dy + dz * dz < cloud.size * cloud.size * 0.7) {
        this.crash('STORM CLOUD!');
        return;
      }
    }
    // Terrain and sea.
    const ground = this.terrainHeightAt(plane.x, plane.z);
    if (this.mode === 'air') {
      if (plane.y <= ground + 0.5) {
        if (this.overRunway(plane.x, plane.z) && Math.abs(plane.verticalSpeed) < 6 && plane.speed < 48) {
          this.land();
        } else if (ground > 0.5) {
          this.crash('MOUNTAIN!');
        } else {
          this.crash('DITCHED IN THE SEA!');
        }
      }
    } else if (plane.y <= 0.5 && !this.overRunway(plane.x, plane.z)) {
      this.crash('RAN OFF THE RUNWAY!');
    }
  }

  land() {
    const plane = this.plane;
    this.mode = 'ground';
    plane.y = PLANE.startAltitude;
    plane.verticalSpeed = 0;
    plane.throttle = Math.min(plane.throttle, 0.3);
    this.touchdowns += 1;
    this.score += 150;
    this.showMessage('TOUCHDOWN +150 — THROTTLE UP TO GO AGAIN', 2.5);
    this.events |= EVENT_LAND;
  }

  crash(reason) {
    const plane = this.plane;
    this.lives -= 1;
    this.combo = 0;
    this.shake = 1;
    this.spawnExplosion(plane.x, plane.y, plane.z);
    this.events |= EVENT_CRASH;
    if (this.lives <= 0) {
      this.screen = SCREEN_OVER;
      this.best = Math.max(this.best, Math.floor(this.score));
      this.showMessage(reason, 3);
      this.events |= EVENT_OVER;
      return;
    }
    this.showMessage(`${reason}  —  ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, 2.5);
    // Respawn at the last ring passed, already flying.
    const checkpoint = this.checkpoint;
    plane.x = checkpoint.x;
    plane.y = Math.max(80, checkpoint.y);
    plane.z = checkpoint.z;
    plane.heading = checkpoint.heading;
    plane.speed = 46;
    plane.throttle = 0.7;
    plane.pitch = 0;
    plane.bank = 0;
    plane.verticalSpeed = 0;
    this.mode = 'air';
  }

  spawnExplosion(x, y, z) {
    for (let index = 0; index < 26; index += 1) {
      this.particles.push({
        x, y, z,
        vx: (this.random() - 0.5) * 30,
        vy: (this.random() - 0.2) * 24,
        vz: (this.random() - 0.5) * 30,
        life: 1,
        size: 4 + this.random() * 9,
        color: this.random() < 0.5 ? '#ff9d2e' : '#5a5f66',
      });
    }
  }

  updateParticles(dt) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt * 0.9;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.vy -= 6 * dt;
      if (particle.life <= 0) this.particles.splice(index, 1);
    }
  }

  /** Idle drift for the title screen: clouds move, the sea glints, nothing flies. */
  stepTitle(dt) {
    this.time += dt;
    for (let index = 0; index < this.clouds.length; index += 1) {
      const cloud = this.clouds[index];
      cloud.x += cloud.drift * dt;
      if (cloud.x > 480) cloud.x = -480;
      if (cloud.x < -480) cloud.x = 480;
    }
  }
}
