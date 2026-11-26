// Langit Nusantara — Island Courier: every pixel the player sees, drawn on one
// canvas with no images and no network. A chase camera follows the plane over a
// procedural archipelago: sky, sun and sea, islands with mountains and runways,
// storm clouds, glowing rings, the plane itself, and a lit glass-cockpit HUD.

import { FIELD, FOCAL, FONT, HORIZON_Y, PALETTE, PLANE } from './config.js';
import { clamp, lerp, smoothstep } from './random.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './world.js';

const CX = FIELD.width / 2;
const CY = FIELD.height / 2;
const MS_TO_KNOTS = 1.94384;
const M_TO_FEET = 3.28084;

/**
 * Project a world point into the chase camera. Returns null when the point is
 * behind the camera or too close to draw. `plane` carries x, y, z, heading.
 */
export function project(wx, wy, wz, plane, pitchAngle) {
  const dx = wx - plane.x;
  const dy = wy - plane.y;
  const dz = wz - plane.z;
  const sinH = Math.sin(plane.heading);
  const cosH = Math.cos(plane.heading);
  const camX = dx * cosH - dz * sinH;
  const camZ = dx * sinH + dz * cosH;
  if (camZ < 10) return null;
  const scale = FOCAL / camZ;
  const horizonY = HORIZON_Y + pitchAngle * FOCAL * 0.8;
  return {
    x: CX + camX * scale,
    y: horizonY - dy * scale,
    scale,
    depth: camZ,
  };
}

function pitchAngleOf(plane) {
  return plane.pitch * 0.38;
}

function horizonYOf(plane) {
  return HORIZON_Y + pitchAngleOf(plane) * FOCAL * 0.8;
}

