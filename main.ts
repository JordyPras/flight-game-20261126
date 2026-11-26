// Langit Nusantara — Island Courier: the entrypoint (Node 22, standard library
// only). It hands the game in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the game locally first with `node serve.ts`, then open
// http://localhost:8080 and fly it.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (from the competition's rules): 3 or 4 screenshots,
// each at most 256 KiB, and the dossier at most 1.5 MiB. Refuse a broken
// hand-in here, loudly, instead of handing the grader a bad one.
const SCREENSHOT_LIMIT = { min: 3, max: 4, maxBytes: 262144 };

function fail(message) {
  throw new Error(`langit-nusantara: ${message}`);
}

/** The screenshots, in name order: the first is the cover the judge sees. */
function listScreenshots(directory) {
  if (!existsSync(directory)) fail(`screenshots/ is missing at ${directory}`);
  return readdirSync(directory)
    .filter((name) => !name.startsWith('.'))
    .sort();
}

/** A screenshot must be a whole JPEG or PNG inside the scorer's size cap. */
function checkScreenshots(directory) {
  const names = listScreenshots(directory);
  if (names.length < SCREENSHOT_LIMIT.min || names.length > SCREENSHOT_LIMIT.max) {
    fail(`expected ${SCREENSHOT_LIMIT.min}-${SCREENSHOT_LIMIT.max} screenshots, found ${names.length}`);
  }
  for (const name of names) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (!stats.isFile()) fail(`screenshot ${name} is not a regular file`);
    if (!/\.(png|jpg|jpeg)$/i.test(name)) fail(`screenshot ${name} is not a PNG or JPEG`);
    if (stats.size > SCREENSHOT_LIMIT.maxBytes) {
      fail(`screenshot ${name} is ${stats.size} bytes, over the ${SCREENSHOT_LIMIT.maxBytes} cap`);
    }
  }
  return names;
}

/** Copy the entry into /output and build its dossier. Returns the shot list. */
function handIn() {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  const shots = checkScreenshots(shotsDir);

  mkdirSync(out, { recursive: true });
  cpSync(gameDir, join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

  const dossierPath = join(out, 'dossier.json');
  writeFileSync(
    dossierPath,
    buildDossier(out, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
      game_path_max_bytes: 1000,
    }),
  );
  // The scorer refuses a dossier over 1.5 MiB: check the bytes we just wrote.
  const dossierBytes = statSync(dossierPath).size;
  if (dossierBytes > 1572864) {
    fail(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB cap`);
  }
  return { shots, dossierBytes };
}

const { shots, dossierBytes } = handIn();
console.log(`Langit Nusantara handed in: ${shots.length} screenshots (${shots.join(', ')}) -> ${out}`);
console.log(`dossier.json: ${dossierBytes} bytes`);
