// Langit Nusantara — Island Courier: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. Distances are metres,
// speeds are metres per second; the HUD converts to feet and knots for display.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Focal length of the chase camera, in logical pixels. */
export const FOCAL = 620;

/** Where the camera looks: the horizon sits a little above the middle of the frame. */
export const HORIZON_Y = 300;

/** The plane starts parked on the home runway, nose into the morning sun. */
export const PLANE = {
  /** Metres above the sea when parked on the runway. */
  startAltitude: 2,
  /** Cruise speed at full throttle, m/s. */
  maxSpeed: 82,
  /** Speed at idle throttle, m/s. */
  minSpeed: 24,
  /** Below this the wings stop flying and the nose drops. */
  stallSpeed: 30,
  /** How fast speed chases its throttle target, per second. */
  speedResponse: 0.55,
  /** Pitch authority, radians per second at full stick. */
  pitchRate: 0.55,
  /** Bank authority, radians per second at full stick. */
  bankRate: 1.5,
  /** How fast the bank settles back toward level when the stick is released. */
  bankSettle: 1.6,
  /** Turn rate per radian of bank, radians of heading per second. */
  turnRate: 0.55,
  /** Climb rate per unit of pitch at cruise speed, m/s. */
  climbRate: 26,
  /** Hard deck: the sea. */
  minAltitude: 0,
  /** Service ceiling: the sky runs out here. */
  maxAltitude: 260,
};

export const LIVES = 3;

/** Rings: the courier's course. Fly through the glowing hoop to score. */
export const RING = {
  /** First ring's distance ahead of the runway, metres. */
  firstDistance: 420,
  /** Gap between rings along the course, metres. */
  spacing: 340,
  /** How far a ring may sit off the centreline, metres. */
  lateralRange: 130,
  /** Ring centre altitude range, metres. */
  minAltitude: 45,
  maxAltitude: 170,
  /** Starting hoop radius, metres; shrinks as levels rise. */
  startRadius: 15,
  minRadius: 8,
  radiusPerLevel: 0.9,
  /** Points for a clean pass, before the combo multiplier. */
  points: 100,
  /** Rings per level: each level the course gets faster and tighter. */
  ringsPerLevel: 8,
  levelBonus: 250,
};

/** Islands: the archipelago the course threads through. */
export const ISLAND = {
  /** How often a new island band appears along the course, metres. */
  bandSpacing: 260,
  /** Lateral spread of islands, metres either side of the centreline. */
  lateralRange: 420,
  minRadius: 55,
  maxRadius: 170,
  minPeak: 18,
  maxPeak: 95,
  /** Chance a band holds a storm cloud instead of clear sky. */
  stormChance: 0.22,
};

/** Clouds drift slowly and thin out with altitude. */
export const CLOUD = {
  count: 26,
  minAltitude: 90,
  maxAltitude: 240,
  minSize: 26,
  maxSize: 70,
};

/** Wind: a slow, gusty push the pilot has to trim against. */
export const WIND = {
  maxSpeed: 7,
  gustPeriod: 9,
};

/** Points for every 10 metres of the journey. */
export const DISTANCE_POINTS_PER_10M = 1;

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7db8e8',
  skyHorizon: '#ffe9b8',
  sun: '#fff3c4',
  seaDeep: '#0b4d6e',
  seaShallow: '#2e8fae',
  seaSparkle: '#bfe9ff',
  sand: '#f2e2b6',
  jungle: '#2f7d4f',
  jungleDark: '#1f5c38',
  rock: '#6b7a86',
  rockSnow: '#eef4f7',
  palm: '#2a9d5c',
  runway: '#3a3f46',
  runwayMark: '#f5f7fa',
  ring: '#ffd23f',
  ringGlow: '#ff9d2e',
  ringPassed: '#7dff9e',
  planeBody: '#e8542f',
  planeWing: '#f4f6f8',
  planeTrim: '#1f3a5f',
  prop: '#c9d4de',
  hudPanel: 'rgba(8, 20, 34, 0.72)',
  hudText: '#eaf6ff',
  hudAmber: '#ffc857',
  hudGreen: '#7dff9e',
  hudRed: '#ff6b5e',
  hudCyan: '#6fd7ff',
  text: '#f2f6fa',
  muted: '#aebfd0',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'langit-nusantara.best';