/** Draw the whole scene for the world's current screen. */
export function drawScene(ctx, world, time, view) {
  const plane = world.plane;
  const pitchAngle = pitchAngleOf(plane);
  const horizonY = horizonYOf(plane);
  // On the title screen the camera pulls back and up, so the runway, the home
  // island and the first rings all sit in the frame behind the title.
  const cam = world.screen === SCREEN_TITLE
    ? { ...plane, z: plane.z - 220, y: plane.y + 40 }
    : plane;
  ctx.save();
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (world.shake > 0) {
    const shake = world.shake * 9;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawSky(ctx, horizonY, time);
  // Roll the world with the bank, around the centre of the frame.
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(-plane.bank * 0.5);
  ctx.translate(-CX, -CY);
  drawSea(ctx, world, cam, horizonY, time);
  drawIslands(ctx, world, cam, pitchAngle);
  drawRings(ctx, world, cam, pitchAngle);
  drawClouds(ctx, world, cam, pitchAngle, time);
  drawParticles(ctx, world, cam, pitchAngle);
  ctx.restore();
  drawPlane(ctx, world, time);
  if (world.screen === SCREEN_PLAY || world.screen === SCREEN_OVER) drawHud(ctx, world, time);
  if (world.screen === SCREEN_TITLE) drawTitle(ctx, world);
  if (world.screen === SCREEN_OVER) drawGameOver(ctx, world);
  if (world.paused) drawPaused(ctx);
  if (view && view.touch) drawTouchControls(ctx);
  ctx.restore();
}

function drawSky(ctx, horizonY, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(0.55, PALETTE.skyMid);
  gradient.addColorStop(0.78, PALETTE.skyHorizon);
  gradient.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Morning sun, upper right, with a soft halo.
  const sunX = FIELD.width * 0.78;
  const sunY = 92 + Math.sin(time * 0.05) * 4;
  const halo = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
  halo.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  halo.addColorStop(0.25, 'rgba(255, 233, 184, 0.5)');
  halo.addColorStop(1, 'rgba(255, 233, 184, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  // A few high, thin clouds far above the sea.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  for (let index = 0; index < 5; index += 1) {
    const x = ((index * 271 + time * 3) % (FIELD.width + 320)) - 160;
    const y = 46 + index * 26;
    ctx.beginPath();
    ctx.ellipse(x, y, 90 + index * 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void horizonY;
}

function drawSea(ctx, world, cam, horizonY, time) {
  const plane = cam;
  const gradient = ctx.createLinearGradient(0, horizonY, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.seaShallow);
  gradient.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizonY, FIELD.width, FIELD.height - horizonY);
  // Sun glint: a shimmering band under the sun.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffe9b8';
  const glintWidth = 90 + Math.sin(time * 0.7) * 14;
  ctx.beginPath();
  ctx.moveTo(FIELD.width * 0.78 - glintWidth / 2, horizonY);
  ctx.lineTo(FIELD.width * 0.78 + glintWidth / 2, horizonY);
  ctx.lineTo(FIELD.width * 0.86, FIELD.height);
  ctx.lineTo(FIELD.width * 0.7, FIELD.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Perspective grid on the water: world-aligned lines that slide with the plane.
  ctx.strokeStyle = 'rgba(191, 233, 255, 0.28)';
  ctx.lineWidth = 1;
  const gridStartX = Math.floor((plane.x - 500) / 100) * 100;
  for (let x = gridStartX; x < plane.x + 500; x += 100) {
    ctx.beginPath();
    let started = false;
    for (let d = 60; d <= 1600; d += 90) {
      const point = project(x, 0, plane.z + d, plane, pitchAngleOf(plane));
      if (!point) continue;
      if (!started) {
        ctx.moveTo(point.x, point.y);
        started = true;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
  }
  const gridStartZ = Math.floor((plane.z + 60) / 140) * 140;
  for (let z = gridStartZ; z < plane.z + 1600; z += 140) {
    const left = project(plane.x - 520, 0, z, plane, pitchAngleOf(plane));
    const right = project(plane.x + 520, 0, z, plane, pitchAngleOf(plane));
    if (!left || !right) continue;
    const fade = clamp(1 - (z - plane.z) / 1600, 0, 1);
    ctx.strokeStyle = `rgba(191, 233, 255, ${(0.3 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
  // Sparkles: glints that twinkle on the water.
  ctx.fillStyle = PALETTE.seaSparkle;
  for (let index = 0; index < 42; index += 1) {
    const seed = index * 137.5;
    const wx = plane.x + Math.sin(seed) * 420;
    const wz = plane.z + 60 + ((seed * 7.3 + time * 26) % 1500);
    const point = project(wx, 0, wz, plane, pitchAngleOf(plane));
    if (!point || point.y < horizonY) continue;
    const twinkle = 0.25 + 0.55 * Math.abs(Math.sin(time * 2 + seed));
    ctx.globalAlpha = twinkle * clamp(1 - point.depth / 1600, 0, 1);
    ctx.fillRect(point.x, point.y, 5 * point.scale * 0.12 + 1, 1.6);
  }
  ctx.globalAlpha = 1;
}

function drawIslands(ctx, world, cam, pitchAngle) {
  const plane = cam;
  const sorted = world.islands
    .map((island) => ({ island, point: project(island.x, 0, island.z, plane, pitchAngle) }))
    .filter((entry) => entry.point && entry.point.depth > 20 && entry.point.depth < 2400)
    .sort((a, b) => b.point.depth - a.point.depth);
  for (const { island, point } of sorted) {
    const radiusX = island.radius * point.scale;
    const radiusY = radiusX * 0.34;
    const fade = clamp(1.15 - point.depth / 2400, 0.15, 1);
    ctx.globalAlpha = fade;
    // Sand ring, then jungle, then the mountain cone.
    ctx.fillStyle = PALETTE.sand;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = island.hue < 0 ? PALETTE.jungleDark : PALETTE.jungle;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y - radiusY * 0.12, radiusX * 0.86, radiusY * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Palm dots.
    ctx.fillStyle = PALETTE.palm;
    for (let index = 0; index < 7; index += 1) {
      const angle = index * 2.4 + island.radius;
      const px = point.x + Math.cos(angle) * radiusX * 0.55;
      const py = point.y - radiusY * 0.12 + Math.sin(angle) * radiusY * 0.45;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.5, radiusX * 0.03), 0, Math.PI * 2);
      ctx.fill();
    }
    // Mountain: a cone rising from the island's heart.
    if (island.peak > 6) {
      const peakHeight = island.peak * point.scale;
      const baseY = point.y - radiusY * 0.12;
      ctx.fillStyle = PALETTE.rock;
      ctx.beginPath();
      ctx.moveTo(point.x - radiusX * 0.42, baseY);
      ctx.lineTo(point.x, baseY - peakHeight);
      ctx.lineTo(point.x + radiusX * 0.42, baseY);
      ctx.closePath();
      ctx.fill();
      if (island.peak > 55) {
        ctx.fillStyle = PALETTE.rockSnow;
        ctx.beginPath();
        ctx.moveTo(point.x - radiusX * 0.13, baseY - peakHeight * 0.68);
        ctx.lineTo(point.x, baseY - peakHeight);
        ctx.lineTo(point.x + radiusX * 0.13, baseY - peakHeight * 0.68);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (island.runway) drawRunway(ctx, world, cam, pitchAngle);
    ctx.globalAlpha = 1;
  }
}

function drawRunway(ctx, world, cam, pitchAngle) {
  const plane = cam;
  const corners = [
    project(-11, 0.4, -30, plane, pitchAngle),
    project(11, 0.4, -30, plane, pitchAngle),
    project(11, 0.4, 150, plane, pitchAngle),
    project(-11, 0.4, 150, plane, pitchAngle),
  ];
  if (corners.some((corner) => !corner)) return;
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let index = 1; index < 4; index += 1) ctx.lineTo(corners[index].x, corners[index].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = PALETTE.runwayMark;
  for (let z = -20; z < 145; z += 22) {
    const a = project(0, 0.5, z, plane, pitchAngle);
    const b = project(0, 0.5, z + 11, plane, pitchAngle);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(1, 1.4 * a.scale * 0.12), Math.max(1.5, Math.abs(b.y - a.y) * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRings(ctx, world, cam, pitchAngle) {
  const plane = cam;
  const sorted = world.rings
    .map((ring) => ({ ring, point: project(ring.x, ring.y, ring.z, plane, pitchAngle) }))
    .filter((entry) => entry.point && entry.point.depth > 12 && entry.point.depth < 2400)
    .sort((a, b) => b.point.depth - a.point.depth);
  for (const { ring, point } of sorted) {
    const radius = ring.radius * point.scale;
    if (radius < 1.5) continue;
    const fade = clamp(1.1 - point.depth / 2400, 0.2, 1);
    const colour = ring.passed ? PALETTE.ringPassed : PALETTE.ring;
    ctx.save();
    ctx.globalAlpha = ring.passed ? fade * 0.45 : fade;
    ctx.shadowColor = ring.passed ? PALETTE.ringPassed : PALETTE.ringGlow;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2, radius * 0.14);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Chevrons on the hoop so it reads as a target, not a plain circle.
    ctx.lineWidth = Math.max(1.5, radius * 0.08);
    for (let index = 0; index < 4; index += 1) {
      const angle = (index * Math.PI) / 2 + Math.PI / 4;
      const inner = radius * 0.72;
      const outer = radius * 0.94;
      ctx.beginPath();
      ctx.moveTo(point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner);
      ctx.lineTo(point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer);
      ctx.stroke();
    }
    if (!ring.passed) {
      ctx.fillStyle = colour;
      ctx.font = `bold ${Math.max(11, Math.min(18, radius * 0.3))}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(point.depth)}m`, point.x, point.y + radius + 20);
    }
    ctx.restore();
  }
}

function drawClouds(ctx, world, cam, pitchAngle, time) {
  const plane = cam;
  const sorted = world.clouds
    .map((cloud) => ({ cloud, point: project(cloud.x, cloud.y, cloud.z, plane, pitchAngle) }))
    .filter((entry) => entry.point && entry.point.depth > 12 && entry.point.depth < 2400)
    .sort((a, b) => b.point.depth - a.point.depth);
  for (const { cloud, point } of sorted) {
    const size = cloud.size * point.scale;
    if (size < 2) continue;
    const fade = clamp(1.1 - point.depth / 2400, 0.25, 1);
    ctx.save();
    ctx.globalAlpha = fade * (cloud.storm ? 0.92 : 0.85);
    const puffs = 4;
    for (let index = 0; index < puffs; index += 1) {
      const angle = cloud.seed + index * 1.7;
      const px = point.x + Math.cos(angle) * size * 0.55;
      const py = point.y + Math.sin(angle) * size * 0.18;
      const radius = size * (0.5 + 0.16 * Math.sin(cloud.seed + index));
      ctx.fillStyle = cloud.storm ? '#4b5568' : '#ffffff';
      ctx.beginPath();
      ctx.ellipse(px, py, radius, radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (cloud.storm) {
      // Lightning flicker inside storm clouds.
      const flash = Math.sin(time * 2.4 + cloud.seed * 7) > 0.86;
      if (flash) {
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y + size * 0.3);
        ctx.lineTo(point.x - 6, point.y + size * 0.9);
        ctx.lineTo(point.x + 4, point.y + size * 1.3);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffd23f';
      ctx.font = `bold ${Math.max(11, size * 0.32)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', point.x, point.y - size * 0.7);
    }
    ctx.restore();
  }
}

function drawParticles(ctx, world, cam, pitchAngle) {
  const plane = cam;
  for (const particle of world.particles) {
    const point = project(particle.x, particle.y, particle.z, plane, pitchAngle);
    if (!point) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(1.5, particle.size * point.scale * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** The courier plane, seen from behind and slightly above, banking with the turn. */
function drawPlane(ctx, world, time) {
  const plane = world.plane;
  const x = CX;
  const y = CY + 118 - plane.pitch * 26;
  const bank = plane.bank * 0.9;
  const propAngle = time * 42;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-bank);
  // Soft shadow on the sea far below, when the plane is low.
  if (plane.y < 90) {
    const shadowScale = clamp(1 - plane.y / 120, 0.15, 0.85);
    ctx.fillStyle = `rgba(6, 30, 46, ${0.3 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(0, 150 + plane.y * 1.4, 66 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Main wings.
  ctx.fillStyle = PALETTE.planeWing;
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.quadraticCurveTo(-70, -14, -16, -4);
  ctx.lineTo(16, -4);
  ctx.quadraticCurveTo(70, -14, 118, 6);
  ctx.quadraticCurveTo(70, 14, 16, 8);
  ctx.lineTo(-16, 8);
  ctx.quadraticCurveTo(-70, 14, -118, 6);
  ctx.closePath();
  ctx.fill();
  // Red wingtips.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.quadraticCurveTo(-104, -6, -88, -6);
  ctx.lineTo(-84, 8);
  ctx.quadraticCurveTo(-100, 12, -118, 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(118, 6);
  ctx.quadraticCurveTo(104, -6, 88, -6);
  ctx.lineTo(84, 8);
  ctx.quadraticCurveTo(100, 12, 118, 6);
  ctx.closePath();
  ctx.fill();
  // Fuselage, seen from the tail.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-17, -34);
  ctx.quadraticCurveTo(0, -46, 17, -34);
  ctx.lineTo(15, 26);
  ctx.quadraticCurveTo(0, 34, -15, 26);
  ctx.closePath();
  ctx.fill();
  // Cabin roof and windows.
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.beginPath();
  ctx.ellipse(0, -22, 11, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#bfe9ff';
  ctx.beginPath();
  ctx.ellipse(0, -24, 6.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail fin and stabilizers.
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.beginPath();
  ctx.moveTo(-7, -30);
  ctx.lineTo(0, -62);
  ctx.lineTo(7, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeWing;
  ctx.beginPath();
  ctx.moveTo(-34, 22);
  ctx.lineTo(0, 12);
  ctx.lineTo(34, 22);
  ctx.lineTo(28, 30);
  ctx.lineTo(0, 22);
  ctx.lineTo(-28, 30);
  ctx.closePath();
  ctx.fill();
  // Spinning propeller, glimpsed above the nose.
  ctx.save();
  ctx.translate(0, -40);
  ctx.rotate(propAngle);
  ctx.fillStyle = 'rgba(201, 212, 222, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Navigation lights: red port, green starboard.
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.arc(-116, 6, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#59ff8a';
  ctx.beginPath();
  ctx.arc(116, 6, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Registration on the tail.
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PK-LNG', 0, 30);
  ctx.restore();
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(111, 215, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHud(ctx, world, time) {
  const plane = world.plane;
  const altitudeFt = Math.round(plane.y * M_TO_FEET);
  const speedKt = Math.round(plane.speed * MS_TO_KNOTS);
  const headingDeg = Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360);
  const verticalFpm = Math.round(plane.verticalSpeed * M_TO_FEET * 60);
  // Altitude, top left.
  panel(ctx, 18, 16, 168, 92);
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('ALTITUDE', 32, 38);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(`${altitudeFt}`, 32, 74);
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('FT', 32 + ctx.measureText(`${altitudeFt}`).width + 8, 74);
  ctx.fillStyle = verticalFpm >= 0 ? PALETTE.hudGreen : PALETTE.hudAmber;
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(`${verticalFpm >= 0 ? '▲' : '▼'} ${Math.abs(verticalFpm)} FT/MIN`, 32, 96);
  // Speed, top right.
  panel(ctx, FIELD.width - 186, 16, 168, 92);
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('AIRSPEED', FIELD.width - 172, 38);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(`${speedKt}`, FIELD.width - 172, 74);
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('KT', FIELD.width - 172 + ctx.measureText(`${speedKt}`).width + 8, 74);
  // Throttle bar.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(FIELD.width - 172, 84, 140, 8);
  ctx.fillStyle = plane.throttle > 0.85 ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.fillRect(FIELD.width - 172, 84, 140 * plane.throttle, 8);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(`THR ${Math.round(plane.throttle * 100)}%`, FIELD.width - 172, 106);
  // Compass strip, top centre.
  const compassWidth = 340;
  const compassX = CX - compassWidth / 2;
  panel(ctx, compassX, 16, compassWidth, 46);
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  ctx.save();
  ctx.beginPath();
  ctx.rect(compassX, 16, compassWidth, 46);
  ctx.clip();
  for (let offset = -180; offset <= 180; offset += 15) {
    const deg = (headingDeg + offset + 360) % 360;
    const x = CX + (offset / 180) * (compassWidth / 2);
    const cardinal = deg % 45 === 0;
    ctx.strokeStyle = cardinal ? PALETTE.hudAmber : 'rgba(234, 246, 255, 0.5)';
    ctx.lineWidth = cardinal ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 44);
    ctx.lineTo(x, cardinal ? 28 : 36);
    ctx.stroke();
    if (cardinal) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(points[Math.round(deg / 45) % 8], x, 26);
    }
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(CX - 7, 16);
  ctx.lineTo(CX + 7, 16);
  ctx.lineTo(CX, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${String(headingDeg).padStart(3, '0')}°`, CX, 58);
  // Attitude indicator: a small dial under the compass, clear of the rings.
  const attX = CX;
  const attY = 108;
  const attR = 28;
  ctx.save();
  ctx.translate(attX, attY);
  ctx.fillStyle = 'rgba(8, 20, 34, 0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, attR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(111, 215, 255, 0.5)';
  ctx.stroke();
  ctx.rotate(-plane.bank * 0.9);
  // Clip the sky and ground to the dial so no corner sticks out.
  ctx.beginPath();
  ctx.arc(0, 0, attR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#3f8fd2';
  ctx.beginPath();
  ctx.rect(-attR, -attR - plane.pitch * 34, attR * 2, attR + plane.pitch * 34);
  ctx.fill();
  ctx.fillStyle = '#c98f4a';
  ctx.beginPath();
  ctx.rect(-attR, 0, attR * 2, attR);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `bold 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ATT', attX, attY + attR + 11);
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(attX - 12, attY);
  ctx.lineTo(attX + 12, attY);
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.arc(attX, attY, 3, 0, Math.PI * 2);
  ctx.fill();
  // Score block, bottom right.
  panel(ctx, FIELD.width - 246, FIELD.height - 108, 228, 90);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', FIELD.width - 232, FIELD.height - 84);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText(`${Math.floor(world.score)}`, FIELD.width - 232, FIELD.height - 52);
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(`◉ RINGS ${world.ringsPassed}   LVL ${world.level}`, FIELD.width - 232, FIELD.height - 30);
  // Lives, bottom left: little plane icons.
  panel(ctx, 18, FIELD.height - 108, 228, 90);
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('LIVES', 32, FIELD.height - 84);
  for (let index = 0; index < 3; index += 1) {
    const x = 44 + index * 34;
    const y = FIELD.height - 56;
    ctx.fillStyle = index < world.lives ? PALETTE.planeBody : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x + 13, y);
    ctx.lineTo(x, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 2, y - 12, 4, 14);
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(`WIND ${Math.abs(Math.round(world.windSpeed))} KT ${world.windSpeed >= 0 ? '→' : '←'}`, 32, FIELD.height - 28);
  // Next-ring arrow when the hoop is off to one side.
  const ring = world.nextRing();
  if (ring) {
    const point = project(ring.x, ring.y, ring.z, plane, pitchAngleOf(plane));
    if (point && (point.x < 60 || point.x > FIELD.width - 60)) {
      const arrowX = point.x < 60 ? 46 : FIELD.width - 46;
      const arrowY = clamp(point.y, 120, FIELD.height - 140);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = PALETTE.ring;
      ctx.beginPath();
      if (point.x < 60) {
        ctx.moveTo(arrowX - 12, arrowY);
        ctx.lineTo(arrowX + 10, arrowY - 10);
        ctx.lineTo(arrowX + 10, arrowY + 10);
      } else {
        ctx.moveTo(arrowX + 12, arrowY);
        ctx.lineTo(arrowX - 10, arrowY - 10);
        ctx.lineTo(arrowX - 10, arrowY + 10);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // Warnings.
  if (plane.speed < PLANE.stallSpeed && world.mode === 'air') {
    const blink = Math.sin(time * 10) > 0;
    if (blink) {
      ctx.fillStyle = PALETTE.hudRed;
      ctx.font = `bold 30px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('⚠ STALL — THROTTLE UP!', CX, 150);
    }
  } else if (plane.y < 28 && world.mode === 'air') {
    const blink = Math.sin(time * 10) > 0;
    if (blink) {
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.font = `bold 30px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PULL UP!', CX, 150);
    }
  }
  // Transient message banner.
  if (world.messageTimer > 0 && world.message) {
    const alpha = clamp(world.messageTimer, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.font = `bold 22px ${FONT}`;
    const textWidth = ctx.measureText(world.message).width;
    ctx.beginPath();
    ctx.roundRect(CX - textWidth / 2 - 18, 176, textWidth + 36, 40, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.textAlign = 'center';
    ctx.fillText(world.message, CX, 204);
    ctx.restore();
  }
}

function drawTitle(ctx, world) {
  // A warm dusk gradient at the bottom so the text sits on something calm.
  const gradient = ctx.createLinearGradient(0, FIELD.height - 340, 0, FIELD.height);
  gradient.addColorStop(0, 'rgba(8, 20, 34, 0)');
  gradient.addColorStop(1, 'rgba(8, 20, 34, 0.82)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, FIELD.height - 340, FIELD.width, 340);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText('M A K E  T H E  B E S T  F L I G H T  G A M E', CX, 96);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText('LANGIT NUSANTARA', CX, 164);
  ctx.fillStyle = PALETTE.hudCyan;
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText('— ISLAND COURIER —', CX, 202);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `20px ${FONT}`;
  ctx.fillText('Fly the morning mail run across the islands. Thread every glowing ring,', CX, 428);
  ctx.fillText('mind the mountains and the storm clouds, and bring her home in one piece.', CX, 456);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `17px ${FONT}`;
  ctx.fillText('↑ / ↓ pitch    ← / → bank & turn    SHIFT throttle up    CTRL throttle down', CX, 500);
  ctx.fillText('or steer with the mouse — drag on touch.  P pause · M mute · R restart', CX, 526);
  const blink = Math.sin(world.time * 3.2) > -0.2;
  if (blink) {
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('CLICK OR PRESS ENTER TO FLY', CX, 584);
  }
  if (world.best > 0) {
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(`BEST SCORE: ${world.best}`, CX, 626);
  }
}

function drawGameOver(ctx, world) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudRed;
  ctx.font = `bold 56px ${FONT}`;
  ctx.fillText('FLIGHT OVER', CX, 250);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText(`SCORE  ${Math.floor(world.score)}`, CX, 322);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`Rings threaded: ${world.ringsPassed}   ·   Best combo: x${world.bestCombo}   ·   Distance: ${(world.distance / 1000).toFixed(1)} km`, CX, 366);
  ctx.fillText(`Level reached: ${world.level}   ·   Touchdowns: ${world.touchdowns}`, CX, 400);
  if (world.best > 0) {
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(`BEST SCORE: ${world.best}`, CX, 452);
  }
  const blink = Math.sin(world.time * 3.2) > -0.2;
  if (blink) {
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', CX, 516);
  }
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(8, 14, 24, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 44px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', CX, CY - 10);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `20px ${FONT}`;
  ctx.fillText('Press P to keep flying', CX, CY + 28);
}

function drawTouchControls(ctx) {
  // Two throttle buttons for touch pilots, bottom right.
  const buttons = [
    { label: '▲ THR', y: FIELD.height - 218 },
    { label: '▼ THR', y: FIELD.height - 148 },
  ];
  for (const button of buttons) {
    ctx.fillStyle = 'rgba(8, 20, 34, 0.6)';
    ctx.beginPath();
    ctx.roundRect(FIELD.width - 150, button.y, 120, 58, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(111, 215, 255, 0.5)';
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(button.label, FIELD.width - 90, button.y + 37);
  }
}

export { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER };
