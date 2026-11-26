// Langit Nusantara — Island Courier: the boot and the game loop.
// The canvas fills the window, the world steps at a fixed 60 Hz whatever the
// display's rate, and ?shot=start|play|ring|end&seed=N stages one frozen
// frame for a screenshot instead of starting the loop.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { drawScene } from './render.js';
import { stageShot } from './shots.js';
import { EVENT_CRASH, EVENT_LEVEL, EVENT_RING, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, World } from './world.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const context = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '7', 10) || 7;
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const world = new World(seed);
const input = new Input(canvas);
const sound = new SoundEngine();
input.attach();

/** Load the saved best score (this browser only). */
function loadBest() {
  try {
    world.best = Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch {
    world.best = 0;
  }
}

/** Save the best score when a flight beats it. */
function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(world.best));
  } catch {
    // Private mode or no storage: the score still counts for this visit.
  }
}

loadBest();

/** A handle for automated play-tests (and curious pilots): window.__langit.world. */
window.__langit = { world, input, sound };

/** Fit the fixed 1280x720 field to the window without stretching it. */
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  canvas.width = Math.round(FIELD.width * scale * window.devicePixelRatio);
  canvas.height = Math.round(FIELD.height * scale * window.devicePixelRatio);
  canvas.style.width = `${Math.round(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.round(FIELD.height * scale)}px`;
  context.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
}

window.addEventListener('resize', resize);
resize();

/** Announce the state for screen readers, never shown. */
function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function startFlight() {
  world.reset();
  world.best = loadBestValue();
  world.screen = SCREEN_PLAY;
  sound.start();
  sound.resume();
  sound.click();
  announce('Flying. Thread the glowing rings.');
}

function loadBestValue() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

let lastEvents = 0;

/** One frame: read input, step the world, play the matching sounds, draw. */
function frame(now) {
  const dt = STEP;
  if (input.takeMute()) sound.setMuted(!sound.muted);
  if (input.takePause() && world.screen === SCREEN_PLAY) {
    world.paused = !world.paused;
    announce(world.paused ? 'Paused.' : 'Flying.');
  }
  if (world.screen === SCREEN_TITLE) {
    world.stepTitle(dt);
    if (input.takeConfirm()) startFlight();
  } else if (world.screen === SCREEN_PLAY && !world.paused) {
    const steering = input.read(canvas.clientWidth, canvas.clientHeight);
    lastEvents = world.step(dt, steering);
    if (lastEvents & EVENT_RING) sound.ring();
    if (lastEvents & EVENT_CRASH) sound.crash();
    if (lastEvents & EVENT_LEVEL) sound.levelUp();
    if (world.screen === SCREEN_OVER) {
      world.best = Math.max(world.best, Math.floor(world.score));
      saveBest();
      announce(`Flight over. Score ${Math.floor(world.score)}.`);
    }
    sound.update(world.plane.throttle, world.plane.speed, world.mode === 'air');
  } else if (world.screen === SCREEN_OVER) {
    if (input.takeRestart() || input.takeConfirm()) startFlight();
  }
  drawScene(context, world, now / 1000, { touch: isTouch });
  window.requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: stage the scene, draw it once, and hold the frame still.
  const staged = stageShot(shotName, world);
  world.screen = staged.screen;
  world.best = staged.best;
  drawScene(context, world, 24, { touch: false });
  document.title = `Langit Nusantara — shot ${shotName}`;
} else {
  announce('Langit Nusantara, Island Courier. Press Enter or click to fly.');
  window.requestAnimationFrame(frame);
}
